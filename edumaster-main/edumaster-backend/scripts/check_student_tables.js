const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function checkStudentTables() {
    try {
        await client.connect();

        // Check students ID type
        const studentId = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'students' AND column_name = 'id';
    `);
        console.log('Students ID type:', studentId.rows[0]);

        // Check student_documents columns
        const docCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns
        WHERE table_name = 'student_documents';
    `);
        console.log('Student_documents columns:');
        docCols.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        // Check if link table exists
        const linkTable = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'student_documents_student_lnk';
    `);
        console.log('Link table exists:', linkTable.rowCount > 0);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkStudentTables();
