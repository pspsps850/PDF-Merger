const fsx = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

const { getUploadPath, pathExists } = require('../utils/file.utils');
const { httpError } = require('../middleware/errorHandler.middleware');
const { renderPageToBuffer } = require('./pdfPreview.service');
const { PREVIEW_SCALE } = require('../configs/env.config');

// pdf-lib does not decrypt. Matching on the message is required because its
// bundled EncryptedPDFError does not survive an instanceof check.
function isEncryptedPdfError(err) {
  return Boolean(err) && /is encrypted/i.test(String(err.message));
}

async function loadSourceDocument(fileId, cache) {
  if (cache.has(fileId)) {
    return cache.get(fileId);
  }

  const filePath = getUploadPath(fileId);

  if (!(await pathExists(filePath))) {
    throw httpError(404, `Upload ${fileId} not found.`);
  }

  const bytes = await fsx.readFile(filePath);

  let doc;

  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (isEncryptedPdfError(err)) {
      // Encrypted but renderable (empty user password): flatten via PDF.js.
      return null;
    }
    throw httpError(400, `Upload ${fileId} is not a readable PDF.`);
  }

  cache.set(fileId, doc);

  return doc;
}

function pngPageSize(pngBytes, scale) {
  const buffer = Buffer.isBuffer(pngBytes) ? pngBytes : Buffer.from(pngBytes);
  return {
    width: buffer.readUInt32BE(16) / scale,
    height: buffer.readUInt32BE(20) / scale,
    buffer
  };
}

async function mergePdf(payload, outputPath) {
  if (!payload || !Array.isArray(payload.pages) || payload.pages.length === 0) {
    throw httpError(400, 'payload.pages is required.');
  }

  for (let index = 0; index < payload.pages.length; index += 1) {
    const ref = payload.pages[index];

    if (
      !ref ||
      typeof ref !== 'object' ||
      typeof ref.fileId !== 'string' ||
      !Number.isInteger(ref.page) ||
      ref.page < 1
    ) {
      throw httpError(400, `pages[${index}] is invalid.`);
    }
  }

  const mergedDoc = await PDFDocument.create();

  // Attempt a vector load per source; encrypted (security-locked) files fall
  // back to a flattened merge using PDF.js renders.
  const sourceCache = new Map();
  const flattenFileIds = new Set();

  for (const fileId of new Set(payload.pages.map((ref) => ref.fileId))) {
    const sourceDoc = await loadSourceDocument(fileId, sourceCache);

    if (!sourceDoc) {
      flattenFileIds.add(fileId);
    }
  }

  const flatRenderCache = new Map(); // `${fileId}#${page}` -> {buffer, width, height}

  for (let index = 0; index < payload.pages.length; index += 1) {
    const ref = payload.pages[index];

    if (!flattenFileIds.has(ref.fileId)) {
      const sourceDoc = await loadSourceDocument(ref.fileId, sourceCache);
      const sourcePageCount = sourceDoc.getPageCount();

      if (ref.page > sourcePageCount) {
        throw httpError(
          400,
          `Page ${ref.page} does not exist for file ${ref.fileId}.`
        );
      }

      const copiedPages = await mergedDoc.copyPages(sourceDoc, [ref.page - 1]);
      mergedDoc.addPage(copiedPages[0]);
      continue;
    }

    const cacheKey = `${ref.fileId}#${ref.page}`;
    let flat = flatRenderCache.get(cacheKey);

    if (!flat) {
      let rendered;

      try {
        rendered = await renderPageToBuffer(ref.fileId, ref.page, PREVIEW_SCALE);
      } catch (err) {
        if (err.statusCode) {
          throw err;
        }
        throw httpError(
          400,
          `Page ${ref.page} could not be rendered from file ${ref.fileId}.`
        );
      }

      flat = pngPageSize(rendered, PREVIEW_SCALE);
      flatRenderCache.set(cacheKey, flat);
    }

    const embeddedImage = await mergedDoc.embedPng(flat.buffer);
    const page = mergedDoc.addPage([flat.width, flat.height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: flat.width,
      height: flat.height
    });
  }

  const mergedBytes = await mergedDoc.save();

  await fsx.writeFile(outputPath, mergedBytes);

  return {
    pageCount: mergedDoc.getPageCount(),
    outputPath
  };
}

module.exports = {
  mergePdf
};