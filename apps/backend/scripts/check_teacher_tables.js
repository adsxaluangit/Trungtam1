const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function checkTeacherTables() {
    try {
        await client.connect();

        // Check teachers ID type
        const teacherId = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'teachers' AND column_name = 'id';
    `);
        console.log('Teachers ID type:', teacherId.rows[0]);

        // Check teacher_subjects columns
        const linkCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns
        WHERE table_name = 'teacher_subjects';
    `);
        console.log('Teacher_subjects columns:');
        linkCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        // Check if new link table exists
        // Strapi naming: teachers_subjects_lnk (probably)
        const linkTable = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'teachers_subjects_lnk';
    `);
        console.log('New Teacher Link table exists:', linkTable.rowCount > 0);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkTeacherTables();
