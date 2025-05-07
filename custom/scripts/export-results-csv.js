const fs = require('fs');
const path = require('path');
const config = require('../../config');

/**
 * Exports visual regression test results to CSV format
 * 
 * This script reads the test results from the JSON file and exports them to a CSV file
 * with all relevant information for analysis.
 */

// Configuration
const REPORTS_ROOT_DIR = config.reporting.rootDir;
const INPUT_FILE = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff', 'test-results.json');
const OUTPUT_FILE = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff', 'test-results.csv');

// CSV column headers
const CSV_HEADERS = [
  'Test ID',
  'Test Name',
  'Device',
  'Browser',
  'Viewport',
  'Similarity (%)',
  'Calculated Similarity (%)',
  'Baseline Status',
  'Comparison Status',
  'Baseline URL',
  'Comparison URL',
  'Test Date'
];

/**
 * Escapes special characters in CSV fields
 * @param {string} field - The field to escape
 * @returns {string} - The escaped field
 */
function escapeCSV(field) {
  if (field === null || field === undefined) {
    return '';
  }
  
  // Convert to string
  const str = String(field);
  
  // If the field contains commas, quotes, or newlines, wrap it in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Double up any quotes
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Converts test results to CSV format
 * @param {Object} jsonData - The test results data
 * @returns {string} - CSV formatted string
 */
function convertToCSV(jsonData) {
  // Start with headers
  let csvContent = CSV_HEADERS.join(',') + '\n';
  
  // Add each result as a row
  jsonData.results.forEach(result => {
    const row = [
      jsonData.testId,
      result.testName,
      result.device,
      result.browser,
      result.viewport,
      result.similarity,
      result.calculatedSimilarity || result.similarity,
      result.baseline_status,
      result.comparison_status,
      result.baselineUrl,
      result.comparisonUrl,
      jsonData.testDate
    ].map(escapeCSV);
    
    csvContent += row.join(',') + '\n';
  });
  
  return csvContent;
}

/**
 * Main function to export results to CSV
 */
function exportResultsToCSV() {
  try {
    console.log(`Reading test results from: ${INPUT_FILE}`);
    
    // Check if input file exists
    if (!fs.existsSync(INPUT_FILE)) {
      console.error(`Error: Input file not found at ${INPUT_FILE}`);
      process.exit(1);
    }
    
    // Read and parse the JSON file
    const jsonData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    
    // Validate the data structure
    if (!jsonData.results || !Array.isArray(jsonData.results)) {
      console.error('Error: Invalid test results format. Expected an object with a "results" array.');
      process.exit(1);
    }
    
    console.log(`Found ${jsonData.results.length} test results to export.`);
    
    // Convert to CSV
    const csvContent = convertToCSV(jsonData);
    
    // Write to output file
    fs.writeFileSync(OUTPUT_FILE, csvContent);
    
    console.log(`Successfully exported test results to: ${OUTPUT_FILE}`);
    
    // Print some statistics
    const totalTests = jsonData.results.length;
    const passedTests = jsonData.results.filter(r => r.similarity >= config.thresholds.similarity.high).length;
    const mediumTests = jsonData.results.filter(r => r.similarity >= config.thresholds.similarity.medium && r.similarity < config.thresholds.similarity.high).length;
    const failedTests = jsonData.results.filter(r => r.similarity < config.thresholds.similarity.medium).length;
    
    console.log('\nTest Results Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed (≥${config.thresholds.similarity.high}%): ${passedTests} (${Math.round(passedTests/totalTests*100)}%)`);
    console.log(`Medium (${config.thresholds.similarity.medium}-${config.thresholds.similarity.high-1}%): ${mediumTests} (${Math.round(mediumTests/totalTests*100)}%)`);
    console.log(`Failed (<${config.thresholds.similarity.medium}%): ${failedTests} (${Math.round(failedTests/totalTests*100)}%)`);
    
  } catch (error) {
    console.error(`Error exporting results to CSV: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute the export function
exportResultsToCSV();