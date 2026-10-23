const fs = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

const {
  getUploadPath,
  getMetaPath,
  getPreviewPath,
  readJson,
  pathExists,
  ensureTmpDirs
} = require('../utils/file.utils');

const { PREVIEW_SCALE } = require('../configs/env.config');
const { httpError } = require('../middleware/errorHandler.middleware');

async function getPageCount(fileId) {
  try {
    const meta = await readJson(getMetaPath(fileId));

    if (Number.isInteger(meta.pageCount) && meta.pageCount > 0) {
      return meta.pageCount;
    }
  } catch {
    // Ignore metadata errors and fall back to reading the PDF directly.
  }

  const uploadPath = getUploadPath(fileId);
  const bytes = await fs.readFile(uploadPath);

  const doc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false
  });

  return doc.getPageCount();
}

async function renderPage(fileId, page) {
  const uploadPath = getUploadPath(fileId);

  if (!(await pathExists(uploadPath))) {
    throw httpError(404, 'File not found.');
  }

  const previewPath = getPreviewPath(fileId, page);

  if (await pathExists(previewPath)) {
    return previewPath;
  }

  const pageCount = await getPageCount(fileId);

  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw httpError(404, `Page ${page} not found.`);
  }

  ensureTmpDirs();

  const doc = await openRenderable(uploadPath, PREVIEW_SCALE);

  let image;

  try {
    image = await doc.getPage(page);
  } finally {
    await doc.destroy();
  }

  if (!image || image.length === 0) {
    throw httpError(404, 'Preview could not be rendered.');
  }

  await fs.writeFile(previewPath, image);

  return previewPath;
}

function openRenderable(uploadPath, scale) {
  return import('pdf-to-img').then((pdfToImg) => {
    const pdf =
      pdfToImg.pdf ||
      pdfToImg.default?.pdf ||
      pdfToImg.default;

    if (typeof pdf !== 'function') {
      throw new Error('pdf-to-img could not be initialized.');
    }

    return pdf(uploadPath, { scale }).then((doc) => {
      if (!doc || typeof doc.getPage !== 'function') {
        throw new Error('pdf-to-img returned an unsupported document object.');
      }
      return doc;
    });
  });
}

// Render a single page straight to a PNG buffer (used for flattened merging).
async function renderPageToBuffer(fileId, page, scale = PREVIEW_SCALE) {
  const uploadPath = getUploadPath(fileId);

  if (!(await pathExists(uploadPath))) {
    throw httpError(404, `Upload ${fileId} not found.`);
  }

  const doc = await openRenderable(uploadPath, scale);

  try {
    return await doc.getPage(page);
  } finally {
    await doc.destroy();
  }
}

// Verify PDF.js can render a security-encrypted file without a password,
// and report its page count (used at upload time for restricted files).
async function inspectRenderable(fileId, scale = 0.3) {
  const uploadPath = getUploadPath(fileId);
  const doc = await openRenderable(uploadPath, scale);

  try {
    return {
      pageCount: doc.length,
      probeImage: await doc.getPage(1)
    };
  } finally {
    await doc.destroy();
  }
}

module.exports = {
  renderPage,
  getPageCount,
  renderPageToBuffer,
  inspectRenderable
};