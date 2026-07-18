const fs = require('fs');
const path = require('path');

const backupDir = __dirname;
const backupFilePath = path.join(backupDir, 'env-backup.json');

if (!fs.existsSync(backupFilePath)) {
  console.error('env-backup.json not found!');
  process.exit(1);
}

const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

Object.keys(backupData).forEach(file => {
  const filePath = path.join(backupDir, file);
  const fileBuffer = Buffer.from(backupData[file], 'base64');
  fs.writeFileSync(filePath, fileBuffer);
  console.log(`Restored file: ${file}`);
});

console.log('All env files successfully restored!');
