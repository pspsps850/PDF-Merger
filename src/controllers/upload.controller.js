const fs = require('fs');
const {PDFDocument} = require('pdf-lib');

const {getUploadPath, getMetaPath, writeJson} = require('../utils/file.utils');
const {httpError} = require('../middleware/errorHandler.middleware');
const {inspectRenderable} = require('../services/pdfPreview.service');

// Encrypted uploads: pdf-lib can't decrypt. If PDF.js renders the file
// without a password (permissions-only/empty-user-password encryption),
// accept it and merge its pages later as flattened images; otherwise reject.
function probeRenderOnly(fileId, originalName) {
  return inspectRenderable(fileId).catch((probeErr) => {
    if (probeErr && (probeErr.name === 'PasswordException' || /password/i.test(String(probeErr.message)))) {
      throw httpError(400, `"${originalName}" requires a password. Save a copy without the password and upload again.`);
    }
    throw httpError(400, `File "${originalName}" could not be read (encrypted or damaged). Save an unlocked copy and upload again.`);
  });
}

async function uploadFiles(req, res, next) {
    const results = [];
    const writtenPaths = [];

    try{
     for(const file of req.files){
      const filePath = getUploadPath(file.fileId);
    const metaPath = getMetaPath(file.fileId);

    writtenPaths.push(filePath, metaPath);

    const bytes = await fs.promises.readFile(file.path);

    let pageCount;
    let flatten = false;

    try{
        const pdfDoc = await PDFDocument.load(bytes, {updateMetadata: false});
        pageCount = pdfDoc.getPageCount();
    } catch (err) {
        if (!/is encrypted/.test(err.message)) {
            throw httpError(400, `File "${file.originalname}" is not a readable PDF.`);
        }
        const probe = await probeRenderOnly(file.fileId, file.originalname);
        pageCount = probe.pageCount;
        flatten = true;
    }

    const meta = {
        fileId: file.fileId,
        originalName: file.originalname,
        pageCount,
        size: file.size,
        createdAt: new Date().toISOString(),
        flatten
    };

        await writeJson(metaPath, meta);

        results.push({
            fileId: file.fileId,
            originalName: file.originalname,
            pageCount,
            size: file.size,
            createdAt: meta.createdAt,
            flatten
        });
     }

     res.status(201).json({
         files: results
     });
    }catch (err) {
        await Promise.all(writtenPaths.map((path) => fs.promises.unlink(path).catch(() => {})));
        next(err);
    }
}

async function removeUpload(req, res, next) {
  try {
    const uploadPath = getUploadPath(req.params.fileId);
    const metaPath = getMetaPath(req.params.fileId);

    const [uploadGone, metaGone] = await Promise.all([
      fs.promises.unlink(uploadPath).then(() => true).catch((err) => err),
      fs.promises.unlink(metaPath).then(() => true).catch(() => false),
    ]);

    const removedUpload = uploadGone === true || (uploadGone instanceof Error && uploadGone.code !== 'ENOENT');
    const existed = removedUpload || metaGone;

    if (!existed) {
      throw httpError(404, 'Upload not found.');
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
    uploadFiles,
    removeUpload
};
