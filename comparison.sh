#!/bin/bash
set -e

# Load environment variables
set -a
source .env.local
set +a

#APP=comparison npx playwright test tests/visual-regression.spec.js

APP=comparison npx playwright test tests/visual-regression.spec.js --project=webkit-desktop --project=iphone-14-pro-max