// This script downloads artifacts from a GitHub Actions workflow run.
// It requires the run ID and a GitHub token as command line arguments.
// It uses the Octokit library to interact with the GitHub API.
// The artifacts are saved in a directory named 'artifacts-downloaded'.
// The script creates the directory if it does not exist.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../../../');
const artifactsDir = path.join(rootDir, 'artifacts-downloaded');
const extractDir = path.join(rootDir, 'artifacts-downloaded/extracted');

async function extractArtifacts() {
    fs.mkdirSync(extractDir, { recursive: true });

    const zipFiles = fs.readdirSync(artifactsDir).filter(file => file.endsWith('.zip'));
    console.log(`Found ${zipFiles.length} zip files to extract`);

    for (const zipFile of zipFiles) {
        const zipPath = path.join(artifactsDir, zipFile);
        const zip = new AdmZip(zipPath);
        
        const subFolder = path.join(extractDir, zipFile.replace('.zip', ''));
        fs.mkdirSync(subFolder, { recursive: true });

        console.log(`Extracting ${zipFile} to ${subFolder}`);
        zip.extractAllTo(subFolder, true);
    }

    console.log('Extraction complete!');
}

extractArtifacts();