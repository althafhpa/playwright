import path from 'path';
import fs from 'fs';
const dotenv = require('dotenv');
const imghash = require('imghash');
const Jimp = require('jimp');
const config = require('../config');

dotenv.config();

/**
 * Gets the current test mode and appropriate selectors based on environment variables
 * @param {string} environment - 'baseline' or 'comparison'
 * @returns {Object} Object containing mode, selectors, and environment-specific settings
 */
function getTestModeConfig(environment) {
    // Get mode from environment variable or use default from config
    const mode = process.env.TEST_MODE || config.pageElements.mode;
    
    // Normalize mode to uppercase for comparison
    const normalizedMode = mode.toUpperCase();
    
    // Get the appropriate selectors based on mode
    let modeConfig = {};
    let envConfig = {};
    
    if (normalizedMode === 'EMBED') {
        modeConfig = config.pageElements.embed;
        // Get environment-specific settings
        envConfig = environment === 'baseline' ? modeConfig.baseline : modeConfig.comparison;
    } else if (normalizedMode === 'FULL') {
        modeConfig = config.pageElements.full;
        // For FULL mode, we need both common and environment-specific settings
        const commonElements = modeConfig.elementsToHide ? modeConfig.elementsToHide.split(',').map(s => s.trim()) : [];
        const envSpecificConfig = environment === 'baseline' ? modeConfig.baseline : modeConfig.comparison;
        const envSpecificElements = envSpecificConfig && envSpecificConfig.elementsToHide ? 
            envSpecificConfig.elementsToHide.split(',').map(s => s.trim()) : [];
        
        // Combine common and environment-specific elements
        envConfig = {
            elementsToHide: [...commonElements, ...envSpecificElements]
        };
    } else {
        // Fallback to embed mode if invalid mode specified
        console.warn(`Invalid test mode: ${mode}. Falling back to default mode: ${config.pageElements.mode}`);
        modeConfig = config.pageElements.embed;
        envConfig = environment === 'baseline' ? modeConfig.baseline : modeConfig.comparison;
    }
    
    return {
        mode: normalizedMode,
        modeConfig,
        envConfig
    };
}

/**
 * Applies the appropriate element hiding strategy based on the current test mode
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {string} environment - 'baseline' or 'comparison'
 * @param {string} projectName - The name of the project (optional)
 * @param {Object} viewport - The viewport dimensions (optional)
 */
async function applyElementHidingStrategy(page, environment, projectName = null, viewport = null) {
    const { mode } = getTestModeConfig(environment);
    
    console.log(`Applying element hiding strategy for ${environment} using mode: ${mode}`);
    
    if (mode === 'EMBED') {
        await hideAllExceptEmbedElements(page, environment, projectName, viewport);
    } else {
        await hideElements(page, environment);
    }
}

async function takeScreenshotWithSizeCheck(page, url, options) {
    // Get full page dimensions with max limit
    const dimensions = await page.evaluate((maxDim) => ({
        height: Math.min(document.documentElement.scrollHeight, maxDim),
        width: Math.min(document.documentElement.scrollWidth, maxDim)
    }), 32767); // Max dimension hardcoded for now
    
   // Set viewport to these dimensions, but never exceeding the max limit
    await page.setViewportSize({
        width: Math.min(dimensions.width, 32767),
        height: Math.min(dimensions.height, 32767)
    });
    
    return page.screenshot({
        ...options,
        fullPage: true,
        timeout: 60000, // Default timeout
        scale: 'css'// css or device. Use css scale for better accuracy.
    }).catch((error) => {
        console.error(`Error taking screenshot: ${error.message}`);
        throw error;
    });
}

/**
 * Takes a baseline screenshot
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {string} url - The URL to screenshot
 * @param {string} testId - The test identifier
 * @param {string} projectName - The name of the project
 * @param {Object} viewport - The viewport dimensions
 * @returns {Promise<string>} Path to the saved screenshot
 */
