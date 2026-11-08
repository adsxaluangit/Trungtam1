const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function inspectTable() {
    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'class_subjects';
    `);

        console.log('Columns in class_subjects:');
        res.rows.forEach(row => console.log(`${row.column_name} (${row.data_type})`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

inspectTable();
