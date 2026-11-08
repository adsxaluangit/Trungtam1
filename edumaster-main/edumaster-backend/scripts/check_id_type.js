const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function checkSchema() {
    try {
        await client.connect();

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'classes' AND column_name = 'id';
    `);

        console.log('Classes ID type:', res.rows[0]);

        const res2 = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns
        WHERE table_name = 'subjects' AND column_name = 'id';
      `);

        console.log('Subjects ID type:', res2.rows[0]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
