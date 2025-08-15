const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure node_modules exists
if (!fs.existsSync('node_modules')) {
  fs.mkdirSync('node_modules');
}

console.log('Installing required packages...');

const packages = [
  'uuid',
  'express',
  'bcrypt',
  'jsonwebtoken',
  'multer',
  'better-sqlite3',
  'dotenv',
  'socket.io',
  'socket.io-client'
];

let installedCount = 0;

function installNext() {
  if (installedCount >= packages.length) {
    console.log('All packages installed successfully!');
    console.log('You can now start the server with: node server.js');
    return;
  }

  const pkg = packages[installedCount];
  console.log(`Installing ${pkg}...`);
  
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const installProcess = exec(`${npm} install ${pkg} --no-save`);
  
  installProcess.stdout.on('data', (data) => {
    console.log(data.toString().trim());
  });
  
  installProcess.stderr.on('data', (data) => {
    console.error(data.toString().trim());
  });
  
  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log(`Successfully installed ${pkg}`);
      installedCount++;
      installNext();
    } else {
      console.error(`Failed to install ${pkg}`);
      process.exit(1);
    }
  });
}

// Start the installation process
installNext();