async function takeBaselineScreenshot(page, url, testId, projectName, viewport) {
    try {
        // Ensure url is a string
        if (typeof url !== 'string') {
            throw new Error(`Invalid URL: expected string, got ${typeof url}`);
        }

        let authPage = page;
        let authContext = null;

        // For http authentication we need to create each page with authenticated context
        if(config.authentication.baseline === 'BASIC') {
          console.log(`Creating authenticated context for ${testId}`);
          const auth = await httpBasicAuthentication(page);
          authPage = auth.authPage;
          authContext = auth.authContext;
        }
        
        try {
            // Navigate to the URL with the authenticated page
            await authPage.goto(url, {
                timeout: 120000,  // Increased timeout
                waitUntil: 'networkidle',
                waitForLoadState: 'domcontentloaded'
            });
            
            const screenshotPath = path.join(config.reporting.rootDir, 'visual-diff/screenshots', projectName, 'baseline');
            fs.mkdirSync(screenshotPath, { recursive: true });
            
            // Add viewport height check before screenshot
            const contentHeight = await authPage.evaluate(() => {
                return document.documentElement.scrollHeight;
            });

            // Apply the appropriate element hiding strategy
            await applyElementHidingStrategy(authPage, 'baseline', projectName, viewport);

            // Get the current test mode config
            const { mode, envConfig } = getTestModeConfig('baseline');
            
            if (contentHeight > 32767) {
                // Take screenshot of main content block instead
                if (mode === 'EMBED' && envConfig.dataBlock) {
                    await authPage.locator(envConfig.dataBlock).screenshot({
                        path: path.join(screenshotPath, `${testId}.png`)
                    });
                } else {
                    // For FULL mode or if dataBlock is not defined, take a screenshot of the visible area
                    await authPage.screenshot({
                        path: path.join(screenshotPath, `${testId}.png`),
                        fullPage: false
                    });
                }
            } else {
                // Use full page stitching for normal length pages
                await authPage.screenshot({
                    path: path.join(screenshotPath, `${testId}.png`),
                    fullPage: true
                });
            }
            
            return path.join(screenshotPath, `${testId}.png`);
        } finally {
            // Clean up if we created a new context
            if (authContext) {
                await authPage.close();
                await authContext.close();
            }
        }
    } catch (error) {
        console.error(`Baseline screenshot failed for ${projectName}:`, error.message);
        throw error;
    }
}

/**
 * Takes a comparison screenshot
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {string} url - The URL to screenshot
 * @param {string} testId - The test identifier
 * @param {string} projectName - The name of the project
 * @param {Object} viewport - The viewport dimensions
 * @returns {Promise<string>} Path to the saved screenshot
 */
async function takeComparisonScreenshot(page, url, testId, projectName, viewport) {
    try {
        console.log(`[DEBUG] Starting comparison screenshot for ${testId} in ${projectName}`);
        
        // Navigate to the URL with proper timeout and wait conditions
        await page.goto(url, {
            timeout: 120000,  // Increased timeout
            waitUntil: 'networkidle'
        });
        
        console.log(`[DEBUG] Page loaded for ${testId}`);
        
        // Create screenshot directory
        const screenshotPath = path.join(config.reporting.rootDir, 'visual-diff/screenshots', projectName, 'comparison');
        fs.mkdirSync(screenshotPath, { recursive: true });
        
        // Apply the appropriate element hiding strategy
        await applyElementHidingStrategy(page, 'comparison', projectName, viewport);
        
        console.log(`[DEBUG] Elements hidden for ${testId}, preparing to take screenshot`);
        
        // Get the current test mode config
        const { mode, envConfig } = getTestModeConfig('comparison');
        
        // Check if the target element exists for EMBED mode
        if (mode === 'EMBED' && envConfig.dataBlock) {
            const targetSelector = envConfig.dataBlock;
            console.log(`[DEBUG] Checking for target element with selector: ${targetSelector}`);
            const elementExists = await page.evaluate((selector) => {
                return !!document.querySelector(selector);
            }, targetSelector);
            
            if (elementExists) {
                console.log(`[DEBUG] Target element found for ${testId}, taking screenshot of element`);
                
                // Take screenshot of just the element if it exists
                await page.locator(targetSelector).screenshot({
                    path: path.join(screenshotPath, `${testId}.png`),
                    timeout: 30000
                });
                
                console.log(`[DEBUG] Element screenshot saved for ${testId}`);
            } else {
                console.log(`[DEBUG] Target element not found for ${testId}, falling back to full page screenshot`);
                
                // Fall back to full page screenshot if element doesn't exist
                await takeScreenshotWithSizeCheck(page, url, {
                    path: path.join(screenshotPath, `${testId}.png`)
                });
                
                console.log(`[DEBUG] Full page screenshot saved for ${testId}`);
            }
        } else {
            // For FULL mode or any other mode, take full page screenshot
            console.log(`[DEBUG] Taking full page screenshot for ${testId}`);
            
            await takeScreenshotWithSizeCheck(page, url, {
                path: path.join(screenshotPath, `${testId}.png`)
            });
            
            console.log(`[DEBUG] Full page screenshot saved for ${testId}`);
        }
        
        return path.join(screenshotPath, `${testId}.png`);
    } catch (error) {
        console.error(`[ERROR] Comparison screenshot failed for ${testId}:`, error.message);
        console.error(error.stack);
        throw error;
    }
}
                
