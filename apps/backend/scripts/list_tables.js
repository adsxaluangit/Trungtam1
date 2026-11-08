const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function listTables() {
    try {
        await client.connect();
        console.log('Connected to database');

        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log('Tables in public schema:');
        res.rows.forEach(row => console.log(row.table_name));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

listTables();
