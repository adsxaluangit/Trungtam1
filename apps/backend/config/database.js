module.exports = ({ env }) => ({
    connection: {
        client: 'postgres',
        connection: {
            connectionString: env('DATABASE_URL'),
            host: env('DATABASE_HOST', 'localhost'),
            port: env.int('DATABASE_PORT', 5432),
            database: env('DATABASE_NAME', 'edumaster'),
            user: env('DATABASE_USERNAME', 'postgres'),
            password: env('DATABASE_PASSWORD', '123456'),
            schema: env('DATABASE_SCHEMA', 'public'), // Not required
            ssl: env.bool('DATABASE_SSL', false) && {
                rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false), // For self-signed certificates
            },
        },
        pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
        debug: false,
    },
});