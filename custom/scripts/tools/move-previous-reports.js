// This script moves existing visual-diff reports to a another directory previous-reports.
const fs = require('fs');
const path = require('path');
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

function moveVisualDiffReport() {
    const publicDir = path.join(process.cwd(), REPORTS_ROOT_DIR);
    const previousReportsDir = path.join(publicDir, 'previous-reports');
    const visualDiffDir = path.join(publicDir, 'visual-diff');

    // Create previous-reports directory if it doesn't exist
    fs.mkdirSync(previousReportsDir, { recursive: true });

    // Get the next report number
    let nextNumber = 1;
    if (fs.existsSync(previousReportsDir)) {
        const existingReports = fs.readdirSync(previousReportsDir);
        const numbers = existingReports.map(name => parseInt(name)).filter(num => !isNaN(num));
        nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    }

    // Create new versioned directory
    const versionedDir = path.join(previousReportsDir, nextNumber.toString(), 'visual-diff');
    fs.mkdirSync(path.dirname(versionedDir), { recursive: true });

    // Move existing report if it exists
    if (fs.existsSync(visualDiffDir)) {
        fs.renameSync(visualDiffDir, versionedDir);
        fs.mkdirSync(visualDiffDir, { recursive: true });
        console.log(`Moved visual-diff report to version ${nextNumber}`);
    } else {
        console.log('No visual-diff report found to move');
    }

    return nextNumber;
}

moveVisualDiffReport();
