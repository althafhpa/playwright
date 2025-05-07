const fs = require('fs');
const path = require('path');
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

// Read URLs from urls.json
const urlsPath = path.join('fixtures', 'urls.json');
const urlsData = JSON.parse(fs.readFileSync(urlsPath, 'utf8'));

// Read test results
const resultsPath = path.join(REPORTS_ROOT_DIR, 'visual-diff', 'test-results.json');
const testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Get all comparison URLs from test results
const testedUrls = new Set(testResults.results.map(r => r.comparisonUrl));

// Find missed URLs
const missedUrls = urlsData.filter(url => !testedUrls.has(url.comparison));

// Generate missed URLs report
const missedUrlsReport = {
    totalUrls: urlsData.length,
    testedUrls: testedUrls.size,
    missedUrls: missedUrls.length,
    urls: missedUrls
};

// Write report
const outputPath = path.join(REPORTS_ROOT_DIR, 'visual-diff', 'missed-urls.json');
fs.writeFileSync(outputPath, JSON.stringify(missedUrlsReport, null, 2));
