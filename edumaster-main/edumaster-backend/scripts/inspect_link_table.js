const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function inspectLinkTable() {
    try {
        await client.connect();

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns
      WHERE table_name = 'admin_users_roles_lnk';
    `);

        console.log('Columns in admin_users_roles_lnk:');
        res.rows.forEach(row => console.log(`${row.column_name} (${row.data_type})`));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

inspectLinkTable();
