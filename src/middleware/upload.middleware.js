const path = require('path');
const multer = require('multer');

const {MAX_UPLOAD_MB} = require('../configs/env.config');
const {UPLOAD_DIR ,createId, ensureTmpDirs} = require('../utils/file.utils');

ensureTmpDirs();

const storage = multer.diskStorage({
    destination: (req, file, cb) =>{
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) =>{
        const fileId = createId('file');
        file.fileId = fileId;

        cb(null, `${fileId}.pdf`);
    }
});

function fileFilter(req, file, cb){
    const isPDFMime = file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf';
    
    const hasPDFExtension = path.extname(file.originalname).toLowerCase() === '.pdf';

    if(isPDFMime || hasPDFExtension){
        return cb(null, true);
    }

    const err = new Error('Only PDF files are allowed!');
    err.statusCode = 400;
    cb(err);
    
}

const upload = multer({
storage, 
fileFilter, 
limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: 20
}
});

module.exports = upload.array('files', 20);
