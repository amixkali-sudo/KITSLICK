// migrations/004_add_image_data_to_snaps.js
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
        
        console.log('Updating snaps table to store images in database...');
        
        // Add image_data column if it doesn't exist
        await client.query(`
            DO $$
            BEGIN
                -- Add image_data column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='snaps' AND column_name='image_data') THEN
                    ALTER TABLE snaps ADD COLUMN image_data BYTEA;
                    RAISE NOTICE 'Added image_data column to snaps table';
                END IF;
                
                -- Add mime_type column
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='snaps' AND column_name='mime_type') THEN
                    ALTER TABLE snaps ADD COLUMN mime_type VARCHAR(50);
                    RAISE NOTICE 'Added mime_type column to snaps table';
                END IF;
                
                -- Set mime_type for existing images based on file extension
                UPDATE snaps 
                SET mime_type = 
                    CASE 
                        WHEN image_url LIKE '%.jpg' OR image_url LIKE '%.jpeg' THEN 'image/jpeg'
                        WHEN image_url LIKE '%.png' THEN 'image/png'
                        WHEN image_url LIKE '%.gif' THEN 'image/gif'
                        WHEN image_url LIKE '%.webp' THEN 'image/webp'
                        ELSE 'application/octet-stream'
                    END
                WHERE mime_type IS NULL;
            END $$;
        `);
        
        await client.query('COMMIT');
        console.log('Database schema updated for image storage');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating database schema:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
