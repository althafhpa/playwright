// This script is to trace the artifacts downloaded from GitHub Actions.
// It downloads the artifacts, extracts them, and handles nested trace.zip files.
// It requires the run ID and a GitHub token as command line arguments.

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const glob = require('glob');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
    .option('run-id', {
        description: 'GitHub Actions run ID',
        required: true
    })
    .option('token', {
        description: 'GitHub token',
        required: true
    })
    .argv;

const API_URL = "https://api.github.com";
const OWNER = "uts-itd";
const REPO = "Playwright";

async function downloadTraces() {
    const outputDir = './trace-download';
    fs.mkdirSync(outputDir, { recursive: true });

    const artifactsUrl = `${API_URL}/repos/${OWNER}/${REPO}/actions/runs/${argv.runId}/artifacts`;
    console.log(`Fetching artifacts from: ${artifactsUrl}`);
    
    const response = await axios.get(artifactsUrl, {
        headers: {
            "Authorization": `Bearer ${argv.token}`,
            "Accept": "application/vnd.github.v3+json"
        }
    });

    console.log(`Found ${response.data.artifacts.length} artifacts`);

    // Download all artifacts
    for (const artifact of response.data.artifacts) {
        console.log(`Downloading artifact: ${artifact.name}`);
        const downloadUrl = artifact.archive_download_url;
        const response = await axios.get(downloadUrl, {
            headers: {
                "Authorization": `Bearer ${argv.token}`,
                "Accept": "application/vnd.github.v3+json"
            },
            responseType: 'arraybuffer'
        });
        const filePath = path.join(outputDir, `${artifact.name}.zip`);
        fs.writeFileSync(filePath, response.data);
        console.log(`Downloaded to: $custom/scripts/tools/trace-artifacts.js`);
    }
}function extractTraces() {
    const traceDir = './traces';
    fs.mkdirSync(traceDir, { recursive: true });

    const zipFiles = glob.sync('./trace-download/*.zip');
    console.log(`Found ${zipFiles.length} trace zip files to extract`);

    zipFiles.forEach(zipFile => {
        console.log(`Extracting: ${zipFile}`);
        const zip = new AdmZip(zipFile);
        zip.extractAllTo(traceDir, true);

        // Handle nested trace.zip files
        const entries = zip.getEntries();
        entries.forEach(entry => {
            if (entry.entryName.includes('trace.zip')) {
                console.log(`Found nested trace: ${entry.entryName}`);
                const nestedZip = new AdmZip(entry.getData());
                const nestedPath = path.join(traceDir, path.basename(entry.entryName, '.zip'));
                nestedZip.extractAllTo(nestedPath, true);
            }
        });
    });
}

async function listWorkflowRuns() {
    const runsUrl = `${API_URL}/repos/${OWNER}/${REPO}/actions/runs`;
    const response = await axios.get(runsUrl, {
        headers: {
            "Authorization": `Bearer ${argv.token}`,
            "Accept": "application/vnd.github.v3+json"
        }
    });
    console.log('Available runs:', response.data.workflow_runs.map(run => run.id));
}

async function main() {
    console.log('Listing available workflow runs...');
    await listWorkflowRuns();
    console.log('Starting trace download...');
    await downloadTraces();
    console.log('Extracting traces...');
    extractTraces();
    console.log('Trace processing complete!');
}
main().catch(console.error);