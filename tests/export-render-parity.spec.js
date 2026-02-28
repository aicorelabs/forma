/**
 * tests/export-render-parity.spec.js
 *
 * End-to-end test: verifies the exported PNG produced by html2canvas
 * matches what Playwright (native browser) renders from the same HTML.
 *
 * Strategy
 * ─────────
 * 1. Inject a known, deterministic HTML design into the app via
 *    window.renderDesign() — no AI call, fast, reproducible.
 * 2. Playwright opens the same HTML in a dedicated full-size page and
 *    takes a screenshot → "ground truth" PNG.
 * 3. Click "Export → Download Image" in the app and intercept the
 *    download → "html2canvas" PNG.
 * 4. Compare pixel-by-pixel with pixelmatch.
 * 5. Assert mismatch pixel ratio < threshold.
 *
 * Three fixtures are tested:
 *   sans  – system sans-serif only, 5 % threshold  (fast, baseline)
 *   serif – Playfair Display (Google Font), 8 % threshold
 *   mono  – Space Mono (Google Font), 8 % threshold
 */

const { test, expect } = require('@playwright/test');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const path = require('path');
const fs = require('fs');

// ── Global config ─────────────────────────────────────────────────
const DESIGN_W = 1080;
const DESIGN_H = 1080;
const DIFF_DIR = path.join(__dirname, '..', 'test-artifacts');

