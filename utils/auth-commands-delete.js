const { test: base } = require('@playwright/test');

exports.test = base.extend({
    authenticatedPage: async ({ page }, use) => {
        // Create storage state directory if it doesn't exist
        const fs = require('fs');
        const path = require('path');
        const authDir = path.join('playwright', '.auth');
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        const storageState = path.join(authDir, 'user.json');

        try {
            // Try to use existing auth state
            await page.context().storageState({ path: storageState });
            await page.goto('/');

            // Verify if we're actually logged in
            const isOktaPage = await page.url().includes('okta');
            if (isOktaPage) {
                throw new Error('Session expired');
            }
        } catch {
            // Perform fresh login
            //await page.goto('/');

            // Wait for Okta form
            await page.waitForSelector('input[name="identifier"]');
            await page.fill('input[name="identifier"]', process.env.OKTA_USERNAME);
            await page.click('[type="submit"]');

            await page.waitForSelector('input[name="credentials.passcode"]');
            await page.fill('input[name="credentials.passcode"]', process.env.OKTA_PASSWORD);
            await page.click('[type="submit"]');

            await page.waitForSelector('input[name="credentials.answer"]');
            await page.fill('input[name="credentials.answer"]', process.env.OKTA_ANSWER);
            await page.click('[type="submit"]');

            // Wait for successful login
            await page.waitForURL(url => !url.includes('okta') && !url.includes('login-preprod'));

            // Save authenticated state
            await page.context().storageState({ path: storageState });
        }

        await use(page);
    }
});
