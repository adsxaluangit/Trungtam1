const { Client } = require('pg');
require('dotenv').config({ path: '../.env' }); // Load env vars

// Database config from env
const dbConfig = {
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '123456',
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
};

const createEdumasterDb = async () => {
    const client = new Client({ ...dbConfig, database: 'postgres' });
    try {
        await client.connect();
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'edumaster'");
        if (res.rowCount === 0) {
            await client.query('CREATE DATABASE edumaster');
            console.log("Database 'edumaster' created.");
        } else {
            console.log("Database 'edumaster' already exists.");
        }
    } catch (err) {
        console.error('Error checking/creating database:', err);
    } finally {
        await client.end();
    }
};

const createTables = async () => {
    const client = new Client({ ...dbConfig, database: 'edumaster' });
    try {
        await client.connect();

        // Nations
        await client.query(`
            CREATE TABLE IF NOT EXISTS nations (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                abbr VARCHAR(50),
                status VARCHAR(50),
                created_at VARCHAR(50)
            );
        `);

        // Suppliers
        await client.query(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                tax_id VARCHAR(50),
                phone VARCHAR(50),
                email VARCHAR(255),
                address TEXT,
                status VARCHAR(50),
                created_at VARCHAR(50)
            );
        `);

        // Classrooms
        await client.query(`
            CREATE TABLE IF NOT EXISTS classrooms (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                capacity INT,
                building VARCHAR(100),
                status VARCHAR(50),
                created_at VARCHAR(50)
            );
        `);

        // Subjects
        await client.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                sessions INT,
                total_hours INT,
                theory_hours INT,
                practice_hours INT,
                exercise_hours INT,
                exam_hours INT,
                notes TEXT,
                created_at VARCHAR(50)
            );
        `);

        // Teachers
        await client.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                specialization VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(255)
            );
        `);

        // Teacher Subjects (Many-to-Many)
        await client.query(`
            CREATE TABLE IF NOT EXISTS teacher_subjects (
                teacher_id VARCHAR(50) REFERENCES teachers(id),
                subject_id VARCHAR(50) REFERENCES subjects(id),
                PRIMARY KEY (teacher_id, subject_id)
            );
        `);

        // Classes
        await client.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id VARCHAR(50) PRIMARY KEY,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                notes TEXT,
                status VARCHAR(50),
                start_date VARCHAR(50),
                end_date VARCHAR(50),
                student_count INT DEFAULT 0,
                created_at VARCHAR(50)
            );
        `);

        // Class Subjects (Many-to-Many)
        await client.query(`
            CREATE TABLE IF NOT EXISTS class_subjects (
                class_id VARCHAR(50) REFERENCES classes(id),
                subject_id VARCHAR(50) REFERENCES subjects(id),
                PRIMARY KEY (class_id, subject_id)
            );
        `);

        // Students
        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id VARCHAR(50) PRIMARY KEY,
                stt INT,
                "group" VARCHAR(100),
                class_code VARCHAR(50), -- Loose relationship as per mock data, or FK if codes match
                class_name VARCHAR(255),
                card_number VARCHAR(50),
                student_code VARCHAR(50) UNIQUE,
                id_number VARCHAR(50),
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                full_name VARCHAR(255),
                gender VARCHAR(20),
                dob VARCHAR(50),
                pob VARCHAR(255),
                ethnicity VARCHAR(50),
                nationality VARCHAR(100),
                company VARCHAR(255),
                address TEXT,
                score VARCHAR(50),
                photo TEXT
            );
        `);

        // Student Documents
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_documents (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                url TEXT,
                date VARCHAR(50),
                type VARCHAR(50),
                student_id VARCHAR(50) REFERENCES students(id)
            );
        `);

        console.log("Tables created successfully.");

    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await client.end();
    }
};

(async () => {
    await createEdumasterDb();
    await createTables();
})();
