const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

function mergeTestResults() {
    const visualDiffDir = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff');
    console.log(`Looking for test result files in: ${visualDiffDir}`);
    
    // List all files in the directory to see what's available
    try {
        if (fs.existsSync(visualDiffDir)) {
            console.log('Directory contents:');
            const files = fs.readdirSync(visualDiffDir);
            files.forEach(file => {
                console.log(`- ${file}`);
            });
        } else {
            console.log(`Directory ${visualDiffDir} does not exist`);
            // Create the directory if it doesn't exist
            fs.mkdirSync(visualDiffDir, { recursive: true });
            console.log(`Created directory ${visualDiffDir}`);
        }
    } catch (error) {
        console.error(`Error reading directory: ${error.message}`);
    }
    
    const resultFiles = glob.sync(path.join(visualDiffDir, 'test-results-*.json'));
    console.log(`Found ${resultFiles.length} test result files matching pattern 'test-results-*.json'`);
    
    if (resultFiles.length === 0) {
        console.log('No test result files found. Creating empty results file.');
        // Create an empty results file to prevent downstream errors
        const emptyResults = {
            testId: Date.now(),
            testTypeId: "VRT001",
            testDate: new Date().toISOString(),
            results: []
        };
        fs.writeFileSync(
            path.join(visualDiffDir, 'test-results.json'),
            JSON.stringify(emptyResults, null, 2)
        );
        console.log('Created empty test-results.json file');
        return;
    }
    
    // Log the files that will be merged
    console.log('Files to be merged:');
    resultFiles.forEach(file => {
        console.log(`- ${file}`);
    });

    try {
        // Read the first file to get the base structure
        console.log(`Reading base file: ${resultFiles[0]}`);
        const baseResults = JSON.parse(fs.readFileSync(resultFiles[0], 'utf8'));
        console.log(`Base file contains ${baseResults.results ? baseResults.results.length : 0} results`);
        
        const mergedResults = {
            testId: baseResults.testId,
            testTypeId: baseResults.testTypeId,
            testDate: baseResults.testDate,
            results: [...(baseResults.results || [])]
        };

        // Merge results from other files
        let totalResults = mergedResults.results.length;
        for (let i = 1; i < resultFiles.length; i++) {
            console.log(`Reading file ${i+1}/${resultFiles.length}: ${resultFiles[i]}`);
            const fileContent = JSON.parse(fs.readFileSync(resultFiles[i], 'utf8'));
            const fileResults = fileContent.results || [];
            console.log(`File contains ${fileResults.length} results`);
            mergedResults.results.push(...fileResults);
            totalResults += fileResults.length;
        }

        // Write merged results
        const outputPath = path.join(visualDiffDir, 'test-results.json');
        console.log(`Writing merged results with ${totalResults} total items to: ${outputPath}`);
        fs.writeFileSync(
            outputPath,
            JSON.stringify(mergedResults, null, 2)
        );

        console.log(`Successfully merged ${resultFiles.length} result files into test-results.json`);
    } catch (error) {
        console.error(`Error during merge process: ${error.message}`);
        console.error(error.stack);
        
        // Create a minimal valid file to prevent downstream errors
        const fallbackResults = {
            testId: Date.now(),
            testTypeId: "VRT001",
            testDate: new Date().toISOString(),
            results: []
        };
        
        try {
            fs.writeFileSync(
                path.join(visualDiffDir, 'test-results.json'),
                JSON.stringify(fallbackResults, null, 2)
            );
            console.log('Created fallback test-results.json file after error');
        } catch (writeError) {
            console.error(`Failed to create fallback file: ${writeError.message}`);
        }
    }
}

mergeTestResults();
