import dotenv from 'dotenv';
dotenv.config();
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import config from '../config';

// Get the URLs file from command line arguments
const args = process.argv.slice(2);
const urlsFileArg = args.find(arg => arg.startsWith('--urls-file='));

const urlsFileName = process.env.URLS_FILE || 'urls-local.json';
const urlsFilePath = path.join(process.cwd(), 'fixtures', 'urls', urlsFileName);

// Load the URLs from the file
let urls = [];
try {
  if (fs.existsSync(urlsFilePath)) {
    const urlsData = fs.readFileSync(urlsFilePath, 'utf8');
    urls = JSON.parse(urlsData);
    console.log(`Running tests with URLs from ${urlsFileName} (${urls.length} URLs)`);
  } else {
    console.error(`URLs file not found: ${urlsFilePath}`);
  }
} catch (error) {
  console.error(`Error loading URLs from ${urlsFilePath}:`, error);
}

import {
    takeBaselineScreenshot,
    takeComparisonScreenshot,
    compareScreenshots,
    compareScreenshotsUsingHashMethod,
    compareScreenshotsUsingPixelDifference,
    getTestModeConfig,
    httpBasicAuthentication
} from '../utils/screenshot-helpers';

const results = [];

// Test Describe
test.describe('Visual Regression Tests', () => {
    // Use failure threshold from config instead of environment variable
    const FAILURE_THRESHOLD = config.thresholds.failure;
    const MAX_RUNTIME_MS = 30 * 60 * 1000; // 30 minutes
    let failedTests = 0;
    let totalTests = 0;
    const startTime = Date.now();

    function saveFailureData(testInfo, error, urls, testedUrls, failureType) {
        const failureData = {
            timestamp: new Date().toISOString(),
            project: testInfo.project.name,
            urlsChunk: process.env.URLS_FILE,
            failureType: failureType, // 'full' or 'partial'
            failureSource: {
                type: error.source || determineFailureSource(error),  // 'application', 'github-runner', 'okta', 'network'
                location: error.stack?.split('\n')[1]?.trim() || 'unknown',  // file path or component
                details: {
                    file: error.fileName || testInfo.file,
                    line: error.lineNumber,
                    component: error.componentName
                }
            },
            failureReason: error.message,
            totalUrls: urls.length,
            completedUrls: testedUrls,
            remainingUrls: urls.slice(testedUrls.length),
            failedUrls: urls.slice(0, totalTests).map(u => ({
                id: u.id,
                url: u.comparison
            }))
        };

        const failedRunnerPath = path.join(process.cwd(), 
            `public/visual-diff/failed-runner-${process.env.URLS_FILE}-${testInfo.project.name}.json`);
        fs.writeFileSync(failedRunnerPath, JSON.stringify(failureData, null, 2));
    }

    function determineFailureSource(error) {
        if (error.message.includes('OKTA')) return 'okta';
        if (error.message.includes('browserType.launch')) return 'github-runner';
        if (error.message.includes('net::')) return 'network';
        return 'application';
    }

    // Define a Set to track which projects have been checked
    const checkedProjects = new Set();

    async function checkAuthentication(browser, app, urls, projectName) {
        // Skip if this project has already been checked
        if (checkedProjects.has(projectName)) {
            return true;
        }
        
        // Get authentication method from config
        const authMethod = config.authentication[app.toLowerCase()];
        
        // Skip authentication check if no authentication is required or if using Basic Auth
        if (!authMethod || authMethod === 'NONE'  || authMethod === 'BASIC') {
            console.log(`Skipping cookie check for ${app} (method: ${authMethod || 'NONE'})`);
            checkedProjects.add(projectName);
            return true;
        }
        
        console.log(`Performing authentication check for ${app} environment (method: ${authMethod})...`);
        const page = await browser.newPage();
        
        try {
            // Determine which URL to use
            const urlObj = urls[0];
            const baseUrl = app === "baseline"
            ? `${config.urls.baseline}/${urlObj.baseline}`
            : `${config.urls.comparison}/${urlObj.comparison}`;
            
            console.log(`Checking authentication with URL: ${baseUrl}`);
            await page.goto(baseUrl);
            
            // Get the target domain
            const targetDomain = new URL(app === "baseline"
            ? config.urls.baseline
            : config.urls.comparison).hostname;
            
            // Get all cookies after navigation
            const cookies = await page.context().cookies();
            const domainCookies = cookies.filter(cookie =>
            cookie.domain === targetDomain ||
            cookie.domain.endsWith('.' + targetDomain));
            
            console.log(`Found ${domainCookies.length} cookies for domain ${targetDomain}`);
            
            // Check if we have cookies for the domain
            if (domainCookies.length === 0) {
                console.error(`Authentication failed for ${app} - no cookies found for domain ${targetDomain}`);
                saveFailureData({project: {name: process.env.PROJECT}},
                    new Error(`Authentication failed - no cookies found for domain`),
                    urls, 0, 'full');
                return false;
            } else {
                console.log(`Authentication check successful for ${app} environment`);
                checkedProjects.add(projectName);
                return true;
            }
        } catch (error) {
            console.error(`Error during authentication check for ${app}:`, error.message);
            saveFailureData({project: {name: process.env.PROJECT}},
                error,
                urls, 0, 'full');
            return false;
        } finally {
            await page.close();
        }
    }

    // Main beforeAll hook
    test.beforeAll(async ({ browser }) => {
        const app = process.env.APP; // "baseline" or "comparison"
        
        if (!app) {
            console.log('No APP environment variable set, skipping authentication check');
            return;
        }
        
        // Initialize test results if needed (for comparison only)
        if (app === "comparison") {
            const testResultsPath = path.join(process.cwd(), `${config.reporting.rootDir}/visual-diff/test-results.json`);
            const testResultsDir = path.dirname(testResultsPath);

            fs.mkdirSync(testResultsDir, { recursive: true });
            if (!fs.existsSync(testResultsPath)) {
                const initialData = {
                    testId: Date.now(),
                    testTypeId: "VRT001",
                    testDate: new Date().toISOString(),
                    results: []
                };
                fs.writeFileSync(testResultsPath, JSON.stringify(initialData, null, 2));
            }
        }
        
        // Perform authentication check
        const authSuccess = await checkAuthentication(browser, app, urls);
        if (!authSuccess) {
            test.fail();
        }

        // Initialize failed-runner.json if needed
        const failedRunnerPath = path.join(process.cwd(), `${config.reporting.rootDir}/visual-diff/failed-runner.json`);
        fs.mkdirSync(path.dirname(failedRunnerPath), { recursive: true });
    });

    urls.forEach((url) => {
        test(`Test page: ${url.id}`, async ({ page }, testInfo) => {
            // Check runtime
            if (Date.now() - startTime > MAX_RUNTIME_MS) {
                const error = new Error('Test execution exceeded 30 minute timeout');
                saveFailureData(testInfo, error, urls, totalTests, 'partial');
                test.fail();
            }

            totalTests++;
            const projectName = testInfo.project.name;
            const viewport = {
                width: page.viewportSize().width,
                height: page.viewportSize().height
            };
            // Initialize status variables at the start of each test
            let baselineStatus = 0;
            let comparisonStatus = 0;

            try {
                if (process.env.APP === "comparison") {
                    // Use reporting root directory from config
                    const screenshotBasePath = path.join(config.reporting.rootDir, 'visual-diff/screenshots', projectName);
                    const baselinePath = path.join(screenshotBasePath, 'baseline', `${url.id}.png`);

                    // Skip if baseline doesn't exist
                    if (!fs.existsSync(baselinePath)) {
                        console.log(`[SKIP] No baseline found for ${url.id}. Run baseline tests first.`);
                        results.push({
                            testName: url.id,
                            device: projectName,
                            browser: projectName.split('-')[1]
                                || (projectName.includes('iphone')
                                || projectName.includes('ipad') ? 'webkit' : 'chromium'),
                            viewport: `${viewport.width}x${viewport.height}`,
                            similarity: 0,
                            response_status: 0,
                            error: 'Missing baseline screenshot',
                            baselinePath: '',  // Empty path
                            comparisonPath: '', // Empty path
                            diffPath: '',      // Empty path
                            baselineUrl: `${config.urls.baseline}/${url.baseline}`,
                            comparisonUrl: `${config.urls.comparison}/${url.comparison}`
                        });
                        return;
                    }

                    let authPage = page;
                    let authContext = null;

                    // For http authentication we need to create each page with authenticated context
                    if(config.authentication.baseline === 'BASIC') {
                        console.log(`Creating authenticated context for baseline URL: ${url.baseline} status check`);
                        const auth = await httpBasicAuthentication(page);
                        authPage = auth.authPage;
                        authContext = auth.authContext;
                    }
            
                    const baselineResponse = await authPage.goto(`${config.urls.baseline}/${url.baseline}`);
                    
                    // Make sure status values are set after navigation
                    baselineStatus = baselineResponse ? baselineResponse.status() : 500;

                    const comparisonResponse = await page.goto(`${config.urls.comparison}/${url.comparison}`);
                    comparisonStatus = comparisonResponse ? comparisonResponse.status() : 500;

                    await performTestWithRetry(page, url, 'comparison', projectName, viewport);

                    const comparisonPath = path.join(screenshotBasePath, 'comparison', `${url.id}.png`);
                    const diffPath = path.join(screenshotBasePath, 'diff', `${url.id}.png`);

                    // Create diff directory if it doesn't exist
                    fs.mkdirSync(path.dirname(diffPath), { recursive: true });

                    // Update the logging to include status checks before comparison
                    console.log(`[DEBUG] ${url.id} - Starting comparison with baseline status: ${baselineStatus}, comparison status: ${comparisonStatus}`);
                    
                    // Only compare if we have both screenshots
                    if (fs.existsSync(baselinePath) && fs.existsSync(comparisonPath)) {
                        const diffMethod = config.image_diff_method.method;
                        
                        let result;
                        if (diffMethod === 'PIXEL') {
                            console.log(`Using pixel-based comparison for ${url.id}`);
                            result = await compareScreenshotsUsingPixelDifference(baselinePath, comparisonPath, diffPath, url.id, baselineStatus, comparisonStatus);
                        } else {
                            console.log(`Using hash-based comparison for ${url.id}`);
                            result = await compareScreenshotsUsingHashMethod(baselinePath, comparisonPath, diffPath, url.id, baselineStatus, comparisonStatus);
                        }

                        // Update debug logging with correct property access
                        console.log(`[DEBUG] ${url.id} - Final similarity: ${result.similarity}% (calculated: ${result.similarity}%, baseline: ${baselineStatus}, comparison: ${comparisonStatus})`);

                        // Update results push with correct similarity value
                        results.push({
                            testName: url.id,
                            device: projectName,
                            browser: projectName.split('-')[1]
                                || (projectName.includes('iphone')
                                || projectName.includes('ipad') ? 'webkit' : 'chromium'),
                            viewport: `${viewport.width}x${viewport.height}`,
                            similarity: result.similarity,
                            calculatedSimilarity: result.similarity,
                            baseline_status: baselineStatus,
                            comparison_status: comparisonStatus,
                            baselinePath: baselinePath,
                            comparisonPath: comparisonPath,
                            diffPath: diffPath,
                            baselineUrl: `${config.urls.baseline}/${url.baseline}`,
                            comparisonUrl: `${config.urls.comparison}/${url.comparison}`
                        });
                    } else {
                        console.error(`[ERROR] Missing screenshots for comparison. Baseline: ${fs.existsSync(baselinePath)}, Comparison: ${fs.existsSync(comparisonPath)}`);
                    }
                } else {
                    await performTestWithRetry(page, url, 'baseline', projectName, viewport);
                }
            } catch (error) {
                failedTests++;
                
                // Early failure detection
                if (totalTests < urls.length * 0.1 && failedTests / totalTests > FAILURE_THRESHOLD) {
                    saveFailureData(testInfo, error, urls, totalTests, 'full');
                    test.fail();
                }

                if (process.env.APP === "comparison") {
                    console.error(`Error processing comparison for ${url.id}:`, error.message);
                    testInfo.annotations.push({
                        type: 'error',
                        description: `Comparison screenshot failed: ${error.message}`
                    });
                    throw error;
                } else {
                    console.error(`Error in baseline test for ${url.id}:`, error.message);
                    return;
                }
            }
        });
    });

    test.afterAll(async () => {
        if (process.env.APP === "comparison" && results.length > 0) {
            // Use reporting root directory from config
            const testResultsPath = path.join(process.cwd(), `${config.reporting.rootDir}/visual-diff/test-results.json`);
    
            try {
                // Create a unique temporary file for this process
                const tempFilePath = `${testResultsPath}.temp-${process.pid}-${Date.now()}`;
                
                // Read existing data with error handling
                let existingData = { results: [] };
                if (fs.existsSync(testResultsPath)) {
                    try {
                        const fileContent = fs.readFileSync(testResultsPath, 'utf8');
                        existingData = JSON.parse(fileContent);
                        
                        // Validate structure
                        if (!existingData.results) {
                            existingData.results = [];
                        }
                    } catch (readError) {
                        console.error(`Error reading existing results file: ${readError.message}`);
                        console.error('Creating new results file');
                        
                        // Backup the corrupted file
                        const backupPath = `${testResultsPath}.corrupted-${Date.now()}`;
                        if (fs.existsSync(testResultsPath)) {
                            fs.copyFileSync(testResultsPath, backupPath);
                            console.log(`Backed up corrupted file to: ${backupPath}`);
                        }
                    }
                }
                
                // Prepare new data
                const testData = {
                    testId: Date.now(),
                    testTypeId: config.testTypes.types.find(t => t.name === 'visual-diff').id,
                    testDate: new Date().toISOString(),
                    results: [...(existingData.results || []), ...results]
                };
                
                // Write to temporary file first
                fs.writeFileSync(tempFilePath, JSON.stringify(testData, null, 2));
                
                // Verify the temporary file is valid JSON
                try {
                    const verifyContent = fs.readFileSync(tempFilePath, 'utf8');
                    JSON.parse(verifyContent); // This will throw if invalid
                    
                    // If we get here, the JSON is valid, so we can safely replace the original file
                    fs.renameSync(tempFilePath, testResultsPath);
                    console.log(`Successfully updated test results with ${results.length} new entries`);
                } catch (verifyError) {
                    console.error(`Error verifying temporary file: ${verifyError.message}`);
                    // Don't replace the original file if the temp file is invalid
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            } catch (error) {
                console.error(`Error in test.afterAll when updating results: ${error.message}`);
            }
        }
    });
    
});

/**
 * Navigates to a URL with retry logic and waits for the main content element
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {string} url - The URL to navigate to
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<import('playwright').Response|null>} - The navigation response
 */
async function navigateWithRetry(page, url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await page.goto(url, {
                timeout: 120000,
                waitUntil: 'domcontentloaded'
            });

            // Get the current test mode config for the appropriate environment
            const environment = process.env.APP || 'baseline';
            const { envConfig } = getTestModeConfig(environment);
            
            // Wait for main content block to be visible if defined
            if (envConfig.dataBlock) {
                await page.waitForSelector(envConfig.dataBlock, {
                    state: 'visible',
                    timeout: 30000
                });
            }
            
            return response;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            console.log(`Attempt ${attempt} failed for ${url}, retrying...`);
            await page.waitForTimeout(5000); // Wait 5 seconds between retries
        }
    }
}

