// run-migration.js
const { exec } = require('child_process');
const path = require('path');

console.log('Running database migrations...');

// Run the migration script
const migrationScript = path.join(__dirname, 'migrations', '001_initial_schema.js');

// Use double quotes around the path to handle spaces on Windows
const command = `node "${migrationScript}"`;
console.log('Executing command:', command);

const migrate = exec(command, { shell: true }, (error, stdout, stderr) => {
    if (error) {
        console.error('Error running migration:', error);
        process.exit(1);
    }
    
    if (stderr) {
        console.error('Migration stderr:', stderr);
    }
    
    if (stdout) {
        console.log('Migration output:', stdout);
    }
    
    console.log('Migrations completed successfully!');
});

migrate.stdout.pipe(process.stdout);
migrate.stderr.pipe(process.stderr);
