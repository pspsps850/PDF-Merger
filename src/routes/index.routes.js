const router = require('express').Router();

const uploadRoutes = require('./upload.routes');
const mergeRoutes = require('./merge.routes');
const previewRoutes = require('./preview.routes');
const jobRoutes = require('./job.routes');
const {MAX_UPLOAD_MB} = require('../configs/env.config');

router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

router.get('/api/limits', (req, res) => {
    res.json({ MAX_UPLOAD_MB });
});

router.use('/api/upload', uploadRoutes);
router.use('/api/merge', mergeRoutes);
router.use('/api/preview', previewRoutes);
router.use('/api/job', jobRoutes);

module.exports = router;