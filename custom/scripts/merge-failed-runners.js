const fs = require('fs');
const path = require('path');
const glob = require('glob');
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

function mergeFailedRunners() {
    const visualDiffDir = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff');
    const failedRunnerFiles = glob.sync(path.join(visualDiffDir, 'failed-runner-*.json'));

    if (failedRunnerFiles.length === 0) {
        console.log('No failed runner files found');
        return;
    }

    // Read the first file to get the base structure
    const baseResults = JSON.parse(fs.readFileSync(failedRunnerFiles[0], 'utf8'));
    const mergedFailures = {
        timestamp: new Date().toISOString(),
        totalFailures: failedRunnerFiles.length,
        failures: [baseResults]
    };

    // Merge results from other files
    for (let i = 1; i < failedRunnerFiles.length; i++) {
        const fileContent = JSON.parse(fs.readFileSync(failedRunnerFiles[i], 'utf8'));
        mergedFailures.failures.push(fileContent);
    }

    // Write merged results
    fs.writeFileSync(
        path.join(visualDiffDir, 'failed-runners.json'),
        JSON.stringify(mergedFailures, null, 2)
    );

    console.log(`Merged ${failedRunnerFiles.length} failed runner files into failed-runners.json`);
}

mergeFailedRunners();
