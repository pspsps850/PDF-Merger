const router = require('express').Router();

const {validateMerge} = require('../middleware/validation.middleware');
const {createMergeJob} = require('../controllers/merge.controller');

router.post('/', validateMerge, createMergeJob);

module.exports = router;