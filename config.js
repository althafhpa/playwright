const { basename } = require("path");

/**
 * Visual Regression Testing Configuration
 */
module.exports = {
    // URLs for testing environments
    urls: {
      baseline: 'https://www.google.com',
      comparison: 'https://www.google.com.au'
    },

    // Page element settings with support for both EMBED and FULL modes
    pageElements: {
      // Default mode - will be overridden by TEST_MODE env variable
      mode: 'FULL',
      
      // Selectors for EMBED mode
      embed: {
        // Baseline settings
        baseline: {
          dataBlock: '[data-block="content-main"]',  // Supports data attributes, IDs, or classes
          hideElements: '.sidebar-grid h1,.sidebar-grid__sidebar'  // Comma-separated CSS selectors
        },
        // Comparison settings
        comparison: {
          dataBlock: '[data-block="content-main"]',  // Supports data attributes, IDs, or classes
          hideElements: 'a[data-scholarship-back="1"]'  // Comma-separated CSS selectors
        }
      },
      
      // Selectors for FULL mode
      full: {
        // Common elements to hide in both baseline and comparison
        elementsToHide: '',  // Comma-separated CSS selectors
        
        // Baseline-specific settings
        baseline: {
          //elementsToHide: '.sidebar-grid h1,.sidebar-grid__sidebar'  // Baseline-specific elements to hide
          elementsToHide:''
        },
        
        // Comparison-specific settings
        comparison: {
          //elementsToHide: 'a[data-scholarship-back="1"]'  // Comparison-specific elements to hide
          elementsToHide:''
        }
      }
    },
    
    // Comparison thresholds
    thresholds: {
      pixel: 10,       // Threshold for pixel difference (0-100)
      hash: 10,        // Threshold for hash difference (0-64)
      failure: 0.1,    // Threshold for test failure rate (0-1)
      similarity: {
        high: 90,      // Threshold for high similarity percentage (0-100)
        medium: 80     // Threshold for medium similarity percentage (0-100)
      }
    },
    
    // Image diff method used for comparison
    image_diff_method: {
      method: 'HASH' // Options: 'HASH' or 'PIXEL'
    },
    
    // Authentication methods (not credentials)
    // Options: 'OKTA', 'BASIC' or 'NONE'
    authentication: {
      baseline: 'NONE', // Current options: 'BASIC' or 'NONE'
      comparison: 'NONE'  // Current options: 'OKTA' or 'NONE'
    },
    
    // Reporting settings
    reporting: {
      rootDir: 'public'  // Directory where reports will be generated
    },
    
    // Server settings
    server: {
      port: 9222  // Port for the server
    },
    
    // Test types (moved from custom/config/test-types.json)
    testTypes: {
      types: [
        {
          "id": "VRT001",
          "name": "visual-diff",
          "description": "Visual regression testing"
        },
        {
          "id": "E2E001",
          "name": "e2e",
          "description": "End to end testing"
        }
      ]
    }
  };
