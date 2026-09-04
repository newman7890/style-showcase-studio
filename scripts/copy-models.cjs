const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../node_modules/@imgly/background-removal-data/dist');
const destDir = path.resolve(__dirname, '../public/imgly-data');

if (!fs.existsSync(srcDir)) {
  console.log('[copy-models] Source data directory not found in node_modules, skipping.');
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log('[copy-models] Copying AI background removal model files to public/imgly-data...');
const files = fs.readdirSync(srcDir);
let count = 0;

for (const file of files) {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(destDir, file);
  
  // Only copy if file doesn't exist or size is different
  if (!fs.existsSync(destFile) || fs.statSync(srcFile).size !== fs.statSync(destFile).size) {
    fs.copyFileSync(srcFile, destFile);
    count++;
  }
}

console.log(`[copy-models] Copied/Verified ${files.length} model assets (${count} updated) to public/imgly-data.`);
