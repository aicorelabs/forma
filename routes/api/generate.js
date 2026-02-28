const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const prisma = require('../../lib/prisma');
const router = express.Router();

const FORMATS = {
    '1:1': { w: 1080, h: 1080 },
    '9:16': { w: 1080, h: 1920 },
    '16:9': { w: 1920, h: 1080 },
    '1.91:1': { w: 1200, h: 628 },
    'print': { w: 800, h: 800 },
};

/* ═══════════════════════════════════════════════════════════════
   POST /api/generate
   Body (JSON):
   {
     prompt     : string            – user's design request
     format     : '1:1'|'9:16'|…   – canvas format key
     assetUrls  : string[]          – Cloudinary URLs (direct, no base64!)
     inspoUrls  : string[]          – Cloudinary URLs for inspiration
     messages   : Turn[]            – prior {role, text} turns from DB/state
     sessionId  : string?           – existing session to append to
   }
   Returns:
   { ok, data: { html, format, designId, sessionId } }
═══════════════════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
    const {
        prompt,
        format = '1:1',
        assetUrls = [],
        inspoUrls = [],
        messages = [],   // prior text-only turns [{role, text}]
        sessionId,         // optional — create one if missing
    } = req.body;

    if (!prompt) {
        return res.status(400).json({ ok: false, error: 'prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not set on server' });
    }

    const { w, h } = FORMATS[format] || FORMATS['1:1'];

    try {
        const ai = new GoogleGenAI({ apiKey });

        // ── Build the user parts for THIS turn ──────────────────────
        const userParts = [];

        // Assets — pass as fileData (direct Cloudinary URL, no base64 download!)
        if (assetUrls.length > 0) {
            userParts.push({
                text: `=== USER ASSETS (${assetUrls.length} image${assetUrls.length > 1 ? 's' : ''}) ===\nReference each in your HTML as {{ASSET_N}} (0-indexed).\n`
            });
            assetUrls.forEach((url, i) => {
                userParts.push({ text: `Asset ${i} → use {{ASSET_${i}}}:\n` });
                userParts.push({ fileData: { fileUri: url, mimeType: guessMime(url) } });
            });
        }

        // Inspirations — pass as fileData too
        if (inspoUrls.length > 0) {
            userParts.push({
                text: `\n=== STYLE REFERENCES (${inspoUrls.length} image${inspoUrls.length > 1 ? 's' : ''}) ===\nStudy these for colour, composition, typographic mood:\n`
            });
            inspoUrls.forEach((url, i) => {
                userParts.push({ text: `Reference ${i}:\n` });
                userParts.push({ fileData: { fileUri: url, mimeType: guessMime(url) } });
            });
        }

        userParts.push({
            text: `\n=== REQUEST ===\nCanvas: ${w}×${h}px\n${prompt}\n\nOutput the complete HTML+CSS design now. Start immediately with <!DOCTYPE html>.`
        });

        // ── Conversation history (text-only — images only in the FIRST turn) ─
        // Images are stripped from history to keep context small.
        // Only text exchanges are passed for iteration context.
        const historyContents = messages.map(m => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.text }],
        }));

        const contents = [
            ...historyContents,
            { role: 'user', parts: userParts },
        ];

        // ── Call Gemini 2.5 Pro ─────────────────────────────────────
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents,
            config: {
                systemInstruction: buildSystemPrompt(w, h),
                maxOutputTokens: 8192,
            },
        });

        let rawHTML = result.text;

        // Strip markdown fences if the model wrapped output
        rawHTML = rawHTML
            .replace(/^```html\s*/im, '')
            .replace(/^```\s*/im, '')
            .replace(/```\s*$/im, '')
            .trim();

        // ── Persist to DB ───────────────────────────────────────────
        // Upsert session
        const session = sessionId
            ? await prisma.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } })
            : await prisma.session.create({ data: {} });

        // Save this user turn (text only)
        const userTurnText = `[Canvas: ${w}×${h}] [Assets: ${assetUrls.length}] ${prompt}`;
        await prisma.turn.createMany({
            data: [
                { sessionId: session.id, role: 'user', text: userTurnText },
                { sessionId: session.id, role: 'model', text: rawHTML },
            ],
        });

        // Save the design artifact
        const design = await prisma.design.create({
            data: {
                prompt,
                html: rawHTML,
                format,
                width: w,
                height: h,
                assetUrls: JSON.stringify(assetUrls),  // SQLite: store as JSON string
                inspoUrls: JSON.stringify(inspoUrls),
                sessionId: session.id,
                version: messages.filter(m => m.role === 'model').length + 1,
            },
        });

        // ── Return result ───────────────────────────────────────────
        // modelTurn is text-only so client can persist and pass back next time
        res.json({
            ok: true,
            data: {
                html: rawHTML,
                format: { w, h },
                designId: design.id,
                sessionId: session.id,
                modelTurn: { role: 'model', text: rawHTML }, // append to state.messages
            },
        });

    } catch (err) {
        console.error('[/api/generate]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ── Helpers ────────────────────────────────────────────────── */

/** Guess MIME type from Cloudinary URL extension */
function guessMime(url) {
    if (/\.png(\?|$)/i.test(url)) return 'image/png';
    if (/\.webp(\?|$)/i.test(url)) return 'image/webp';
    if (/\.gif(\?|$)/i.test(url)) return 'image/gif';
    if (/\.svg(\?|$)/i.test(url)) return 'image/svg+xml';
    return 'image/jpeg'; // Cloudinary default
}

function buildSystemPrompt(w, h) {
    return `You are FORMA, an elite AI art director and graphic designer.

You craft graphic artifacts — posters, social cards, campaign visuals, editorial spreads — using HTML and CSS as your medium, the way a printmaker uses ink and paper.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Output ONLY the raw HTML document. Begin immediately with <!DOCTYPE html>.
2. No markdown fences. No preamble. No explanation after. Just HTML.
3. The canvas is exactly ${w}px × ${h}px. Enforce with:
   html, body { width: ${w}px; height: ${h}px; overflow: hidden; margin: 0; padding: 0; }
4. Never use scrolling, viewport units (vw/vh), or relative widths — absolute px only.
5. All fonts must be loaded via Google Fonts @import inside a <style> tag.
6. No external JS. CSS only for all visual effects.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSET USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User-uploaded assets are provided as images. Reference them with:
  {{ASSET_0}}  ← first uploaded asset
  {{ASSET_1}}  ← second uploaded asset

Use as image src or CSS background:
  <img src="{{ASSET_0}}">
  background-image: url('{{ASSET_1}}')

Inspiration images are for style reference only — do NOT use {{ASSET_N}} for them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Think like an art director, not a web developer
- Hierarchy is everything — one element dominates, everything else serves it
- Use position: absolute for all layers — this is a canvas, not a document
- Use mix-blend-mode, clip-path, backdrop-filter, gradients aggressively
- Typography at scale: giant headline vs tiny caption creates energy
- Iterate faithfully — keep what works, fix what the user asks to change`;
}

module.exports = router;
