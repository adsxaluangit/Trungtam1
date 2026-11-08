const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'edumaster',
    password: '123456',
    port: 5432,
});

async function debugData() {
    try {
        await client.connect();

        const classesCount = await client.query('SELECT count(*) FROM classes');
        console.log('Classes count:', classesCount.rows[0].count);

        const linksCount = await client.query('SELECT count(*) FROM class_subjects');
        console.log('Class_subjects count:', linksCount.rows[0].count);

        if (parseInt(linksCount.rows[0].count) > 0) {
            const links = await client.query('SELECT * FROM class_subjects LIMIT 20');
            console.log('Sample class_subjects:', links.rows);
        }

        if (parseInt(classesCount.rows[0].count) > 0) {
            const classes = await client.query('SELECT id, code FROM classes LIMIT 20');
            console.log('Sample classes:', classes.rows);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

debugData();
