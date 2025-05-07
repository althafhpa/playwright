// Filters URLs from a JSON file based on a range of IDs
const fs = require('fs');
const path = require('path');


const filterUrlsById = (startId, endId) => {
    // Path to source and destination files
    const sourceUrlsPath = path.join('fixtures', 'urls-full.json');
    const destUrlsPath = path.join('fixtures', 'urls.json');

    try {
        // Read the full urls-json-full.json
        const allUrls = JSON.parse(fs.readFileSync(sourceUrlsPath, 'utf8'));

        // Filter URLs by ID range
        const filteredUrls = allUrls.filter(url =>
            url.id >= startId && url.id <= endId
        );

        // Write filtered data to urls.json
        fs.writeFileSync(destUrlsPath, JSON.stringify(filteredUrls, null, 2));

        console.log(`Successfully filtered URLs with IDs ${startId} to ${endId}`);
    } catch (error) {
        console.log('Error processing URLs:', error.message);
        process.exit(1);
    }
};

// Get command line arguments
const startId = parseInt(process.argv[2]);
const endId = parseInt(process.argv[3]);

if (isNaN(startId) || isNaN(endId)) {
    console.log('Usage: node filter-urls.js <startId> <endId>');
    process.exit(1);
}

filterUrlsById(startId, endId);
