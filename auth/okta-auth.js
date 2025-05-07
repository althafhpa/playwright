import dotenv from 'dotenv';
const axios = require('axios');
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

dotenv.config();

class OktaAuth {
    async authenticate() {
        try {
            console.log('Starting Okta authentication process...');
            
            // Step 1: Initial authentication with username and password
            console.log('Authenticating with Okta API...');
            const authResult = await axios.post(`https://${process.env.OKTA_DOMAIN}/api/v1/authn`, {
                username: process.env.OKTA_USERNAME,
                password: process.env.OKTA_PASSWORD,
                options: {
                    multiOptionalFactorEnroll: false,
                    warnBeforePasswordExpired: false
                }
            });

            // Step 2: Handle security question verification
            console.log('Handling security verification...');
            const verifyUrl = authResult.data._embedded.factors[0]._links.verify.href;
            const securityAnswer = await axios.post(verifyUrl, {
                stateToken: authResult.data.stateToken,
                answer: process.env.OKTA_ANSWER
            });

            // Step 3: Construct OAuth authorization URL with session token
            console.log('Constructing OAuth authorization URL...');
            const authUrl = `https://${process.env.OKTA_DOMAIN}/oauth2/default/v1/authorize?` +
                `client_id=${process.env.OKTA_CLIENT_ID}` +
                `&response_type=code` +
                `&scope=openid profile email groups` +
                `&redirect_uri=${encodeURIComponent(process.env.OKTA_REDIRECT_URI)}` +
                `&sessionToken=${securityAnswer.data.sessionToken}`;

            // Step 4: Launch browser and navigate to the authorization URL
            console.log('Launching browser for session capture...');
            const browser = await chromium.launch();
            const context = await browser.newContext();
            const page = await context.newPage();

            // Navigate to the auth URL to establish the session
            await page.goto(authUrl);
            
            // Ensure the auth directory exists
            const authDir = path.join('playwright', '.auth');
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }
            
            // Step 5: Store the authenticated session state
            console.log('Storing authenticated session state...');
            await context.storageState({ path: path.join(authDir, 'user.json') });
            
            // Close browser
            await browser.close();
            
            console.log('Okta authentication completed successfully');
        } catch (error) {
            console.error('Okta authentication failed:');
            if (error.response) {
                console.error('Error details:', error.response.data);
            } else {
                console.error('Error:', error.message);
            }
            throw error;
        }
    }
}

module.exports = { OktaAuth };
