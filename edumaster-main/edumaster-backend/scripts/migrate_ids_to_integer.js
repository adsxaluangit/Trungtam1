const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

// Configure migrations
const migrations = [
    {
        table: 'classes',
        refs: [
            { table: 'classes_subjects_lnk', col: 'school_class_id' }
        ]
    },
    {
        table: 'subjects',
        refs: [
            { table: 'classes_subjects_lnk', col: 'subject_id' },
            { table: 'teachers_subjects_lnk', col: 'subject_id' }
        ]
    },
    {
        table: 'students',
        refs: [
            { table: 'student_documents_student_lnk', col: 'student_id' },
            { table: 'student_documents', col: 'student_id' }
        ]
    },
    {
        table: 'teachers',
        refs: [
            { table: 'teachers_subjects_lnk', col: 'teacher_id' }
        ]
    },
    {
        table: 'student_documents',
        refs: [
            { table: 'student_documents_student_lnk', col: 'student_document_id' }
        ]
    }
];

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        await client.query('BEGIN');

        for (const m of migrations) {
            console.log(`Migrating table ${m.table}...`);

            // 1. Check if id is varchar
            try {
                const check = await client.query(`
                SELECT data_type FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'id'
            `, [m.table]);

                if (check.rows.length === 0 || check.rows[0].data_type !== 'character varying') {
                    console.log(`Skipping ${m.table}, already migrated or not varchar.`);
                    continue;
                }
            } catch (e) {
                console.log(`Table ${m.table} not found or error checking: ${e.message}`);
                continue;
            }

            // 2. Add new_id column if not exists
            console.log(`Adding new_id to ${m.table}...`);
            await client.query(`ALTER TABLE "${m.table}" ADD COLUMN IF NOT EXISTS new_id SERIAL`);

            // 3. Process References
            for (const ref of m.refs) {
                console.log(`Processing reference ${ref.table}.${ref.col}...`);

                // Check if ref table exists
                const refCheck = await client.query(`SELECT to_regclass($1::text) as exists`, [ref.table]);
                if (!refCheck.rows[0].exists) {
                    console.log(`Reference table ${ref.table} not found, skipping.`);
                    continue;
                }

                // DROP FK CONSTRAINTS first!
                const constraints = await client.query(`
                SELECT constraint_name 
                FROM information_schema.key_column_usage 
                WHERE table_name = $1 AND column_name = $2
            `, [ref.table, ref.col]);

                for (const c of constraints.rows) {
                    console.log(`Dropping constraint ${c.constraint_name} on ${ref.table}...`);
                    await client.query(`ALTER TABLE "${ref.table}" DROP CONSTRAINT "${c.constraint_name}"`);
                }

                // Update FK values
                console.log(`Updating values in ${ref.table}.${ref.col}...`);
                await client.query(`
                UPDATE "${ref.table}" r
                SET "${ref.col}" = p.new_id::text
                FROM "${m.table}" p
                WHERE r."${ref.col}" = p.id
            `);

                // Alter column type to integer
                console.log(`Altering ${ref.table}.${ref.col} to INTEGER...`);
                try {
                    // Using USING clause to cast the numeric string to integer
                    await client.query(`
                    ALTER TABLE "${ref.table}" 
                    ALTER COLUMN "${ref.col}" TYPE INTEGER USING "${ref.col}"::integer
                `);
                } catch (e) {
                    console.log(`Warning: Failed to alter ${ref.table}.${ref.col}: ${e.message}`);
                    throw e; // Fail hard here because we need it to be integer
                }
            }

            // 4. Finalize Parent Table
            console.log(`Finalizing ${m.table}...`);
            // Drop old id (cascade might drop other constraints we missed)
            await client.query(`ALTER TABLE "${m.table}" DROP COLUMN id CASCADE`);
            // Rename new_id
            await client.query(`ALTER TABLE "${m.table}" RENAME COLUMN new_id TO id`);
            // Add PK
            await client.query(`ALTER TABLE "${m.table}" ADD PRIMARY KEY (id)`);

            // Update sequence
            await client.query(`
            SELECT setval(pg_get_serial_sequence('${m.table}', 'id'), coalesce(max(id), 0) + 1, false) FROM "${m.table}";
        `);
        }

        await client.query('COMMIT');
        console.log('Migration committed successfully.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error migrating, rolled back:', err);
    } finally {
        await client.end();
    }
}

migrate();
