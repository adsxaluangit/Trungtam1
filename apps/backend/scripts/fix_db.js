const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456', // Hardcoded from .env for simplicity in this one-off script
    port: 5432,
});

async function fixDatabase() {
    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      DELETE FROM classes_subjects_lnk 
      WHERE school_class_id NOT IN (SELECT id FROM classes);
    `);

        console.log(`Deleted ${res.rowCount} orphan rows from classes_subjects_lnk`);

        // Also check for the reverse relationship just in case
        const res2 = await client.query(`
      DELETE FROM classes_subjects_lnk 
      WHERE subject_id NOT IN (SELECT id FROM subjects);
    `);

        console.log(`Deleted ${res2.rowCount} orphan rows from classes_subjects_lnk (invalid subjects)`);

    } catch (err) {
        console.error('Error executing fix:', err);
    } finally {
        await client.end();
        console.log('Disconnected from database');
    }
}

fixDatabase();
