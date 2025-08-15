// migrations/003_fix_snaps_schema.js
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
        
        console.log('Checking and updating snaps table schema...');
        
        // Add any missing columns to snaps table
        await client.query(`
            DO $$
            BEGIN
                -- Add caption if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='snaps' AND column_name='caption') THEN
                    ALTER TABLE snaps ADD COLUMN caption TEXT;
                    RAISE NOTICE 'Added caption column to snaps table';
                END IF;
                
                -- Add location if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='snaps' AND column_name='location') THEN
                    ALTER TABLE snaps ADD COLUMN location VARCHAR(255);
                    RAISE NOTICE 'Added location column to snaps table';
                END IF;
                
                -- Add is_public if it doesn't exist
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='snaps' AND column_name='is_public') THEN
                    ALTER TABLE snaps ADD COLUMN is_public BOOLEAN DEFAULT true;
                    RAISE NOTICE 'Added is_public column to snaps table';
                END IF;
            END $$;
        `);
        
        await client.query('COMMIT');
        console.log('Snaps table schema verified and updated successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating snaps table schema:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