/**
 * Performs a test with retry logic
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {Object} url - The URL object with baseline and comparison properties
 * @param {string} testType - 'baseline' or 'comparison'
 * @param {string} projectName - The name of the project
 * @param {Object} viewport - The viewport dimensions
 * @param {number} maxRetries - Maximum number of retry attempts
 */
async function performTestWithRetry(page, url, testType, projectName, viewport, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (testType === 'baseline') {
          // Take baseline screenshot - the function now handles element hiding internally
          await takeBaselineScreenshot(page, `${process.env.BASELINE_URL || config.urls.baseline}/${url.baseline}`, url.id, projectName, viewport);
          console.log(`Baseline screenshot saved for ${url.id}`);
  
          // Check for content height limitations
          const contentHeight = await page.evaluate(() => {
            return document.documentElement.scrollHeight;
          });
  
          if (contentHeight > 32767) {
            // Log to page-limit-exceed-{chunk}.json
            const limitExceedData = {
              testName: url.id,
              device: projectName,
              url: url.baseline,
              contentHeight: contentHeight
            };
            
            const limitExceedPath = path.join(process.cwd(), `${config.reporting.rootDir}/visual-diff/page-limit-exceed-${process.env.URLS_FILE || 'default'}.json`);
            fs.mkdirSync(path.dirname(limitExceedPath), { recursive: true });
            fs.writeFileSync(limitExceedPath, JSON.stringify(limitExceedData, null, 2));
          }
  
          return;
        } else {
            // Take comparison screenshot - the function now handles element hiding internally
            await takeComparisonScreenshot(page, `${process.env.COMPARISON_URL || config.urls.comparison}/${url.comparison}`, url.id, projectName, viewport);
            console.log(`Comparison screenshot saved for ${url.id}`);

            // Check for content height limitations
            const contentHeight = await page.evaluate(() => {
                return document.documentElement.scrollHeight;
            });

            if (contentHeight > 32767) {
                // Log to page-limit-exceed-{chunk}.json
                const limitExceedData = {
                    testName: url.id,
                    device: projectName,
                    url: url.comparison,
                    contentHeight: contentHeight
                };
                
                const limitExceedPath = path.join(process.cwd(), `${config.reporting.rootDir}/visual-diff/page-limit-exceed-${process.env.URLS_FILE || 'default'}.json`);
                fs.mkdirSync(path.dirname(limitExceedPath), { recursive: true });
                fs.writeFileSync(limitExceedPath, JSON.stringify(limitExceedData, null, 2));
            }

            return;
        }
      } catch (error) {
        if (attempt === maxRetries) {
            throw error;
        }
        console.log(`Test attempt ${attempt} failed for ${url.id}, retrying in 5 seconds...`);
        await page.waitForTimeout(5000);
      }
    }
}
