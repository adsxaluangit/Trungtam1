const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function fixTable() {
    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Create table if not exists with CORRECT types (VARCHAR)
        console.log('Creating classes_subjects_lnk table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS classes_subjects_lnk (
        id SERIAL PRIMARY KEY,
        school_class_id VARCHAR(255) REFERENCES classes(id) ON DELETE CASCADE,
        subject_id VARCHAR(255) REFERENCES subjects(id) ON DELETE CASCADE,
        school_class_order FLOAT,
        subject_order FLOAT
      );
    `);

        // 2. Migrate data from class_subjects
        console.log('Migrating data from class_subjects...');
        // Check if class_subjects exists first
        const checkSource = await client.query(`
        SELECT to_regclass('public.class_subjects');
    `);

        if (checkSource.rows[0].to_regclass) {
            const res = await client.query(`
            INSERT INTO classes_subjects_lnk (school_class_id, subject_id)
            SELECT class_id, subject_id FROM class_subjects
            ON CONFLICT DO NOTHING;
        `);
            console.log(`Migrated ${res.rowCount} rows.`);
        } else {
            console.log('Source table class_subjects not found, skipping migration.');
        }

        // 3. Verify
        const verify = await client.query('SELECT count(*) FROM classes_subjects_lnk');
        console.log(`Table classes_subjects_lnk now has ${verify.rows[0].count} rows.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

fixTable();
