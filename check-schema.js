// check-schema.js
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'snapchat.db');
const db = new Database(dbPath, { readonly: true });

console.log('Database schema verification');
console.log('===========================');

// Get list of tables
const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
).all();

console.log('\nTables in database:');
console.log('------------------');
tables.forEach(table => {
    console.log(`\nTable: ${table.name}`);
    console.log('Columns:');
    try {
        const columns = db.pragma(`table_info(${table.name})`);
        columns.forEach(col => {
            console.log(`  ${col.name} (${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''})`);
        });
        
        // Show indexes for the table
        const indexes = db.prepare(
            "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=?"
        ).all(table.name);
        
        if (indexes.length > 0) {
            console.log('\n  Indexes:');
            indexes.forEach(idx => {
                console.log(`    ${idx.name}: ${idx.sql}`);
            });
        }
        
        // Show foreign key constraints
        if (table.name !== 'sqlite_sequence') {
            const fkInfo = db.pragma(`foreign_key_list(${table.name})`);
            if (fkInfo.length > 0) {
                console.log('\n  Foreign Keys:');
                fkInfo.forEach(fk => {
                    console.log(`    ${fk.from} -> ${fk.table}.${fk.to} (on update: ${fk.on_update}, on delete: ${fk.on_delete})`);
                });
            }
        }
    } catch (error) {
        console.error(`  Error getting schema for ${table.name}:`, error.message);
    }
});

// Close the database connection
db.close();