// ── Test fixtures ─────────────────────────────────────────────────
const FIXTURES = [
    {
        id: 'sans',
        label: 'system sans-serif (no web fonts)',
        threshold: 0.05,   // 5 %  — very strict, no font variance
        settleMs: 400,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
html,body{width:${DESIGN_W}px;height:${DESIGN_H}px;margin:0;padding:0;overflow:hidden;
  background:#08080A;font-family:sans-serif;}
.wrapper{width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:40px;}
.headline{font-size:140px;font-weight:900;color:#E9C229;
  letter-spacing:-4px;line-height:1;text-transform:uppercase;}
.sub{font-size:28px;color:rgba(255,255,255,.6);
  letter-spacing:.25em;text-transform:uppercase;}
.bar{width:480px;height:6px;
  background:linear-gradient(90deg,#E9C229,#FF4F1A);border-radius:3px;}
.box{width:200px;height:200px;background:#1A1A1F;border:2px solid #E9C229;
  border-radius:12px;position:absolute;top:60px;right:80px;
  display:flex;align-items:center;justify-content:center;font-size:80px;}
</style></head>
<body>
<div class="wrapper">
  <div class="headline">FORMA</div>
  <div class="bar"></div>
  <div class="sub">AI Design Studio · Test Render</div>
</div>
<div class="box">◈</div>
</body></html>`,
    },

    {
        id: 'serif',
        label: 'Playfair Display — elegant serif Google Font',
        threshold: 0.08,   // 8 % — web fonts cause minor sub-pixel differences
        settleMs: 1200,   // extra time for font download + render
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap" rel="stylesheet">
<style>
html,body{width:${DESIGN_W}px;height:${DESIGN_H}px;margin:0;padding:0;overflow:hidden;
  background:#0D0A08;}
.canvas{width:100%;height:100%;position:relative;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:32px;}
.title{font-family:'Playfair Display',serif;font-size:128px;font-weight:900;
  font-style:italic;color:#F5E6C8;letter-spacing:-2px;line-height:1;
  text-align:center;}
.rule{width:560px;height:1px;background:#8C6E4B;}
.sub{font-family:'Playfair Display',serif;font-size:22px;font-weight:400;
  font-style:italic;color:rgba(245,230,200,.5);letter-spacing:.18em;
  text-transform:uppercase;}
.corner{position:absolute;bottom:64px;right:72px;font-family:'Playfair Display',serif;
  font-size:13px;color:rgba(255,255,255,.25);letter-spacing:.12em;text-transform:uppercase;}
.accent{position:absolute;top:0;left:0;width:8px;height:100%;
  background:linear-gradient(180deg,#8C6E4B,transparent);}
</style></head>
<body>
<div class="canvas">
  <div class="accent"></div>
  <div class="title">Eleganza</div>
  <div class="rule"></div>
  <div class="sub">A study in editorial typography</div>
  <div class="corner">Forma Studio · Series I</div>
</div>
</body></html>`,
    },

    {
        id: 'mono',
        label: 'Space Mono — monospace Google Font',
        threshold: 0.08,   // 8 %
        settleMs: 1200,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
html,body{width:${DESIGN_W}px;height:${DESIGN_H}px;margin:0;padding:0;overflow:hidden;
  background:#020408;}
.canvas{width:100%;height:100%;position:relative;overflow:hidden;}
/* grid lines */
.grid{position:absolute;inset:0;
  background-image:
    linear-gradient(rgba(0,255,180,.04) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,255,180,.04) 1px,transparent 1px);
  background-size:54px 54px;}
.content{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:flex-start;justify-content:center;padding:96px;}
.prompt{font-family:'Space Mono',monospace;font-size:13px;color:#00FFB4;
  letter-spacing:.06em;margin-bottom:32px;}
.headline{font-family:'Space Mono',monospace;font-size:96px;font-weight:700;
  color:#fff;letter-spacing:-3px;line-height:.95;margin-bottom:40px;}
.cursor{display:inline-block;width:64px;height:8px;
  background:#00FFB4;vertical-align:middle;margin-left:12px;
  animation:none;}  /* static for test reproducibility */
.tags{display:flex;gap:12px;flex-wrap:wrap;}
.tag{font-family:'Space Mono',monospace;font-size:11px;
  border:1px solid rgba(0,255,180,.4);color:rgba(0,255,180,.7);
  padding:6px 16px;border-radius:2px;letter-spacing:.08em;}
.led{position:absolute;top:72px;right:72px;
  font-family:'Space Mono',monospace;font-size:11px;
  color:rgba(0,255,180,.35);letter-spacing:.1em;text-align:right;
  line-height:2;}
</style></head>
<body>
<div class="canvas">
  <div class="grid"></div>
  <div class="content">
    <div class="prompt">&gt; forma.generate("terminal poster")_</div>
    <div class="headline">CODE<br>DREAM.<span class="cursor"></span></div>
    <div class="tags">
      <div class="tag">HTML+CSS</div>
      <div class="tag">AI-GEN</div>
      <div class="tag">EXPORT</div>
    </div>
  </div>
  <div class="led">
    SYS ONLINE<br>
    VER 1.0.0<br>
    STATUS OK
  </div>
</div>
</body></html>`,
    },
];

// ── Helpers ───────────────────────────────────────────────────────

function parsePNG(buf) {
    return new Promise((resolve, reject) => {
        new PNG().parse(buf, (err, png) => err ? reject(err) : resolve(png));
    });
}

function writeDiff(img1, img2, w, h, name) {
    fs.mkdirSync(DIFF_DIR, { recursive: true });
    const diff = new PNG({ width: w, height: h });
    pixelmatch(img1, img2, diff.data, w, h, { threshold: 0.1, includeAA: true });
    fs.writeFileSync(path.join(DIFF_DIR, name), PNG.sync.write(diff));
}

async function runParityTest({ page, context }, fixture) {
    const { id, html, threshold, settleMs } = fixture;

    // ── 1. Ground truth ──────────────────────────────────────────────
    const truthPage = await context.newPage();
    await truthPage.setViewportSize({ width: DESIGN_W, height: DESIGN_H });
    await truthPage.setContent(html, { waitUntil: 'networkidle' });
    // Wait for web fonts to fully settle
    await truthPage.evaluate(() =>
        document.fonts ? document.fonts.ready : Promise.resolve()
    );
    await truthPage.waitForTimeout(settleMs);

    const truthBuf = await truthPage.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: DESIGN_W, height: DESIGN_H },
    });
    await truthPage.close();

    fs.mkdirSync(DIFF_DIR, { recursive: true });
    fs.writeFileSync(path.join(DIFF_DIR, `${id}-ground-truth.png`), truthBuf);

    // ── 2. Inject into the app ───────────────────────────────────────
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.evaluate((h) => window.renderDesign(h), html);
    await page.waitForTimeout(settleMs);

    // ── 3. Export → Download Image ───────────────────────────────────
    await page.click('#btn-export');
    await page.waitForSelector('#export-drawer.open', { timeout: 4000 });

    const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90_000 }),
        page.getByText('Download Image').click(),
    ]);

    const exportedPath = path.join(DIFF_DIR, `${id}-exported.png`);
    await download.saveAs(exportedPath);
    const exportedBuf = fs.readFileSync(exportedPath);

    // ── 4. Parse ─────────────────────────────────────────────────────
    const [truth, exported] = await Promise.all([
        parsePNG(truthBuf),
        parsePNG(exportedBuf),
    ]);

    // ── 5. Dimension assertions ───────────────────────────────────────
    expect(exported.width, `[${id}] PNG width`).toBe(DESIGN_W);
    expect(exported.height, `[${id}] PNG height`).toBe(DESIGN_H);

    // ── 6. Pixel comparison ───────────────────────────────────────────
    const totalPixels = DESIGN_W * DESIGN_H;
    const mismatchCount = pixelmatch(
        truth.data, exported.data, null,
        DESIGN_W, DESIGN_H,
        { threshold: 0.1, includeAA: true }
    );
    const mismatchRatio = mismatchCount / totalPixels;

    writeDiff(truth.data, exported.data, DESIGN_W, DESIGN_H, `${id}-diff.png`);

    console.log(
        `\n  [${id}] Pixel mismatch: ${mismatchCount.toLocaleString()} / ` +
        `${totalPixels.toLocaleString()} (${(mismatchRatio * 100).toFixed(2)} %)` +
        `  threshold: ${(threshold * 100).toFixed(0)} %` +
        `\n  Diff: ${path.join(DIFF_DIR, `${id}-diff.png`)}\n`
    );

    expect(
        mismatchRatio,
        `[${id}] Pixel mismatch ${(mismatchRatio * 100).toFixed(2)}% exceeds ` +
        `${(threshold * 100).toFixed(0)}% threshold.\n` +
        `Open test-artifacts/${id}-diff.png to inspect.`
    ).toBeLessThan(threshold);
}

// ── Tests ─────────────────────────────────────────────────────────

test.describe('Export PNG ↔ iframe render parity', () => {

    for (const fixture of FIXTURES) {
        test(
            `[${fixture.id}] ${fixture.label} — exported PNG ≈ native render`,
            async ({ page, context }) => runParityTest({ page, context }, fixture)
        );
    }

    // ── Sanity: every fixture must produce a valid PNG file ──────────
    for (const fixture of FIXTURES) {
        test(`[${fixture.id}] exported PNG is a valid 1080×1080 file`, async ({ page }) => {
            await page.goto('/app');
            await page.waitForLoadState('networkidle');
            await page.evaluate((h) => window.renderDesign(h), fixture.html);
            await page.waitForTimeout(fixture.settleMs);

            await page.click('#btn-export');
            await page.waitForSelector('#export-drawer.open', { timeout: 4000 });

            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 90_000 }),
                page.getByText('Download Image').click(),
            ]);

            const buf = await download.createReadStream().then(stream =>
                new Promise((res, rej) => {
                    const chunks = [];
                    stream.on('data', c => chunks.push(c));
                    stream.on('end', () => res(Buffer.concat(chunks)));
                    stream.on('error', rej);
                })
            );

            const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            expect(buf.length).toBeGreaterThan(1000);
            expect(buf.slice(0, 8).equals(PNG_MAGIC), 'PNG magic bytes').toBe(true);

            const png = await parsePNG(buf);
            expect(png.width, `[${fixture.id}] width`).toBe(DESIGN_W);
            expect(png.height, `[${fixture.id}] height`).toBe(DESIGN_H);
        });
    }
});
