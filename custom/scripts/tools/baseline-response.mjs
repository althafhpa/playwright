// Not Required now
// This script checks the baseline response status for each test result in the visual-diff test results file.

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize dotenv
dotenv.config();

async function checkBaselineStatus(url) {
    try {
        const response = await fetch(url);
        return response.status;
    } catch (error) {
        console.error(`Error checking ${url}:`, error.message);
        return 500;
    }
}

async function updateResults() {
    const resultsPath = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff', 'test-results.json');
    const testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    console.log('Processing results...');
    let updatedCount = 0;
    
    for (const result of testResults.results) {
        if (result.baselineUrl) {
            console.log(`[${result.testName}] Checking baseline URL: ${result.baselineUrl}`);
            const baselineStatus = await checkBaselineStatus(result.baselineUrl);
            
            // Add baseline_response status
            result.baseline_response = baselineStatus;
            
            // Set similarity to 0 if baseline is not 200 but comparison is 200
            if (baselineStatus !== 200 && result.response_status === 200) {
                console.log(`[${result.testName}] Setting similarity to 0 (baseline: ${baselineStatus}, comparison: ${result.response_status})`);
                result.similarity = 0;
                updatedCount++;
            }

            // Log status updates
            console.log(`[${result.testName}] Updated: baseline_response=${baselineStatus}, similarity=${result.similarity}`);
        }
    }

    // Write updated results back to file with baseline_response included
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
    console.log(`Results updated successfully (${updatedCount} entries modified)`);
}

// Run the update
console.log('Starting baseline status check...');
updateResults()
    .then(() => console.log('Finished processing'))
    .catch(error => console.error('Error:', error));