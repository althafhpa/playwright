const fs = require('fs');
const path = require('path');

// Constants for URL chunking
const MIN_URLS_PER_FILE = 25;    // Minimum URLs per runner
const MAX_URLS_PER_FILE = 50;    // Maximum URLs per runner to avoid timeouts
const MAX_CONCURRENT_JOBS = 256;  // GitHub Actions max concurrent jobs limit

// Read the URLs from the main file
const urlsFilePath = path.join('fixtures', 'urls.json');
const urlsData = JSON.parse(fs.readFileSync(urlsFilePath, 'utf8'));
const totalUrls = urlsData.length;

// Calculate optimal number of files and URLs per file
let numFiles = Math.min(Math.ceil(totalUrls / MIN_URLS_PER_FILE), MAX_CONCURRENT_JOBS);
let urlsPerFile = Math.ceil(totalUrls / numFiles);

// Adjust if urlsPerFile exceeds maximum
if (urlsPerFile > MAX_URLS_PER_FILE) {
    urlsPerFile = MAX_URLS_PER_FILE;
    numFiles = Math.ceil(totalUrls / urlsPerFile);
}

// Ensure minimum URLs per file
if (urlsPerFile < MIN_URLS_PER_FILE) {
    urlsPerFile = MIN_URLS_PER_FILE;
    numFiles = Math.ceil(totalUrls / urlsPerFile);
}

console.log(`Total URLs: ${totalUrls}`);
console.log(`URLs per file: ${urlsPerFile}`);
console.log(`Number of files: ${numFiles}`);

// Create the urls directory if it does not exist
const urlsDirPath = path.join('fixtures', 'urls');
if (!fs.existsSync(urlsDirPath)) {
    fs.mkdirSync(urlsDirPath, { recursive: true });
}

// Split the URLs into chunks and write each chunk to a separate file
const chunks = [];
let remainingUrls = [...urlsData];

for (let i = 0; i < numFiles && remainingUrls.length > 0; i++) {
    const urlsChunk = remainingUrls.slice(0, urlsPerFile);

    if (urlsChunk.length >= MIN_URLS_PER_FILE || remainingUrls.length <= urlsPerFile) {
        const chunkNumber = (i + 1).toString();
        const outputFilePath = path.join(urlsDirPath, `urls-${chunkNumber}.json`);
        fs.writeFileSync(outputFilePath, JSON.stringify(urlsChunk, null, 2));
        chunks.push(chunkNumber);
    }

    remainingUrls = remainingUrls.slice(urlsPerFile);
}

// Save the chunks list for the workflow
const chunksConfig = {
    chunks: chunks
};

const configFilePath = path.join(urlsDirPath, 'chunks-config.json');
fs.writeFileSync(configFilePath, JSON.stringify(chunksConfig, null, 2));

console.log('Chunks configuration generated:');
console.log(JSON.stringify(chunksConfig, null, 2));
