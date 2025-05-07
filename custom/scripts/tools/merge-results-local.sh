#!/bin/bash
set -e

# Load environment variables
set -a
source .env
source .env.local
set +a

# Clean up existing directories
rm -rf artifacts public/visual-diff

# Download and extract artifacts
#node custom/scripts/tools/download-artifacts.mjs

node custom/scripts/tools/extract-artifacts.mjs

# Move test results to artifacts directory with recursive copy
for dir in artifacts-downloaded/extracted/reports-runner-*; do
    dirname=$(basename $dir)
    mkdir -p artifacts/$dirname
    cp -r $dir/* artifacts/$dirname/
done

# Copy to public/visual-diff
mkdir -p public/visual-diff
cp -r artifacts/*/* public/visual-diff/

# Run merge-results.js
node custom/scripts/merge-results.js
