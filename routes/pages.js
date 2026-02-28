const express = require('express');
const path = require('path');
const router = express.Router();

const VIEW = (file) => path.join(__dirname, '..', 'views', file);

// ── Homepage ────────────────────────────────────────────────────
router.get('/', (req, res) => res.sendFile(VIEW('index.html')));

// ── App (canvas + chat) ─────────────────────────────────────────
router.get('/app', (req, res) => res.sendFile(VIEW('forma-app.html')));

// ── Library ─────────────────────────────────────────────────────
router.get('/library', (req, res) => res.sendFile(VIEW('library.html')));

// ── Design System docs ──────────────────────────────────────────
router.get('/design-system', (req, res) => res.sendFile(VIEW('forma-design-system.html')));

// ── Base Prompt docs ────────────────────────────────────────────
router.get('/prompt', (req, res) => res.sendFile(VIEW('forma-base-prompt.html')));

// ── Misc ─────────────────────────────────────────────────────────
router.get('/pic', (req, res) => res.sendFile(VIEW('pic.html')));

// ── Legacy .html aliases (redirect to clean URLs) ───────────────
router.get('/forma-app.html', (req, res) => res.redirect(301, '/app'));
router.get('/library.html', (req, res) => res.redirect(301, '/library'));
router.get('/forma-design-system.html', (req, res) => res.redirect(301, '/design-system'));
router.get('/forma-base-prompt.html', (req, res) => res.redirect(301, '/prompt'));
router.get('/index.html', (req, res) => res.redirect(301, '/'));
router.get('/pic.html', (req, res) => res.redirect(301, '/pic'));

module.exports = router;
