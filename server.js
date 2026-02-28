require('dotenv').config();          // load .env before anything else

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static: public/ (CSS, client JS, images, etc.) ──────────────
// Serves /css/forma-app.css, /js/…, /images/… etc.
app.use(express.static(path.join(__dirname, 'public')));

// ── Static: root-level assets (fonts, legacy paths) ─────────────
// Keep serving anything in the root that isn't a view
app.use(express.static(path.join(__dirname), {
    index: false,     // don't auto-serve index.html — page router does it
    extensions: [],   // don't auto-append .html
}));

// ── API Routers ──────────────────────────────────────────────────
app.use('/api/upload', require('./routes/api/upload'));
app.use('/api/designs', require('./routes/api/designs'));
app.use('/api/generate', require('./routes/api/generate'));
app.use('/api/export', require('./routes/api/export'));

// ── Page Router (clean URLs + .html redirects) ───────────────────
app.use('/', require('./routes/pages'));

// ── 404 ─────────────────────────────────────────────────────────
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ ok: false, error: `Route ${req.method} ${req.path} not found` });
    }
    res.status(404).sendFile(path.join(__dirname, 'views', 'index.html'));
});

// ── Error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api')) {
        return res.status(500).json({ ok: false, error: err.message });
    }
    res.status(500).send('Internal Server Error');
});

// ── Start ────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('\n  ┌────────────────────────────────────────────────────┐');
    console.log('  │                                                    │');
    console.log(`  │   FORMA  ✦  http://localhost:${PORT}               │`);
    console.log('  │                                                    │');
    console.log('  │   Structure                                        │');
    console.log('  │   views/         → HTML templates                  │');
    console.log('  │   public/css/    → extracted stylesheets           │');
    console.log('  │                                                    │');
    console.log('  │   Pages                                            │');
    console.log('  │   GET  /                  → homepage               │');
    console.log('  │   GET  /app               → design studio          │');
    console.log('  │   GET  /library           → design library         │');
    console.log('  │   GET  /design-system     → design system docs     │');
    console.log('  │   GET  /prompt            → base prompt docs       │');
    console.log('  │                                                    │');
    console.log('  │   API                                              │');
    console.log('  │   POST /api/upload        → Cloudinary upload      │');
    console.log('  │   POST /api/generate      → AI generation          │');
    console.log('  │   GET  /api/designs       → list designs           │');
    console.log('  │   GET  /api/designs/:id   → get design             │');
    console.log('  │   POST /api/export/html   → download HTML          │');
    console.log('  └────────────────────────────────────────────────────┘\n');
});
