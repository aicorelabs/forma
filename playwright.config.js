// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 120_000,          // generous — exportImage renders a 1080px iframe
    retries: 1,
    use: {
        headless: true,
        baseURL: 'http://localhost:3005',
        viewport: { width: 1440, height: 900 },
    },
    // Start the server automatically when running tests
    webServer: {
        command: 'PORT=3005 node server.js',
        url: 'http://localhost:3005',
        reuseExistingServer: true,
        timeout: 15_000,
    },
});
