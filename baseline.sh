#!/bin/bash
set -e

# Load environment variables
set -a
source .env.local
set +a

rm -rf public/visual-diff

#APP=baseline npx playwright test tests/visual-regression.spec.js

URLS_FILE=urls-local.json APP=baseline npx playwright test tests/visual-regression.spec.js --project=webkit-desktop --project=iphone-14-pro-max