const fs = require('fs');
const path = require('path');
const config = require('../../config.js');

// Import the existing config file
const REPORTS_ROOT_DIR = config.reporting.rootDir;

function generateCompatibilityReport() {
    try {
        const visualDiffDir = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff');
        const results = [];
        
        // Read and parse test results
        const files = fs.readdirSync(visualDiffDir)
            .filter(file => file.startsWith('test-results-') && file.endsWith('.json'));
            
        files.forEach(file => {
            const content = JSON.parse(fs.readFileSync(path.join(visualDiffDir, file), 'utf8'));
            if (Array.isArray(content.results)) {
                results.push(...content.results);
            }
        });

        // Sort results by test ID instead of testName
        results.sort((a, b) => {
            return (a.testId || '').toString().localeCompare((b.testId || '').toString());
        });

        // Generate HTML report
        const html = generateHtmlReport(results);

        // Write report to file
        const reportPath = path.join(process.cwd(), REPORTS_ROOT_DIR, 'compatibility-report.html');
        fs.writeFileSync(reportPath, html);
        console.log('Compatibility report generated successfully');

    } catch (error) {
        console.error('Error generating compatibility report:', error);
        process.exit(1);
    }
}

function generateHtmlReport(results) {
    const devices = [...new Set(results.map(r => r.device || 'Unknown'))];
    const browsers = [...new Set(results.map(r => r.browser || 'Unknown'))];
    const viewports = [...new Set(results.map(r => r.viewport || 'Unknown'))];

    return `<!DOCTYPE html>
    <html>
    <head>
        <title>Visual Regression Compatibility Report</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <style>
            .result-row { display: block; }
            .result-row.hidden { display: none; }
        </style>
    </head>
    <body class="bg-gray-100">
        <nav class="bg-white shadow-lg sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4">
                <h1 class="text-2xl font-bold py-4">Compatibility Report</h1>
            </div>
        </nav>
        
        <div class="max-w-7xl mx-auto mt-8 px-4">
            <div class="bg-white p-4 rounded-lg shadow mb-6">
                <div class="grid grid-cols-4 gap-4">
                    ${generateFilters(devices, browsers, viewports)}
                </div>
            </div>

            <div class="grid gap-6" id="resultsGrid">
                ${generateResultRows(results)}
            </div>
        </div>
        ${generateJavaScript()}
    </body>
    </html>`;
}

function generateFilters(devices, browsers, viewports) {
    return `
        <div>
            <h3 class="font-semibold mb-2">Devices</h3>
            <div id="deviceFilters" class="space-y-2">
                ${devices.map(device => `
                    <label class="flex items-center">
                        <input type="checkbox" value="${device}" checked class="mr-2 device-filter">
                        ${device}
                    </label>
                `).join('')}
            </div>
        </div>
        <div>
            <h3 class="font-semibold mb-2">Browsers</h3>
            <div id="browserFilters" class="space-y-2">
                ${browsers.map(browser => `
                    <label class="flex items-center">
                        <input type="checkbox" value="${browser}" checked class="mr-2 browser-filter">
                        ${browser}
                    </label>
                `).join('')}
            </div>
        </div>
        <div>
            <h3 class="font-semibold mb-2">Viewports</h3>
            <div id="viewportFilters" class="space-y-2">
                ${viewports.map(viewport => `
                    <label class="flex items-center">
                        <input type="checkbox" value="${viewport}" checked class="mr-2 viewport-filter">
                        ${viewport}
                    </label>
                `).join('')}
            </div>
        </div>
        <div>
            <button onclick="selectAll(true)" class="bg-blue-500 text-white px-4 py-2 rounded mb-2 w-full">Select All</button>
            <button onclick="selectAll(false)" class="bg-gray-500 text-white px-4 py-2 rounded w-full">Clear All</button>
        </div>`;
}

function generateResultRows(results) {
    return results.map(result => `
        <div class="bg-white rounded-lg shadow overflow-hidden result-row"
             data-device="${result.device}"
             data-browser="${result.browser}"
             data-viewport="${result.viewport}"
             data-test-name="${result.testName}">
            <div class="p-4">
                <h3 class="text-lg font-semibold">${result.testName}</h3>
                <div class="grid grid-cols-3 gap-4 mt-4">
                    <div class="text-sm">
                        <p class="font-medium">Device: ${result.device}</p>
                        <p>Browser: ${result.browser}</p>
                        <p>Viewport: ${result.viewport}</p>
                        <p>Similarity: ${result.similarity}%</p>
                    </div>
                    <div>
                        <img src="${result.baselinePath}" alt="Baseline" class="w-full">
                        <p class="text-center mt-2 text-sm">Baseline</p>
                    </div>
                    <div>
                        <img src="${result.comparisonPath}" alt="Current" class="w-full">
                        <p class="text-center mt-2 text-sm">Current</p>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function generateJavaScript() {
    return `
        <script>
        function selectAll(checked) {
            document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.checked = checked;
            });
            applyFilters();
        }

        function applyFilters() {
            const selectedDevices = [...document.querySelectorAll('.device-filter:checked')].map(cb => cb.value);
            const selectedBrowsers = [...document.querySelectorAll('.browser-filter:checked')].map(cb => cb.value);
            const selectedViewports = [...document.querySelectorAll('.viewport-filter:checked')].map(cb => cb.value);

            document.querySelectorAll('.result-row').forEach(row => {
                const device = row.getAttribute('data-device');
                const browser = row.getAttribute('data-browser');
                const viewport = row.getAttribute('data-viewport');

                const isVisible = selectedDevices.includes(device) &&
                                selectedBrowsers.includes(browser) &&
                                selectedViewports.includes(viewport);

                row.classList.toggle('hidden', !isVisible);
            });
        }

        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', applyFilters);
        });
        </script>`;
}

generateCompatibilityReport();