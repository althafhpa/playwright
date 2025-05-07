
#!/bin/bash
set -e

# Load environment variables
set -a
source .env.local
set +a

# Commented below scripts run for parrallel tests 
# Currently used only in github workflow .yml
#node custom/scripts/merge-results.js
#node custom/scripts/merge-failed-runners.js
#node custom/scripts/merge-traces.js

node custom/scripts/check-missed-urls.js

node custom/scripts/copy-menu.js

node ./custom/scripts/generate-dashboard.js

node ./custom/scripts/generate-compatibility-report.js

node ./custom/scripts/export-results-csv.js

node custom/scripts/start-server.js