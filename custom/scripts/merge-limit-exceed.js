const fs = require('fs');
const path = require('path');
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

// Read all page-limit-exceed files from visual-diff directory
const reportsDir = path.join(REPORTS_ROOT_DIR, 'visual-diff');
const limitExceedFiles = fs.readdirSync(reportsDir)
    .filter(file => file.startsWith('page-limit-exceed-') && file.endsWith('.json'));

// Combine all limit exceed data
const combinedData = [];
limitExceedFiles.forEach(file => {
    const filePath = path.join(reportsDir, file);
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    combinedData.push(fileData);
});

// Write combined data to final json
const outputPath = path.join(reportsDir, 'page-limit-exceed.json');
fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2));

console.log(`Merged ${limitExceedFiles.length} limit exceed files into ${outputPath}`);
