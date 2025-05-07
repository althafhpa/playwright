const express = require('express');
const path = require('path');
const config = require('../../config.js');

// Get the root directory from config
const REPORTS_ROOT_DIR = config.reporting.rootDir || 'public';
const PORT = config.server.port || 9222;

const app = express();

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), REPORTS_ROOT_DIR)));

// Start the server
app.listen(PORT, async () => {
  const url = `http://localhost:${PORT}/visual-diff/dashboard.html`;
  console.log(`Server running at ${url}`);
  console.log(`Serving files from: ${path.join(process.cwd(), REPORTS_ROOT_DIR)}`);
  
  // Use dynamic import for the open package
  try {
    const open = await import('open');
    await open.default(url);
  } catch (error) {
    console.log('Could not automatically open browser. Please navigate to the URL manually.');
    console.log(`URL: ${url}`);
  }
});
