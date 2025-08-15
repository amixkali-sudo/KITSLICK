// db-pg.js - PostgreSQL database interactions
const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'snapchat_style_app',
    password: process.env.PG_PASSWORD || 'amixuser@123',
    port: process.env.PG_PORT || 5432,
});

// Test the connection
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
    } else {
        console.log('Connected to PostgreSQL database');
    }
});

// Initialize database tables
const initDb = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_login TIMESTAMPTZ,
                profile_picture_url VARCHAR(512),
                bio TEXT,
                is_active BOOLEAN DEFAULT true
            )
        `);

        // Create snaps table
        await client.query(`
            CREATE TABLE IF NOT EXISTS snaps (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                image_url VARCHAR(512) NOT NULL,
                caption TEXT,
                location VARCHAR(255),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                view_count INTEGER DEFAULT 0,
                is_public BOOLEAN DEFAULT true
            )
        `);

        // Create other tables (hashtags, likes, comments, etc.)...
        
        await client.query('COMMIT');
        console.log('Database tables initialized');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Initialize the database when this module is loaded
initDb().catch(console.error);

// Export the pool to be used in other modules
module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool,
};