function hammingDistance(str1, str2) {
    let distance = 0;
    for (let i = 0; i < str1.length; i++) {
        if (str1[i] !== str2[i]) distance++;
    }
    return distance;
}

/**
 * Compares two screenshots using either pixel difference or hash method based on configuration.
 * @param {string} baselinePath - Path to the baseline screenshot
 * @param {string} comparisonPath - Path to the comparison screenshot
 * @param {string} diffPath - Path where the diff image will be saved
 * @param {string} testName - Name of the test
 * @param {number} baselineStatus - HTTP status code of baseline page
 * @param {number} comparisonStatus - HTTP status code of comparison page
 * @returns {Promise<Object>} - Comparison result object
 */
async function compareScreenshots(baselinePath, comparisonPath, diffPath, testName, baselineStatus, comparisonStatus) {
    // Determine which comparison method to use based on configuration
    const comparisonMethod = config.image_diff_method.method;
    
    console.log(`[DEBUG] ${testName} - Using ${comparisonMethod} comparison method`);
    
    if (comparisonMethod === 'PIXEL') {
        return await compareScreenshotsUsingPixelDifference(
            baselinePath, 
            comparisonPath, 
            diffPath, 
            testName, 
            baselineStatus, 
            comparisonStatus
        );
    } else {
        // Default to hash method
        return await compareScreenshotsUsingHashMethod(
            baselinePath, 
            comparisonPath, 
            diffPath, 
            testName, 
            baselineStatus, 
            comparisonStatus
        );
    }
}

/**
 * Compares two screenshots using pixel difference method.
 * @param {string} baselinePath - Path to the baseline screenshot
 * @param {string} comparisonPath - Path to the comparison screenshot
 * @param {string} diffPath - Path where the diff image will be saved
 * @param {string} testName - Name of the test
 * @param {number} baselineStatus - HTTP status code of baseline page
 * @param {number} comparisonStatus - HTTP status code of comparison page
 * @returns {Promise<Object>} - Comparison result object with similarity percentage
 */
