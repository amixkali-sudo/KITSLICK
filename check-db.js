const db = require('./db');

// Check if there are any snaps in the database
const allSnaps = db.getAllSnaps();
console.log('All snaps in database:', allSnaps);

// Check if there are any users
const allUsers = db.prepare('SELECT * FROM users').all();
console.log('All users in database:', allUsers);
