const routes= require('express').Router();

const upload = require('../middleware/upload.middleware');
const {validateUpload} = require('../middleware/validation.middleware');
const {uploadFiles, removeUpload} = require('../controllers/upload.controller');

routes.post('/', upload, validateUpload, uploadFiles);
routes.delete('/:fileId', removeUpload);


module.exports = routes;