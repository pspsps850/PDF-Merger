const router = require('express').Router();

const {getJob, downloadJob} = require('../controllers/job.controller');

router.get('/:jobId', getJob);
router.get('/:jobId/download', downloadJob);

module.exports = router;