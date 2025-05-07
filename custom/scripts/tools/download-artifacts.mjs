// This script downloads artifacts from a GitHub Actions workflow run.
// It requires the run ID and a GitHub token as command line arguments.
// It uses the Octokit library to interact with the GitHub API.
// The artifacts are saved in a directory named 'artifacts-downloaded'.
// The script creates the directory if it does not exist.

import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const runId = process.argv[2];
const githubToken = process.argv[3];

if (!runId || !githubToken) {
    console.log("Usage: node download-artifacts.mjs <run_id> <github_token>");
    process.exit(1);
}

const octokit = new Octokit({
    auth: githubToken
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../../../');
const artifactsDir = path.join(rootDir, 'artifacts-downloaded');

async function downloadArtifacts() {
    fs.mkdirSync(artifactsDir, { recursive: true });

    console.log(`Downloading artifacts for run ${runId}...`);

    const artifacts = await octokit.actions.listWorkflowRunArtifacts({
        owner: "uts-itd",
        repo: "Playwright",
        run_id: runId
    });

    for (const artifact of artifacts.data.artifacts) {
        console.log(`Downloading ${artifact.name}...`);
        const download = await octokit.actions.downloadArtifact({
            owner: "uts-itd",
            repo: "Playwright",
            artifact_id: artifact.id,
            archive_format: 'zip'
        });

        const artifactPath = path.join(artifactsDir, `${artifact.name}.zip`);
        fs.writeFileSync(artifactPath, Buffer.from(download.data));
    }

    console.log(`Download complete! Files saved in ${artifactsDir}`);
}

downloadArtifacts();
