const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const config = require('../config'); // Import the config

dotenv.config();

class BasicAuth {
  async authenticate() {
    console.log('Setting up Basic authentication session...');
    
    try {
      // Create browser with Basic Auth credentials
      const browser = await chromium.launch();
      const context = await browser.newContext({
        httpCredentials: {
          username: process.env.HTTP_USERNAME,
          password: process.env.HTTP_PASSWORD
        }
      });
      
      // Visit the site once to establish the authentication
      console.log('Visiting site to establish Basic Auth session...');
      const page = await context.newPage();
      
      // Determine which URL to use based on the APP environment variable
      let baseUrl = process.env.APP === "baseline" 
        ? process.env.BASELINE_URL 
        : process.env.COMPARISON_URL;
        
      // Ensure baseUrl is defined - use config values as fallbacks instead of localhost
      if (!baseUrl) {
        console.log('No base URL found in environment variables, using config URL');
        baseUrl = process.env.APP === "baseline" 
          ? config.urls.baseline 
          : config.urls.comparison;
      }
      
      console.log(`Navigating to ${baseUrl} with Basic Auth...`);
      const response = await page.goto(baseUrl);
      
      // Check if authentication was successful
      if (response.status() === 401) {
        throw new Error('Basic authentication failed - received 401 Unauthorized');
      }
      
      console.log(`Basic Auth response status: ${response.status()}`);
      
      // Ensure the auth directory exists
      const authDir = path.join('playwright', '.auth');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }
      
      // Save the authenticated state with Basic Auth credentials
      const statePath = path.join(authDir, 'user.json');
      console.log(`Saving authentication state to ${statePath}...`);
      await context.storageState({ path: statePath });
      
      await page.close();
      await context.close();
      await browser.close();
      
      console.log('Basic authentication session created and saved successfully');
    } catch (error) {
      console.error('Basic authentication failed:');
      console.error('Error:', error.message);
      throw error;
    }
  }
}

module.exports = { BasicAuth };
