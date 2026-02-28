const express = require('express');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const router = express.Router();

// — Cloudinary config (reads from .env via dotenv in server.js) —
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// — Multer: store in memory so we can stream to Cloudinary —
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
        cb(null, allowed.includes(file.mimetype));
    },
});

/* ═══════════════════════════════════════════════════════════════
   POST /api/upload
   Body: multipart/form-data
     files[]  – one or more image files
     type     – 'asset' | 'inspo'  (used as a Cloudinary tag)

   Returns:
   {
     ok: true,
     data: [{ url, publicId, width, height, format, originalName }]
   }
═══════════════════════════════════════════════════════════════ */
router.post('/', upload.array('files', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ ok: false, error: 'No files received' });
    }

    const uploadType = req.body.type === 'inspo' ? 'inspo' : 'asset';

    try {
        const results = await Promise.all(
            req.files.map(file => uploadToCloudinary(file, uploadType))
        );
        res.json({ ok: true, data: results });
    } catch (err) {
        console.error('[/api/upload]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/upload/:publicId
   Removes an asset from Cloudinary when user clicks ✕
═══════════════════════════════════════════════════════════════ */
router.delete('/:publicId', async (req, res) => {
    try {
        // publicId arrives URL-encoded from the client (slashes → %2F)
        const publicId = decodeURIComponent(req.params.publicId);
        await cloudinary.uploader.destroy(publicId);
        res.json({ ok: true, deleted: publicId });
    } catch (err) {
        console.error('[DELETE /api/upload]', err);
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── Helper ────────────────────────────────────────────────────
function uploadToCloudinary(file, type) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `forma/${type}s`,      // forma/assets  or  forma/inspos
                tags: ['forma', type],
                resource_type: 'image',
                allowed_formats: ['jpg', 'png', 'webp', 'gif', 'svg'],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    originalName: file.originalname,
                });
            }
        );
        stream.end(file.buffer);
    });
}

module.exports = router;
