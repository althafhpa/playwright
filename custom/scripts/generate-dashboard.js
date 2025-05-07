const fs = require('fs');
const path = require('path');
const config = require('../../config.js');

// Use config values directly without fallbacks
const FAILURE_THRESHOLD = config.thresholds.failure;
const HIGH_SIMILARITY_THRESHOLD = config.thresholds.similarity.high;
const MEDIUM_SIMILARITY_THRESHOLD = config.thresholds.similarity.medium;
const REPORTS_ROOT_DIR = config.reporting.rootDir;

function calculateAverageSimilarity(results) {
    if (!results || !results.length) return 0;
    const total = results.reduce((sum, item) => {
        const similarity = typeof item.similarity === 'string'
            ? parseInt(item.similarity)
            : item.similarity;
        return sum + similarity;
    }, 0);
    return Math.round(total / results.length);
}

function generateResultCards(results) {
    if (!results || !results.length) return '';

    const passThreshold = (1 - FAILURE_THRESHOLD) * 100;

    return results.map(result => {
        // Modify paths to be relative to the dashboard location
        // Since both dashboard.html and screenshots are in the same directory (visual-diff),
        // we just need the path relative to visual-diff
        
        let baselinePath = result.baselinePath;
        // Extract just the part after visual-diff/
        baselinePath = baselinePath.replace(/^.*?visual-diff\//, '');
        // If it doesn't start with screenshots, add it
        if (!baselinePath.startsWith('screenshots/')) {
            baselinePath = 'screenshots/' + baselinePath;
        }

        let comparisonPath = result.comparisonPath;
        comparisonPath = comparisonPath.replace(/^.*?visual-diff\//, '');
        if (!comparisonPath.startsWith('screenshots/')) {
            comparisonPath = 'screenshots/' + comparisonPath;
        }

        let diffPath = result.diffPath;
        diffPath = diffPath.replace(/^.*?visual-diff\//, '');
        if (!diffPath.startsWith('screenshots/')) {
            diffPath = 'screenshots/' + diffPath;
        }


        const isPassing = result.similarity > passThreshold;

        return `
        <div class="result-card" 
             data-device="${result.device}" 
             data-browser="${result.browser}" 
             data-viewport="${result.viewport}"
             data-similarity="${result.similarity}"
             data-test-name="${result.testName}"
             data-baseline-url="${result.baselineUrl}"
             data-comparison-url="${result.comparisonUrl}"
             data-baseline-path="${baselinePath}"
             data-comparison-path="${comparisonPath}"
             data-diff-path="${diffPath}"
             data-baseline-status="${result.baseline_status}"
             data-comparison-status="${result.comparison_status}">
            <div class="p-4 border-b">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-semibold">Test ID: ${result.testName}</h3>
                    <span class="px-3 py-1 rounded-full ${isPassing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${result.similarity}% Similar
                    </span>
                </div>
                <div class="text-sm text-gray-600 mt-2">
                    <p>Device: ${result.device}</p>
                    <p>Browser: ${result.browser}</p>
                    <p>Viewport: ${result.viewport}</p>
                    <p>Baseline URL: <a href="${result.baselineUrl}" class="text-blue-600 hover:underline" target="_blank">${result.baselineUrl}</a></p>
                    <p>Comparison URL: <a href="${result.comparisonUrl}" class="text-blue-600 hover:underline" target="_blank">${result.comparisonUrl}</a></p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-4 p-4">
                <div>
                    <p class="text-sm font-medium mb-2">Baseline</p>
                    <img data-src="${baselinePath}" alt="Baseline" class="w-full lazy">
                </div>
                <div>
                    <p class="text-sm font-medium mb-2">Current</p>
                    <img data-src="${comparisonPath}" alt="Current" class="w-full lazy">
                </div>
                <div>
                    <p class="text-sm font-medium mb-2">Diff</p>
                    <img data-src="${diffPath}" alt="Diff" class="w-full lazy">
                </div>
            </div>
        </div>
    `}).join('');
}
function generateDashboard(results) {
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/vanilla-lazyload@17.8.3/dist/lazyload.min.js"></script>
    <script src="/navigation/nav-bundle.js"></script>
    <style>
        .search-highlight { background-color: yellow; }
        .result-card { display: block; }
        .result-card.hidden { display: none; }
    </style>
</head>
<body class="bg-gray-100">
    <nav class="bg-white shadow-lg sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4">
            <div class="flex justify-between items-center py-4">
                <h1 class="text-2xl font-bold">Visual Regression Tests</h1>
            </div>
        </div>
    </nav>
    
    <div class="max-w-7xl mx-auto mt-8 px-4">
        <div class="bg-white p-4 rounded-lg shadow mb-6">
            <div class="grid grid-cols-6 gap-4">
                <input type="text" id="searchInput" placeholder="Search by URL" class="border rounded p-2">
                <select id="deviceFilter" class="border rounded p-2">
                    <option value="">All Devices</option>
                </select>
                <select id="browserFilter" class="border rounded p-2">
                    <option value="">All Browsers</option>
                </select>
                <select id="viewportFilter" class="border rounded p-2">
                    <option value="">All Viewports</option>
                </select>
                <select id="similarityFilter" class="border rounded p-2">
                    <option value="">All Results</option>
                    <option value="high">High Similarity (>${HIGH_SIMILARITY_THRESHOLD}%)</option>
                    <option value="medium">Medium Similarity (${MEDIUM_SIMILARITY_THRESHOLD}-${HIGH_SIMILARITY_THRESHOLD}%)</option>
                    <option value="low">Low Similarity (<${MEDIUM_SIMILARITY_THRESHOLD}%)</option>
                </select>
                <select id="statusFilter" class="border rounded p-2">
                    <option value="">All Status</option>
                    <option value="pass">Passed (>${HIGH_SIMILARITY_THRESHOLD}%)</option>
                    <option value="fail">Failed (≤${HIGH_SIMILARITY_THRESHOLD}%)</option>
                </select>
                <select id="baselineStatusFilter" class="border rounded p-2">
                    <option value="">All Baseline Status</option>
                    <option value="200">200 OK</option>
                    <option value="301">301 Redirect</option>
                    <option value="403">403 Forbidden</option>
                    <option value="404">404 Not Found</option>
                    <option value="500">500 Server Error</option>
                </select>
                <select id="comparisonStatusFilter" class="border rounded p-2">
                    <option value="">All Comparison Status</option>
                    <option value="200">200 OK</option>
                    <option value="301">301 Redirect</option>
                    <option value="403">403 Forbidden</option>
                    <option value="404">404 Not Found</option>
                    <option value="500">500 Server Error</option>
                </select>
                <button onclick="resetFilters()" class="bg-gray-500 text-white px-4 py-2 rounded">Reset Filters</button>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-6 mb-6">
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Total Tests</h3>
                <p class="text-3xl font-bold">${results ? results.length : 0}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Average Similarity</h3>
                <p class="text-3xl font-bold">${calculateAverageSimilarity(results)}%</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Passed Tests</h3>
                <p class="text-3xl font-bold text-green-600">${results ? results.filter(r => r.similarity > 85).length : 0}</p>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-lg font-semibold mb-2">Failed Tests</h3>
                <p class="text-3xl font-bold text-red-600">${results ? results.filter(r => r.similarity <= 85).length : 0}</p>
            </div>
        </div>

        <!-- Trend Chart -->
        <div class="bg-white p-6 rounded-lg shadow mb-6">
            <canvas id="trendChart"></canvas>
        </div>

        <!-- Top Pagination -->
        <div id="paginationTop" class="flex justify-center gap-2 mb-6"></div>

        <div class="grid grid-cols-1 gap-6 mb-8" id="resultsGrid">
            ${generateResultCards(results)}
        </div>

        <!-- Bottom Pagination -->
        <div id="paginationBottom" class="flex justify-center gap-2 mb-6"></div>
    </div>

    <script>
    const HIGH_SIMILARITY_THRESHOLD = ${HIGH_SIMILARITY_THRESHOLD};
    const MEDIUM_SIMILARITY_THRESHOLD = ${MEDIUM_SIMILARITY_THRESHOLD};
    let ITEMS_PER_PAGE = 10;
    let currentPage = 1;
    let lazyLoadInstance;

    function initializeLazyLoading() {
        console.log('Initializing lazy loading...');
        lazyLoadInstance = new LazyLoad({
            elements_selector: ".lazy"
        });
     console.log('Lazy loading initialized:', lazyLoadInstance);
    }

    let trendChart; // Add this at the top with other variables

    function initializeTrendChart() {
        const timestamp = Date.now();
        const chartId = 'trendChart_' + timestamp;

         // Create new canvas
        const chartContainer = document.querySelector('.bg-white.p-6.rounded-lg.shadow.mb-6');
        const canvas = document.createElement('canvas');
        canvas.id = chartId;
        chartContainer.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        
        const cards = Array.from(document.querySelectorAll('.result-card'));
        const similarities = cards.map(card => parseInt(card.getAttribute('data-similarity')));
        const labels = cards.map(card => card.getAttribute('data-test-name'));

        // Store chart instance
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Similarity %',
                    data: similarities,
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Similarity Trend Across Tests'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Similarity %'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Test Cases'
                        }
                    }
                }
            }
        });
    }

   function showPage(page) {
        // Get only visible cards (not hidden by filters)
        const visibleCards = Array.from(document.querySelectorAll('.result-card:not(.hidden)'));
        console.log('Actual visible cards for pagination:', visibleCards.length);
    
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
    
        // Only show cards that should be visible for current page
        document.querySelectorAll('.result-card').forEach(card => {
            card.style.display = 'none';
        });
    
        visibleCards.slice(startIndex, endIndex).forEach(card => {
            card.style.display = 'block';
        });
    
        currentPage = page;
        updatePaginationControls(visibleCards.length);
        lazyLoadInstance.update();
    }

    function updatePaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        const paginationHTML = [
            '<button onclick="showPage(1)" class="px-3 py-1 rounded ' + (currentPage === 1 ? 'bg-gray-300' : 'bg-blue-500 text-white') + '" ' + (currentPage === 1 ? 'disabled' : '') + '>First</button>',
            '<button onclick="showPage(' + (currentPage - 1) + ')" class="px-3 py-1 rounded ' + (currentPage === 1 ? 'bg-gray-300' : 'bg-blue-500 text-white') + '" ' + (currentPage === 1 ? 'disabled' : '') + '>Previous</button>',
            '<span class="px-3 py-1">Page ' + currentPage + ' of ' + totalPages + '</span>',
            '<button onclick="showPage(' + (currentPage + 1) + ')" class="px-3 py-1 rounded ' + (currentPage === totalPages ? 'bg-gray-300' : 'bg-blue-500 text-white') + '" ' + (currentPage === totalPages ? 'disabled' : '') + '>Next</button>',
            '<button onclick="showPage(' + totalPages + ')" class="px-3 py-1 rounded ' + (currentPage === totalPages ? 'bg-gray-300' : 'bg-blue-500 text-white') + '" ' + (currentPage === totalPages ? 'disabled' : '') + '>Last</button>'
        ].join('');
        
        document.getElementById('paginationTop').innerHTML = paginationHTML;
        document.getElementById('paginationBottom').innerHTML = paginationHTML;
    }

    function applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const deviceValue = document.getElementById('deviceFilter').value;
        const browserValue = document.getElementById('browserFilter').value;
        const viewportValue = document.getElementById('viewportFilter').value;
        const similarityValue = document.getElementById('similarityFilter').value;
        const statusValue = document.getElementById('statusFilter').value;
        const baselineStatusValue = document.getElementById('baselineStatusFilter').value;
        const comparisonStatusValue = document.getElementById('comparisonStatusFilter').value;
        
        console.log('Filter values:', {
            search: searchTerm,
            device: deviceValue,
            browser: browserValue,
            similarity: similarityValue,
            status: statusValue,
            baselineStatus: baselineStatusValue,
            comparisonStatus: comparisonStatusValue
        });
    
        const cards = document.querySelectorAll('.result-card');
        console.log('Total cards before filtering:', cards.length);
        
        cards.forEach(card => {
            const similarity = parseInt(card.getAttribute('data-similarity'));
            const device = card.getAttribute('data-device');
            const browser = card.getAttribute('data-browser');
            const viewport = card.getAttribute('data-viewport');
            const baselineUrl = card.getAttribute('data-baseline-url').toLowerCase();
            const comparisonUrl = card.getAttribute('data-comparison-url').toLowerCase();
            const baselineStatus = parseInt(card.getAttribute('data-baseline-status'));
            const comparisonStatus = parseInt(card.getAttribute('data-comparison-status'));
    
            // Device filter
            const deviceMatch = !deviceValue || device === deviceValue;
            
            // Browser filter
            const browserMatch = !browserValue || browser === browserValue;
            
            // Viewport filter
            const viewportMatch = !viewportValue || viewport === viewportValue;
            
            // Search filter
            const searchMatch = !searchTerm || 
                              baselineUrl.includes(searchTerm) || 
                              comparisonUrl.includes(searchTerm);
            
            // Similarity range filter
            let similarityMatch = true;
            if (similarityValue === 'high') {
                similarityMatch = similarity > HIGH_SIMILARITY_THRESHOLD;
            } else if (similarityValue === 'medium') {
                similarityMatch = similarity >= MEDIUM_SIMILARITY_THRESHOLD && similarity <= HIGH_SIMILARITY_THRESHOLD;
            } else if (similarityValue === 'low') {
                similarityMatch = similarity < MEDIUM_SIMILARITY_THRESHOLD;
            }
    
            // Pass/Fail status filter
            const statusMatch = !statusValue || 
                (statusValue === 'pass' && similarity > HIGH_SIMILARITY_THRESHOLD) ||
                (statusValue === 'fail' && similarity <= HIGH_SIMILARITY_THRESHOLD);

             // Add console.log to verify values
            console.log('Status Check:', {
                similarity,
                threshold: HIGH_SIMILARITY_THRESHOLD,
                isPassing: similarity > HIGH_SIMILARITY_THRESHOLD,
                statusValue,
                statusMatch
            });

            // Baseline status filter
            const baselineStatusMatch = !baselineStatusValue || baselineStatus === parseInt(baselineStatusValue);

            // Comparison status filter
            const comparisonStatusMatch = !comparisonStatusValue || comparisonStatus === parseInt(comparisonStatusValue);
    
            // isVisible condition
            const isVisible = deviceMatch && browserMatch && viewportMatch && 
                         similarityMatch && searchMatch && statusMatch &&
                         baselineStatusMatch && comparisonStatusMatch;
            
            console.log('Card filtering:', {
                similarity,
                device,
                browser,
                matches: {
                    device: deviceMatch,
                    browser: browserMatch,
                    search: searchMatch,
                    similarity: similarityMatch,
                    status: statusMatch,
                    baselineStatus: baselineStatusMatch,
                    comparisonStatus: comparisonStatusMatch
                },
                isVisible
            });
    
            card.classList.toggle('hidden', !isVisible);
        });
    
        const visibleCards = document.querySelectorAll('.result-card:not(.hidden)');
        console.log('Visible cards after filtering:', visibleCards.length);
    
        currentPage = 1;
        showPage(1);
    }

    function resetFilters() {
        document.getElementById('baselineStatusFilter').value = '';
        document.getElementById('comparisonStatusFilter').value = '';
        document.getElementById('deviceFilter').value = '';
        document.getElementById('browserFilter').value = '';
        document.getElementById('viewportFilter').value = '';
        document.getElementById('similarityFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('searchInput').value = '';
        
        document.querySelectorAll('.result-card').forEach(card => {
            card.classList.remove('hidden');
        });
        
        showPage(1);
    }
 
    document.addEventListener('DOMContentLoaded', () => {
    initializeLazyLoading();
    initializeTrendChart();

    // Populate device filter
    const devices = [...new Set(Array.from(document.querySelectorAll('.result-card')).map(el => el.getAttribute('data-device')))].filter(Boolean);
    devices.forEach(device => {
        const option = document.createElement('option');
        option.value = device;
        option.textContent = device;
        document.getElementById('deviceFilter').appendChild(option);
    });

    // Populate browser filter
    const browsers = [...new Set(Array.from(document.querySelectorAll('.result-card')).map(el => el.getAttribute('data-browser')))].filter(Boolean);
    browsers.forEach(browser => {
        const option = document.createElement('option');
        option.value = browser;
        option.textContent = browser;
        document.getElementById('browserFilter').appendChild(option);
    });
    
    // Populate viewport filter
    const viewports = [...new Set(Array.from(document.querySelectorAll('.result-card')).map(el => el.getAttribute('data-viewport')))].filter(Boolean);
    viewports.forEach(viewport => {
        const option = document.createElement('option');
        option.value = viewport;
        option.textContent = viewport;
        document.getElementById('viewportFilter').appendChild(option);
    });

    // Sort by test ID on load
    const resultsGrid = document.getElementById('resultsGrid');
    const cards = Array.from(resultsGrid.children);
    
    // Sort cards and update trend chart data
    cards.sort((a, b) => {
        const testIdA = a.getAttribute('data-test-name');
        const testIdB = b.getAttribute('data-test-name');
        return testIdA.localeCompare(testIdB);
    });

    // Update trend chart with sorted data
    const similarities = cards.map(card => parseInt(card.getAttribute('data-similarity')));
    const labels = cards.map(card => card.getAttribute('data-test-name'));
    
    cards.forEach(card => resultsGrid.appendChild(card));

    // Add event listeners
    document.getElementById('deviceFilter').addEventListener('change', applyFilters);
    document.getElementById('browserFilter').addEventListener('change', applyFilters);
    document.getElementById('viewportFilter').addEventListener('change', applyFilters);
    document.getElementById('similarityFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('baselineStatusFilter').addEventListener('change', applyFilters);
    document.getElementById('comparisonStatusFilter').addEventListener('change', applyFilters);

    showPage(1);
}); 
 </script>
</body>
</html>`;
    const reportPath = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff', 'dashboard.html');
    fs.writeFileSync(reportPath, html);
    console.log('Dashboard generated:', reportPath);
}

// Read and process the test results
const jsonPath = path.join(process.cwd(), REPORTS_ROOT_DIR, 'visual-diff', 'test-results.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const results = jsonData.results || [];

// Generate the dashboard
generateDashboard(results);

