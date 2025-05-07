const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import the existing config file
const config = require('../../config.js');

function mergeTraces() {
    const tracesDir = path.join(process.cwd(), 'test-results');
    console.log('Looking for traces in:', tracesDir);
    
    const traceFiles = glob.sync(path.join(tracesDir, '**/trace.zip'));
    console.log('Found trace files:', traceFiles);

    if (traceFiles.length === 0) {
        console.log('No trace files found');
        return;
    }

    // Create output directory
    const mergedTracesDir = path.join(process.cwd(), REPORTS_ROOT_DIR, 'traces');
    fs.mkdirSync(mergedTracesDir, { recursive: true });

    // Copy and rename traces with context
    traceFiles.forEach(traceFile => {
        const contextPath = path.relative(tracesDir, traceFile);
        const newName = contextPath.replace(/\//g, '-');
        const targetPath = path.join(mergedTracesDir, newName);
        
        fs.copyFileSync(traceFile, targetPath);
        console.log(`Copied trace: ${newName}`);
    });

    console.log(`Merged ${traceFiles.length} trace files into ${REPORTS_ROOT_DIR}/traces`);
}

mergeTraces();
