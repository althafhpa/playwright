import { defineConfig, devices } from '@playwright/test';
const config = require('./config');

// Determine if storage state should be used based on authentication method
const useStorageState = (app) => {
  if (!app) return undefined;
  
  const authMethod = process.env[`AUTHENTICATION_${app.toUpperCase()}`] || 
                    (config.authentication && config.authentication[app.toLowerCase()]);
  return authMethod && authMethod !== 'NONE' ? 'playwright/.auth/user.json' : undefined;
};

// Create projects for all available devices
const allDeviceProjects = Object.entries(devices).map(([deviceName, deviceConfig]) => {
  // Create a sanitized name for the project (remove spaces, etc.)
  const projectName = deviceName.toLowerCase().replace(/\s+/g, '-');
  
  return {
    name: projectName,
    use: {
      ...deviceConfig,
      // Add default launch options for desktop browsers
      ...(deviceName.includes('Desktop') ? {
        launchOptions: {
          args: ['--headless', '--no-startup-window']
        }
      } : {})
    }
  };
});

// Define custom projects with explicit configurations
const customProjects = [
  // For chromium-desktop
  {
    name: 'chromium-desktop',
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1920, height: 1080 },
      launchOptions: {
        args: [
          '--headless', 
          '--no-startup-window',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage'
        ]
      }
    }
  },
  {
    name: 'webkit-desktop',
    use: {
      ...devices['Desktop Safari'],
      viewport: { width: 1920, height: 1080 },
      launchOptions: {
        args: ['--headless', '--no-startup-window']
      }
    }
  },
  {
    name: 'firefox-desktop',
    use: {
      ...devices['Desktop Firefox'],
      viewport: { width: 1920, height: 1080 },
      launchOptions: {
        args: process.env.CI ? [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ] : []
      }
    }
  },
  {
    name: 'iphone-14-pro-max',
    use: {
      ...devices['iPhone 14 Pro Max'],
    }
  },
  {
    name: 'samsung-s23-ultra',
    use: {
      ...devices['Galaxy S23 Ultra'],
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 3.5,
      isMobile: true,
      hasTouch: true
    }
  }
];

export default defineConfig({
  // Run global setup for all authentication methods
  globalSetup: process.env.APP ? require.resolve('./global-setup') : undefined,
  testDir: './tests',
  timeout: 180000,
  expect: {
    timeout: 60000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.APP === "baseline" ? 0 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list']
  ],
  use: {
    headless: process.env.CI ? true : false,
    actionTimeout: 60000,
    navigationTimeout: 120000,
    trace: 'on-first-retry',
    storageState: useStorageState(process.env.APP),
    launchOptions: {
      slowMo: 1000
    }
  },
  
  // Combine custom projects with all device projects
  projects: [
    //custom projects first (these will be the ones you typically use)
    ...customProjects,
    
    // All predefined device projects
    ...allDeviceProjects
  ]
});
