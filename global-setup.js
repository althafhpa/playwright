const path = require('path');
const config = require('./config');
const dotenv = require('dotenv');

dotenv.config();

async function globalSetup() {
  const app = process.env.APP; // "baseline" or "comparison"
  
  if (!app) {
    console.log('No APP environment variable set, skipping authentication');
    return;
  }
  
  // Get authentication method from config
  // BASIC auth required for each URL so applied using browser context
  // rather than verified in test.beforeAll
  const authMethod = config.authentication[app.toLowerCase()];
  
  if (!authMethod || authMethod === 'NONE' || authMethod === 'BASIC') {
    console.log(`No authentication required for ${app}`);
    return;
  }
  
  try {
    // Convert authentication method to proper case for the file name
    // e.g., 'OKTA' -> 'Okta', 'BASIC' -> 'Basic'
    const authClassName = authMethod.charAt(0).toUpperCase() + authMethod.slice(1).toLowerCase() + 'Auth';
    
    // Dynamically import the authentication module
    const authModulePath = `./auth/${authMethod.toLowerCase()}-auth`;
    const { [authClassName]: AuthClass } = require(authModulePath);
    
    if (!AuthClass) {
      throw new Error(`Authentication class ${authClassName} not found in module ${authModulePath}`);
    }
    
    // Create an instance of the authentication class and authenticate
    const auth = new AuthClass();
    await auth.authenticate();
    
    console.log(`Global ${authMethod} authentication completed for ${app}`);
  } catch (error) {
    console.error(`Authentication failed for ${app} using method ${authMethod}:`, error);
    throw error; // Re-throw to fail the setup
  }
}

module.exports = globalSetup;
