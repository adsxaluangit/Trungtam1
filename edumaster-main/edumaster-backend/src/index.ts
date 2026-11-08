// EduMaster Pro Backend Entry Point
// @ts-ignore
import bcrypt from 'bcryptjs';

export default {
    register({ strapi }: { strapi: any }) {
        strapi.contentType('plugin::users-permissions.user').attributes.permissions = {
            type: 'json',
            configurable: false,
        };
    },

    async bootstrap({ strapi }: { strapi: any }) {
        console.log(' EduMaster BOOTSTRAP STARTING...');

        // Optimize Database Indexes
        try {
            const knex = strapi.db.connection;
            console.log(' EduMaster Creating Database Indexes for Performance...');
            
            // B-Tree Indexes
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_students_id_number ON students(id_number)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_students_created_at ON students(created_at)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_class_decisions_type ON class_decisions(type)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_cd_students_lnk_student_id ON class_decisions_students_lnk(student_id)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_cd_students_lnk_decision_id ON class_decisions_students_lnk(class_decision_id)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_stu_class_lnk_stu_id ON students_school_class_lnk(student_id)');
            await knex.raw('CREATE INDEX IF NOT EXISTS idx_stu_class_lnk_cls_id ON students_school_class_lnk(school_class_id)');

            // Trigram Indexes for ILIKE (Search)
            try {
                await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');
                await knex.raw('CREATE INDEX IF NOT EXISTS idx_students_full_name_trgm ON students USING gin (full_name gin_trgm_ops)');
                await knex.raw('CREATE INDEX IF NOT EXISTS idx_students_id_number_trgm ON students USING gin (id_number gin_trgm_ops)');
                console.log(' EduMaster Trigram Indexes created successfully.');
            } catch (extErr) {
                console.warn(' EduMaster Could not create pg_trgm extension/indexes:', (extErr as any).message);
            }
            
            console.log(' EduMaster Database B-Tree Indexes created successfully.');
        } catch (dbErr) {
            console.error(' EduMaster Error creating DB indexes:', dbErr);
        }

        try {
            // 1. Get the Authenticated Role
            const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
            
            if (authenticatedRole) {
                console.log(` EduMaster Found Authenticated Role: ${authenticatedRole.id}`);
                
                // 1b. Fix Plugin Settings (Local login & Confirmation)
                const store = strapi.store({ type: 'plugin', name: 'users-permissions' });
                const advancedSettings = await store.get({ key: 'advanced' });
                
                await store.set({ 
                    key: 'advanced', 
                    value: { 
                        ...advancedSettings, 
                        email_confirmation: false, 
                        allow_register: true, 
                        register_default_role: authenticatedRole.id 
                    } 
                });
                console.log(' EduMaster Advanced Settings (UPDATED)');

                // 1c. Ensure Local Provider is enabled
                const grantSettings = await store.get({ key: 'grant' });
                if (grantSettings && grantSettings.local) {
                    grantSettings.local.enabled = true;
                    await store.set({ key: 'grant', value: grantSettings });
                    console.log(' EduMaster Local Provider (ENABLED)');
                }

                // 2. Grant Permissions
                const actionsToGrant = [
                    'api::class-decision.class-decision.find', 'api::class-decision.class-decision.findOne', 'api::class-decision.class-decision.create', 'api::class-decision.class-decision.update', 'api::class-decision.class-decision.delete',
                    'api::training-assignment.training-assignment.find', 'api::training-assignment.training-assignment.findOne', 'api::training-assignment.training-assignment.create', 'api::training-assignment.training-assignment.update', 'api::training-assignment.training-assignment.delete',
                    'api::exam-approval.exam-approval.find', 'api::exam-approval.exam-approval.findOne', 'api::exam-approval.exam-approval.create', 'api::exam-approval.exam-approval.update', 'api::exam-approval.exam-approval.delete',
                    'api::exam-grade.exam-grade.find', 'api::exam-grade.exam-grade.findOne', 'api::exam-grade.exam-grade.create', 'api::exam-grade.exam-grade.update', 'api::exam-grade.exam-grade.delete',
                    'api::student.student.find', 'api::student.student.findOne', 'api::student.student.create', 'api::student.student.update', 'api::student.student.delete',
                    'api::school-class.school-class.find', 'api::school-class.school-class.findOne', 'api::school-class.school-class.create', 'api::school-class.school-class.update', 'api::school-class.school-class.delete',
                    'api::subject.subject.find', 'api::subject.subject.findOne', 'api::subject.subject.create', 'api::subject.subject.update', 'api::subject.subject.delete',
                    'api::teacher.teacher.find', 'api::teacher.teacher.findOne', 'api::teacher.teacher.create', 'api::teacher.teacher.update', 'api::teacher.teacher.delete',
                    'api::classroom.classroom.find', 'api::classroom.classroom.findOne', 'api::classroom.classroom.create', 'api::classroom.classroom.update', 'api::classroom.classroom.delete',
                    'api::nation.nation.find', 'api::nation.nation.findOne', 'api::nation.nation.create', 'api::nation.nation.update', 'api::nation.nation.delete',
                    'api::supplier.supplier.find', 'api::supplier.supplier.findOne', 'api::supplier.supplier.create', 'api::supplier.supplier.update', 'api::supplier.supplier.delete',
                    'api::print-template.print-template.find', 'api::print-template.print-template.findOne', 'api::print-template.print-template.create', 'api::print-template.print-template.update', 'api::print-template.print-template.delete',
                    'api::audit-log.audit-log.find', 'api::audit-log.audit-log.findOne', 'api::audit-log.audit-log.create',
                    'plugin::users-permissions.user.me',
                    'plugin::users-permissions.user.find', 'plugin::users-permissions.user.findOne', 'plugin::users-permissions.user.create', 'plugin::users-permissions.user.update', 'plugin::users-permissions.user.destroy', 'plugin::users-permissions.role.find'
                ];

                for (const action of actionsToGrant) {
                   const existing = await strapi.query('plugin::users-permissions.permission').findOne({ where: { role: authenticatedRole.id, action: action } });
                   if (!existing) {
                       await strapi.query('plugin::users-permissions.permission').create({ data: { action, role: authenticatedRole.id } });
                       console.log(` EduMaster Granted ${action}`);
                   }
                }

                // 2b. Grant Public role permissions (for registration page - no login required)
                const publicRole = await strapi.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
                if (publicRole) {
                    const publicActions = [
                        'api::school-class.school-class.find',
                        'api::school-class.school-class.findOne',
                        'api::student.student.create',
                        'plugin::users-permissions.auth.callback',
                        'plugin::users-permissions.auth.connect',
                        'plugin::users-permissions.auth.forgotPassword',
                        'plugin::users-permissions.auth.resetPassword',
                        'plugin::users-permissions.auth.emailConfirmation',
                        'plugin::users-permissions.user.me',
                    ];
                    for (const action of publicActions) {
                        const existing = await strapi.query('plugin::users-permissions.permission').findOne({ where: { role: publicRole.id, action } });
                        if (!existing) {
                            await strapi.query('plugin::users-permissions.permission').create({ data: { action, role: publicRole.id } });
                            console.log(` EduMaster [Public] Granted ${action}`);
                        }
                    }
                    console.log(' EduMaster Public Role permissions (UPDATED)');
                }

                // 3. Update Users with correct HASHED passwords
                // Strapi v5: hashPassword da bi xoa khoi user service, dung bcryptjs truc tiep
                const usersToSet = [
                    { username: 'duong', email: 'duong@edumaster.pro', password: 'EduMaster@2026' },
                    { username: 'admin', email: 'admin@edumaster.pro', password: 'admin123' }
                ];

                for (const uData of usersToSet) {
                    const user = await strapi.query('plugin::users-permissions.user').findOne({ where: { username: uData.username } });
                    const hashedPassword = await bcrypt.hash(uData.password, 10);
                    
                    const finalData = {
                        username: uData.username,
                        email: uData.email,
                        password: hashedPassword,
                        role: authenticatedRole.id,
                        confirmed: true,
                        blocked: false,
                        provider: 'local'
                    };

                    if (!user) {
                        await strapi.query('plugin::users-permissions.user').create({ data: finalData });
                        console.log(` EduMaster Created "${uData.username}"`);
                    } else {
                        await strapi.query('plugin::users-permissions.user').update({
                            where: { id: user.id },
                            data: finalData
                        });
                        console.log(` EduMaster Updated "${uData.username}"`);
                    }
                }

                console.log(' EduMaster BOOTSTRAP COMPLETE.');
            }
        } catch (err: any) {
            console.error(' EduMaster BOOTSTRAP ERROR:', err.message);
            if (err.stack) console.error(err.stack);
        }
    },
};
