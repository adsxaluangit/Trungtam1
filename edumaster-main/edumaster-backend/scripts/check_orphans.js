const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function checkOrphans() {
    try {
        await client.connect();
        console.log('Connected to database');

        // Check classes orphans
        // Assuming class_id in class_subjects maps to id in classes (or maybe code?)
        // Let's check classes table first to see what the PK is.
        // But usually id is the PK in Strapi.

        // Let's enable checking columns of classes first
        const classesCols = await client.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'classes'
    `);
        console.log('Classes columns:', classesCols.rows.map(r => r.column_name).join(', '));

        const orphansClass = await client.query(`
      SELECT * FROM class_subjects 
      WHERE class_id NOT IN (SELECT CAST(id AS VARCHAR) FROM classes); 
    `);
        // Note: cast id to varchar if class_id is varchar as seen in previous step

        console.log(`Found ${orphansClass.rowCount} orphan rows in class_subjects (invalid class_id)`);
        if (orphansClass.rowCount > 0) {
            console.log('Sample orphans:', orphansClass.rows.slice(0, 5));
        }


        const orphansSubject = await client.query(`
        SELECT * FROM class_subjects 
        WHERE subject_id NOT IN (SELECT CAST(id AS VARCHAR) FROM subjects);
      `);

        console.log(`Found ${orphansSubject.rowCount} orphan rows in class_subjects (invalid subject_id)`);
        if (orphansSubject.rowCount > 0) {
            console.log('Sample orphans:', orphansSubject.rows.slice(0, 5));
        }


    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkOrphans();
