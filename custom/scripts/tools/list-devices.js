// This script lists all available devices in Playwright and their configurations.
const { devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

console.log('Available predefined devices in Playwright:');
console.log('==========================================');

// Create an array to store device information
const devicesList = [];

Object.entries(devices).forEach(([name, config]) => {
  // Log to console
  console.log(`Device: ${name}`);
  console.log(`  - User Agent: ${config.userAgent.substring(0, 50)}...`);
  console.log(`  - Viewport: ${config.viewport.width}x${config.viewport.height}`);
  console.log(`  - Device Scale Factor: ${config.deviceScaleFactor || 1}`);
  console.log(`  - Mobile: ${config.isMobile || false}`);
  console.log(`  - Has Touch: ${config.hasTouch || false}`);
  console.log('');
  
  // Add to devices list
  devicesList.push({
    name,
    userAgent: config.userAgent,
    viewport: config.viewport,
    deviceScaleFactor: config.deviceScaleFactor || 1,
    isMobile: config.isMobile || false,
    hasTouch: config.hasTouch || false
  });
});

// Ensure the directory exists
const outputDir = path.join(process.cwd(), 'public', 'visual-diff');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save to JSON file
const outputPath = path.join(outputDir, 'devices.json');
fs.writeFileSync(outputPath, JSON.stringify(devicesList, null, 2));

console.log(`Device information saved to: ${outputPath}`);
console.log(`Total devices: ${devicesList.length}`);
