const express = require('express');
const prisma = require('../../lib/prisma');
const router = express.Router();

/* ═══════════════════════════════════════════════════════════════
   GET /api/designs
   Query: ?category=poster&page=1&limit=20&sessionId=xxx
═══════════════════════════════════════════════════════════════ */
router.get('/', async (req, res) => {
    const { category, sessionId, limit = 20, page = 1 } = req.query;

    const where = {
        ...(category && { category }),
        ...(sessionId && { sessionId }),
    };

    try {
        const [total, designs] = await Promise.all([
            prisma.design.count({ where }),
            prisma.design.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                select: {
                    id: true, title: true, prompt: true, category: true,
                    format: true, width: true, height: true, version: true,
                    assetUrls: true, inspoUrls: true, createdAt: true, sessionId: true,
                    // Omit html from list to keep response small
                },
            }),
        ]);

        // Parse JSON string arrays back to real arrays
        const parsed = designs.map(d => ({
            ...d,
            assetUrls: JSON.parse(d.assetUrls || '[]'),
            inspoUrls: JSON.parse(d.inspoUrls || '[]'),
        }));

        res.json({ ok: true, total, page: Number(page), limit: Number(limit), data: parsed });
    } catch (err) {
        console.error('[GET /api/designs]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/designs/:id
═══════════════════════════════════════════════════════════════ */
router.get('/:id', async (req, res) => {
    try {
        const design = await prisma.design.findUnique({ where: { id: req.params.id } });
        if (!design) return res.status(404).json({ ok: false, error: 'Design not found' });
        res.json({
            ok: true, data: {
                ...design,
                assetUrls: JSON.parse(design.assetUrls || '[]'),
                inspoUrls: JSON.parse(design.inspoUrls || '[]'),
            }
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/designs   (manual save — generate auto-saves too)
═══════════════════════════════════════════════════════════════ */
router.post('/', async (req, res) => {
    const { title, category = 'poster', html, prompt, format = '1:1',
        width = 1080, height = 1080, assetUrls = [], inspoUrls = [], sessionId } = req.body;

    if (!html || !prompt) {
        return res.status(400).json({ ok: false, error: 'html and prompt are required' });
    }

    try {
        const design = await prisma.design.create({
            data: {
                title, category, html, prompt, format, width, height, sessionId,
                assetUrls: JSON.stringify(assetUrls),
                inspoUrls: JSON.stringify(inspoUrls),
            },
        });
        res.status(201).json({ ok: true, data: { ...design, assetUrls, inspoUrls } });
    } catch (err) {
        console.error('[POST /api/designs]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   PATCH /api/designs/:id   (update title / category)
═══════════════════════════════════════════════════════════════ */
router.patch('/:id', async (req, res) => {
    const { title, category } = req.body;
    try {
        const design = await prisma.design.update({
            where: { id: req.params.id },
            data: { ...(title && { title }), ...(category && { category }) },
        });
        res.json({ ok: true, data: design });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/designs/:id
═══════════════════════════════════════════════════════════════ */
router.delete('/:id', async (req, res) => {
    try {
        await prisma.design.delete({ where: { id: req.params.id } });
        res.json({ ok: true, deleted: req.params.id });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   GET /api/designs/session/:sessionId/turns
   Returns the text-only conversation history for a session
═══════════════════════════════════════════════════════════════ */
router.get('/session/:sessionId/turns', async (req, res) => {
    try {
        const turns = await prisma.turn.findMany({
            where: { sessionId: req.params.sessionId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, role: true, text: true, createdAt: true },
        });
        res.json({ ok: true, data: turns });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
