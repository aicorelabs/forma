const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
//  POST /api/export/html
//  Returns the design HTML as a downloadable file
// ═══════════════════════════════════════════════════════════════
router.post('/html', (req, res) => {
    const { html, filename = 'forma-design' } = req.body;

    if (!html) return res.status(400).json({ ok: false, error: 'html is required' });

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
    res.send(html);
});

// ═══════════════════════════════════════════════════════════════
//  POST /api/export/image
//  Server-side PNG export via headless browser (Puppeteer/Playwright)
//  TODO: install puppeteer and implement
// ═══════════════════════════════════════════════════════════════
router.post('/image', async (req, res) => {
    const { html, filename = 'forma-design', format = 'png' } = req.body;

    if (!html) return res.status(400).json({ ok: false, error: 'html is required' });

    try {
        // TODO: uncomment when puppeteer is installed (`npm i puppeteer`)
        //
        // const puppeteer = require('puppeteer');
        // const browser = await puppeteer.launch();
        // const page    = await browser.newPage();
        // await page.setContent(html, { waitUntil: 'networkidle0' });
        // const screenshot = await page.screenshot({ type: format, fullPage: false });
        // await browser.close();
        // res.setHeader('Content-Type', `image/${format}`);
        // res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
        // return res.send(screenshot);

        // Stub — server-side render not yet wired
        res.status(501).json({
            ok: false,
            error: 'Server-side image export not yet implemented. Use client-side html2canvas in the meantime.',
            todo: 'Install puppeteer and uncomment the implementation in routes/api/export.js',
        });
    } catch (err) {
        console.error('[/api/export/image]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
