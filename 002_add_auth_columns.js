// migrations/002_add_auth_columns.js
const { Pool } = require('pg');
require('dotenv').config();

async function runMigration() {
    const pool = new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT || 5432,
    });

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        console.log('Adding password_hash column to users table if it does not exist...');
        
        // Add password_hash column if it doesn't exist
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='users' AND column_name='password_hash') THEN
                    ALTER TABLE users ADD COLUMN password_hash TEXT;
                    UPDATE users SET password_hash = 'dummyhash' WHERE password_hash IS NULL;
                    ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
                    RAISE NOTICE 'Added password_hash column to users table';
                ELSE
                    RAISE NOTICE 'password_hash column already exists in users table';
                END IF;
            END $$;
        `);
        
        await client.query('COMMIT');
        console.log('Migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
