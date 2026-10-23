const {httpError} = require('./errorHandler.middleware');
const {isValidId} = require('../utils/file.utils');

function validateUpload(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return next(
      httpError(400, 'At least one file is required under field name "files".')
    );
  }

  next();
}

function validateMerge(req, res, next) {
  const body = req.body || {};
  const pages = body.pages;

  if (!Array.isArray(pages) || pages.length === 0) {
    return next(httpError(400, 'body.pages must be a non-empty array.'));
  }

  if (pages.length > 1000) {
    return next(httpError(400, 'body.pages cannot contain more than 1000 pages.'));
  }

  for (let index = 0; index < pages.length; index += 1) {
    const item = pages[index];

    if (!item || typeof item !== 'object') {
      return next(httpError(400, `pages[${index}] must be an object.`));
    }

    if (!isValidId(item.fileId)) {
      return next(httpError(400, `pages[${index}].fileId is invalid.`));
    }

    if (!Number.isInteger(item.page) || item.page < 1) {
      return next(
        httpError(400, `pages[${index}].page must be a positive integer.`)
      );
    }
  }

  if (body.outputName !== undefined && typeof body.outputName !== 'string') {
    return next(httpError(400, 'body.outputName must be a string when provided.'));
  }

  next();
}

module.exports = {
  validateUpload,
  validateMerge
};