async function compareScreenshotsUsingPixelDifference(baselinePath, comparisonPath, diffPath, testName, baselineStatus, comparisonStatus) {
    try {
        console.log(`[DEBUG] ${testName} - Starting pixel difference comparison`);
        console.log(`[DEBUG] ${testName} - Baseline status: ${baselineStatus}, Comparison status: ${comparisonStatus}`);

        // If either page returned an error status, return 0% similarity
        if (baselineStatus >= 400 || comparisonStatus >= 400) {
            console.log(`[DEBUG] ${testName} - Error status detected, returning 0% similarity`);
            return {
                similarity: 0,
                baselineStatus: baselineStatus,
                comparisonStatus: comparisonStatus,
                error: `HTTP error: Baseline status ${baselineStatus}, Comparison status ${comparisonStatus}`
            };
        }

        // Check if both files exist
        if (!fs.existsSync(baselinePath) || !fs.existsSync(comparisonPath)) {
            console.error(`[ERROR] ${testName} - One or both screenshot files missing`);
            return {
                similarity: 0,
                baselineStatus: baselineStatus,
                comparisonStatus: comparisonStatus,
                error: 'One or both screenshot files missing'
            };
        }

        // Load the images
        const baselineImg = await Jimp.read(baselinePath);
        const comparisonImg = await Jimp.read(comparisonPath);

        // Resize the comparison image to match the baseline if they're different sizes
        if (baselineImg.getWidth() !== comparisonImg.getWidth() || 
            baselineImg.getHeight() !== comparisonImg.getHeight()) {
            console.log(`[DEBUG] ${testName} - Resizing comparison image to match baseline dimensions`);
            comparisonImg.resize(baselineImg.getWidth(), baselineImg.getHeight());
        }

               // Get the threshold from configuration
               const threshold = config.thresholds.pixel;
               console.log(`[DEBUG] ${testName} - Using pixel difference threshold: ${threshold}`);
       
               // Create a diff image
               const diff = Jimp.diff(baselineImg, comparisonImg, threshold / 100);
               
               // Calculate similarity percentage (invert the percent diff)
               const similarity = Math.round((1 - diff.percent) * 100);
               console.log(`[DEBUG] ${testName} - Pixel difference: ${diff.percent}, Similarity: ${similarity}%`);
       
               // Save the diff image
               await diff.image.writeAsync(diffPath);
               console.log(`[DEBUG] ${testName} - Diff image saved to: ${diffPath}`);
       
               return {
                   similarity: similarity,
                   baselineStatus: baselineStatus,
                   comparisonStatus: comparisonStatus
               };
           } catch (error) {
               console.error(`[ERROR] ${testName} - Error comparing screenshots: ${error.message}`);
               return {
                   similarity: 0,
                   baselineStatus: baselineStatus,
                   comparisonStatus: comparisonStatus,
                   error: error.message
               };
           }
       }
       
       /**
        * Compares two screenshots using perceptual hash algorithm to determine visual similarity.
        * 
        * This function calculates the similarity between baseline and comparison screenshots using
        * a perceptual hash algorithm, which is more resilient to minor pixel-level differences.
        * It handles HTTP status codes, missing files, and generates a visual diff image.
        * 
        * @param {string} baselinePath - File path to the baseline screenshot
        * @param {string} comparisonPath - File path to the comparison screenshot
        * @param {string} diffPath - File path where the visual difference image will be saved
        * @param {string} testName - Identifier for the test case, used in logging
        * @param {number} baselineStatus - HTTP status code from the baseline page request
        * @param {number} comparisonStatus - HTTP status code from the comparison page request
        * @returns {Promise<Object>} Result object containing:
        *   - similarity {number}: Percentage of visual similarity (0-100)
        *   - baselineStatus {number}: HTTP status code from baseline
        *   - comparisonStatus {number}: HTTP status code from comparison
        *   - error {string}: Error message if any (optional)
        * @throws Will not throw errors, but returns error information in result object
        */
       async function compareScreenshotsUsingHashMethod(baselinePath, comparisonPath, diffPath, testName, baselineStatus, comparisonStatus) {
           const testTypeId = config.testTypes.types.find(t => t.name === 'visual-diff').id;
           let calculatedSimilarity = 0;
       
           try {
               console.log(`[DEBUG] ${testName} - Starting comparison with baseline status: ${baselineStatus}, comparison status: ${comparisonStatus}`);
       
               const baselineHash = await imghash.hash(baselinePath);
               const comparisonHash = await imghash.hash(comparisonPath);
               const hashDistance = hammingDistance(baselineHash, comparisonHash);
               calculatedSimilarity = Math.round(((64 - hashDistance) / 64) * 100);
       
               // Always generate diff image for reference
               const baseline = await Jimp.read(baselinePath);
               const comparison = await Jimp.read(comparisonPath);
               const diff = Jimp.diff(baseline, comparison);
               await diff.image.writeAsync(diffPath);

               // Similarity checks only if baseline and comparison pages available.
               let similarity = comparisonStatus === 200 && baselineStatus === 200 ? calculatedSimilarity : 0;
               
               return {
                   testId: global.currentTestId,
                   testTypeId,
                   similarity,
                   diffPath,
                   baselineStatus,
                   comparisonStatus
               };
           } catch (error) {
               return {
                   testId: global.currentTestId,
                   testTypeId,
                   similarity: 0,
                   error: error.message,
                   diffPath,
                   baselineStatus,
                   comparisonStatus
               };
           }
       }
       
       /**
        * Hides elements on the page based on configuration for FULL mode
        * @param {import('playwright').Page} page - Playwright page object
        * @param {string} environment - 'baseline' or 'comparison'
        */
       async function hideElements(page, environment) {
           try {
               // Get the current test mode config
               const { mode, envConfig } = getTestModeConfig(environment);
               
               console.log(`Page comparison mode: ${mode} for ${environment}`);
               
               if (mode === 'FULL') {
                   // Get elements to hide for this environment
                   const elementsToHide = envConfig.elementsToHide || [];
                   
                   if (elementsToHide.length > 0) {
                       console.log(`Hiding ${elementsToHide.length} elements for ${environment} environment`);
                       
                       // Hide each element
                       for (const selector of elementsToHide) {
                           try {
                               await page.evaluate((sel) => {
                                   document.querySelectorAll(sel).forEach(el => {
                                       el.style.visibility = 'hidden';
                                   });
                               }, selector);
                           } catch (err) {
                               console.error(`Error hiding elements with selector "${selector}": ${err.message}`);
                           }
                       }
                   } else {
                       console.log(`No elements to hide for ${environment} environment in FULL mode`);
                   }
               } else {
                   console.log(`EMBED mode active - hideElements not used, using hideAllExceptEmbedElements instead`);
               }
           } catch (error) {
               console.error(`Error in hideElements function: ${error.message}`);
               console.error(error.stack);
           }
       }
       
       /**
        * Hides all elements except the main content embed for EMBED mode
        * @param {import('playwright').Page} page - The Playwright page object
        * @param {string} environment - 'baseline' or 'comparison'
        * @param {string} projectName - The name of the project (e.g., 'chromium-desktop')
        * @param {Object} viewport - The viewport dimensions (optional)
        */
       async function hideAllExceptEmbedElements(page, environment, projectName, viewport) {
           try {
               // Wait for basic load states
               await page.waitForLoadState('domcontentloaded');
               await page.waitForLoadState('load');
               
               const appType = process.env.APP || environment;
               
               // Get the current test mode config
               const { mode, envConfig } = getTestModeConfig(environment);
               
               if (mode !== 'EMBED') {
                   console.log(`[DEBUG][${projectName}] Not in EMBED mode, skipping hideAllExceptEmbedElements`);
                   return;
               }
               
               // Get selector from configuration
               const targetSelector = envConfig.dataBlock;
               if (!targetSelector) {
                   console.log(`[WARNING][${projectName}][${environment}] No dataBlock selector defined for ${environment} in EMBED mode`);
                   return;
               }
               
               console.log(`[DEBUG][${projectName}][${environment}] Starting element hiding process for selector: "${targetSelector}"`);
               
               // Determine which hide classes to use based on the environment
               let hideSelectorsStr = envConfig.hideElements || '';
               console.log(`[DEBUG][${projectName}][${environment}] Using selectors to hide: "${hideSelectorsStr}"`);
               
               // Parse selectors
               let hideSelectors = [];
               
               if (hideSelectorsStr && hideSelectorsStr !== 'NULL') {
                   // Split by comma and trim each selector
                   hideSelectors = hideSelectorsStr
                       .split(',')
                       .map(selector => selector.trim())
                       .filter(selector => selector); // Remove empty strings
                   
                   if (hideSelectors.length > 0) {
                       console.log(`[DEBUG][${projectName}][${environment}] Will hide ${hideSelectors.length} types of elements:`);
                       hideSelectors.forEach((selector, index) => {
                           console.log(`[DEBUG][${projectName}][${environment}]   ${index + 1}. "${selector}"`);
                       });
                   }
               }
               
               // STEP 1: Find the target element with retries
               console.log(`[DEBUG][${projectName}][${environment}] STEP 1: Locating target element with selector: "${targetSelector}"`);
               
               let found = false;
               const maxRetries = 3;
               const retryDelay = 2000; // 2 seconds
               
               for (let attempt = 1; attempt <= maxRetries; attempt++) {
                   console.log(`[DEBUG][${projectName}][${environment}] Attempt ${attempt}/${maxRetries} to find element in DOM...`);
                   
                   try {
                       // Check if the element exists
                       const elementExists = await page.evaluate((selector) => {
                           return !!document.querySelector(selector);
                       }, targetSelector);
                       
                       if (elementExists) {
                           console.log(`[DEBUG][${projectName}][${environment}] ✓ Element found in DOM on attempt ${attempt}`);
                           found = true;
                           break;
                       } else {
                           console.log(`[DEBUG][${projectName}][${environment}] ✗ Element not found in DOM on attempt ${attempt}`);
                           if (attempt < maxRetries) {
                               console.log(`[DEBUG][${projectName}][${environment}] Waiting ${retryDelay/1000}s before next attempt...`);
                               await page.waitForTimeout(retryDelay);
                           }
                       }
                   } catch (error) {
                       console.error(`[ERROR][${projectName}][${environment}] Error checking for element: ${error.message}`);
                       if (attempt < maxRetries) {
                           await page.waitForTimeout(retryDelay);
                       }
                   }
               }
               
               if (!found) {
                   console.log(`[WARNING][${projectName}][${environment}] Could not find element after ${maxRetries} attempts. Will capture full page.`);
                   return; // Return early to allow full page screenshot
               }
               
               // STEP 2: Wait for the element to be visible
               console.log(`[DEBUG][${projectName}][${environment}] STEP 2: Waiting for element to become visible...`);
               
               try {
                   await page.waitForSelector(targetSelector, { 
                       state: 'visible',
                       timeout: 10000 // 10 seconds
                   });
                   console.log(`[DEBUG][${projectName}][${environment}] ✓ Element is now visible`);
               } catch (e) {
                   console.log(`[WARNING][${projectName}][${environment}] Element exists but is not visible within timeout. Proceeding anyway.`);
               }
               
               // STEP 3: Hide all elements except the target and its ancestors
               console.log(`[DEBUG][${projectName}][${environment}] STEP 3: Hiding irrelevant elements...`);
               
               // Use a more reliable approach to evaluate the script
               await page.evaluate((params) => {
                   const { targetSelector, hideSelectors } = params;
                   
                   // Helper function to log from browser context
                   const log = (message) => {
                       console.log(`[Browser] ${message}`);
                   };
                   
                   log(`Starting to hide elements for selector: "${targetSelector}"`);
                   
                   const mainContent = document.querySelector(targetSelector);
                   if (!mainContent) {
                       log(`Target element not found`);
                       return;
                   }
                   
                   log(`Found target element: ${mainContent.tagName}${mainContent.id ? '#'+mainContent.id : ''}${mainContent.className ? '.'+mainContent.className.split(' ')[0] : ''}`);
                   
                   // Build the path from the target element to the body
                   const ancestorPath = [];
                   let current = mainContent;
                   
                   while (current && current !== document.body) {
                       ancestorPath.push(current);
                       current = current.parentElement;
                       if (current) {
                           log(`Added ancestor to path: ${current.tagName}${current.id ? '#'+current.id : ''}${current.className ? '.'+current.className.split(' ')[0] : ''}`);
                       }
                   }
                   
                   if (ancestorPath.length > 0) {
                       log(`Built ancestor path with ${ancestorPath.length} elements`);
                   }
                   
                   // Hide all siblings at each level of the ancestor path
                   let totalHidden = 0;
                   
                   ancestorPath.forEach((ancestor, index) => {
                       const parent = ancestor.parentElement;
                       if (!parent) return;
                       
                       // Get all siblings at this level
                       const siblings = Array.from(parent.children);
                       let hiddenCount = 0;
                       
                       siblings.forEach(sibling => {
                           // Skip if this is our target element or contains our target element
                           if (sibling === ancestor || sibling.contains(mainContent)) {
                               return;
                           }
                           
                           // Hide the sibling
                           sibling.style.display = 'none';
                           hiddenCount++;
                           totalHidden++;
                       });
                       
                       log(`Hidden ${hiddenCount} siblings at level ${index+1} (${parent.tagName})`);
                   });
                   
                   log(`Total elements hidden: ${totalHidden}`);
                   
                   // Make the main content more visible
                   mainContent.style.cssText = `
                       position: relative !important;
                       top: 0 !important;
                       left: 0 !important;
                       margin: 0 !important;
                       padding: 20px !important;
                       width: 100% !important;
                       background-color: white !important;
                       z-index: 1000 !important;
                   `;
                   
                   // For each ancestor, make it take full width
                   ancestorPath.forEach(ancestor => {
                       ancestor.style.width = '100%';
                       ancestor.style.maxWidth = '100%';
                       
                       // Special handling for two-column layouts
                       if (ancestor.classList.contains('twoColumn__right') || 
                           ancestor.classList.contains('two-column__right')) {
                           ancestor.style.flex = '1 0 100%';
                           log(`Adjusted width for two-column right element`);
                       }
                       
                       // If this is a container, ensure it's visible and takes full width
                       if (ancestor.classList.contains('container') || 
                           ancestor.classList.contains('layoutContainer') ||
                           ancestor.classList.contains('contentWrapper')) {
                           ancestor.style.cssText = `
                               width: 100% !important;
                               max-width: 100% !important;
                               margin: 0 !important;
                               padding: 0 !important;
                               display: block !important;
                           `;
                           log(`Adjusted container element: ${ancestor.className.split(' ')[0]}`);
                       }
                   });
                   
                   // Hide specific elements inside the main content if needed
                   if (hideSelectors && hideSelectors.length > 0) {
                       let hiddenBySelector = 0;
                       
                       hideSelectors.forEach(selector => {
                           if (!selector) return;
                           
                           try {
                                                       // Apply selectors to the entire document, not just within mainContent
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            element.style.display = 'none';
                            hiddenBySelector++;
                        });
                        
                        log(`Hidden ${elements.length} elements matching "${selector}"`);
                    } catch (error) {
                        log(`Error with selector "${selector}": ${error.message}`);
                    }
                });
                
                log(`Total elements hidden by selectors: ${hiddenBySelector}`);
            }
            
            // Remove fixed position elements that might overlap
            const fixedElements = document.querySelectorAll('*[style*="position: fixed"], *[style*="position:fixed"]');
            let fixedHidden = 0;
            
            fixedElements.forEach(element => {
                if (!element.contains(mainContent) && !mainContent.contains(element)) {
                    element.style.display = 'none';
                    fixedHidden++;
                }
            });
            
            if (fixedHidden > 0) {
                log(`Hidden ${fixedHidden} fixed position elements`);
            }
            
            // Fix any scroll or overflow issues
            document.documentElement.style.cssText = 'height: auto !important; scroll-behavior: auto !important; overflow: visible !important;';
            document.body.style.cssText = 'height: auto !important; scroll-behavior: auto !important; overflow: visible !important;';
            
            log(`Element hiding complete`);
        }, { targetSelector, hideSelectors });
        
        // STEP 4: Wait a moment for any animations to complete
        console.log(`[DEBUG][${projectName}][${environment}] STEP 4: Waiting for page to stabilize...`);
        await page.waitForTimeout(1000);
        
        console.log(`[DEBUG][${projectName}][${environment}] Element hiding process complete`);
        
        // STEP 5: Verify the element is still visible after modifications
        const isVisible = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            if (!element) return false;
            
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }, targetSelector);
        
        if (!isVisible) {
            console.log(`[WARNING][${projectName}][${environment}] Target element is not visible after modifications. This may affect screenshots.`);
        } else {
            console.log(`[DEBUG][${projectName}][${environment}] Target element is visible and ready for screenshot.`);
        }
        
    } catch (error) {
        const projectName = page.context()._browser ? 
            (page.context()._browser._options && page.context()._browser._options.name ? 
                page.context()._browser._options.name : 'unknown') : 
            'unknown';
        console.error(`[ERROR][${projectName}][${environment}] Error hiding elements: ${error.message}`);
        console.error(error.stack);
        console.log(`[DEBUG][${projectName}][${environment}] Proceeding with full page screenshot`);
    }
}  

async function httpBasicAuthentication(page) {
    // Create a new authenticated context if needed
    let authPage = page;
    let authContext = null;
    
    if (process.env.HTTP_USERNAME && 
        process.env.HTTP_PASSWORD && 
        config.authentication.baseline === 'BASIC') {
        
        // Create a new context with authentication
        authContext = await page.context().browser().newContext({
            httpCredentials: {
                username: process.env.HTTP_USERNAME,
                password: process.env.HTTP_PASSWORD
            },
            viewport: page.viewportSize()
        });
        
        // Create a new page with the authenticated context
        authPage = await authContext.newPage();
    }
    
    return { authPage, authContext };
 } 

module.exports = {
    takeBaselineScreenshot,
    takeComparisonScreenshot,
    compareScreenshots,
    compareScreenshotsUsingHashMethod,
    compareScreenshotsUsingPixelDifference,
    hideElements,
    hideAllExceptEmbedElements,
    applyElementHidingStrategy,
    getTestModeConfig,
    httpBasicAuthentication
};
       
