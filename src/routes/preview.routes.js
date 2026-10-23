const router = require('express').Router();

const {getPagePreview} = require('../controllers/preview.controller');

router.get('/:fileId/pages/:page', getPagePreview);

module.exports = router;