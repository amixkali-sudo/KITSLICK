// migrations/001_initial_schema.js
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../snapchat.db');
const db = new Database(dbPath);

console.log('Running database migration: Initial schema setup');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create a migrations table to track which migrations have been run
db.prepare(`
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Check if this migration has already been run
const migrationName = '001_initial_schema';
const migrationRun = db.prepare('SELECT 1 FROM migrations WHERE name = ?').get(migrationName);

if (!migrationRun) {
    console.log('Running migration:', migrationName);
    
    // Wrap in a transaction for safety
    const runMigration = db.transaction(() => {
        // Create users table if it doesn't exist
        db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Add posted_by column to snaps if it doesn't exist
        try {
            // This will throw if the column already exists
            db.prepare('ALTER TABLE snaps ADD COLUMN posted_by INTEGER REFERENCES users(id)').run();
            console.log('Added posted_by column to snaps table');
        } catch (error) {
            if (!error.message.includes('duplicate column name')) {
                throw error; // Re-throw if it's not a "column already exists" error
            }
            console.log('posted_by column already exists');
        }

        // Insert a default user for existing snaps if no users exist
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        if (userCount === 0) {
            console.log('Creating default user for existing snaps');
            const result = db.prepare('INSERT INTO users (username) VALUES (?)').run('anonymous');
            const defaultUserId = result.lastInsertRowid;
            
            // Update existing snaps to use the default user
            db.prepare('UPDATE snaps SET posted_by = ? WHERE posted_by IS NULL').run(defaultUserId);
        }

        // Record that this migration has been run
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
        
        console.log('Migration completed successfully');
    });

    try {
        runMigration();
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
} else {
    console.log('Migration already run:', migrationName);
}

// Close the database connection
db.close();
