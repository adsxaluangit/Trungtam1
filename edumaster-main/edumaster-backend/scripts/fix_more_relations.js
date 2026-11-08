const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function fixRelations() {
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Fix student_documents_student_lnk
        console.log('Creating student_documents_student_lnk table...');
        // Note: link table naming convention: singularName_attributeName_lnk
        // student-document -> student_documents
        // attribute: student (in student-document schema)
        // So likely: student_documents_student_lnk

        await client.query(`
      CREATE TABLE IF NOT EXISTS student_documents_student_lnk (
        id SERIAL PRIMARY KEY,
        student_document_id VARCHAR(255) REFERENCES student_documents(id) ON DELETE CASCADE,
        student_id VARCHAR(255) REFERENCES students(id) ON DELETE CASCADE,
        student_document_order FLOAT,
        student_order FLOAT
      );
    `);

        // Migrate data from student_documents (student_id column)
        const checkStudDocs = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'student_documents' AND column_name = 'student_id';
    `);

        if (checkStudDocs.rowCount > 0) {
            console.log('Migrating student_documents data...');
            const resStud = await client.query(`
            INSERT INTO student_documents_student_lnk (student_document_id, student_id)
            SELECT id, student_id FROM student_documents 
            WHERE student_id IS NOT NULL
            ON CONFLICT DO NOTHING;
        `);
            console.log(`Migrated ${resStud.rowCount} rows to student_documents_student_lnk.`);
        }

        // 2. Fix teachers_subjects_lnk
        console.log('Creating teachers_subjects_lnk table...');
        // teacher (teachers) -> subjects (manyToMany)
        // Table name: teachers_subjects_lnk (alphabetical? t vs s? or source -> target?)
        // Usually source_attribute_lnk -> teachers_subjects_lnk

        await client.query(`
      CREATE TABLE IF NOT EXISTS teachers_subjects_lnk (
        id SERIAL PRIMARY KEY,
        teacher_id VARCHAR(255) REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id VARCHAR(255) REFERENCES subjects(id) ON DELETE CASCADE,
        teacher_order FLOAT,
        subject_order FLOAT
      );
    `);

        // Migrate from teacher_subjects
        const checkTeachSubj = await client.query(`
        SELECT to_regclass('public.teacher_subjects');
    `);

        if (checkTeachSubj.rows[0].to_regclass) {
            console.log('Migrating teacher_subjects data...');
            const resTeach = await client.query(`
            INSERT INTO teachers_subjects_lnk (teacher_id, subject_id)
            SELECT teacher_id, subject_id FROM teacher_subjects
            ON CONFLICT DO NOTHING;
        `);
            console.log(`Migrated ${resTeach.rowCount} rows to teachers_subjects_lnk.`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixRelations();
