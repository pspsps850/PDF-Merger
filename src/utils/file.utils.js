const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const logger = require('./logger.utils');

const ROOT_TEMP = path.join(__dirname, '..', 'temp');
const UPLOAD_DIR = path.join(ROOT_TEMP, 'uploads');
const PREVIEW_DIR = path.join(ROOT_TEMP, 'previews');
const OUTPUT_DIR = path.join(ROOT_TEMP, 'output');

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function createId(prefix = 'id'){
    const raw = crypto.randomUUID().replace(/-/g, '');
    return `${prefix}_${raw}`;
}

function isValidId(id){
    return typeof id === 'string' && ID_PATTERN.test(id);
}

function assertId(id){
    if (!isValidId(id)) {
       const err = new Error('Invalid ID');
       err.statusCode = 400;
       throw err;
    }
    return id;
}

function assertPositiveInteger(value, fieldName){
    if(!Number.isInteger(value) || value < 1){
        const err = new Error(`${fieldName} must be a positive integer`);
        err.statusCode = 400;
        throw err;
    }
    return value;
}

function getUploadPath(fileId) {
  assertId(fileId);
  return path.join(UPLOAD_DIR, `${fileId}.pdf`);
}

function getMetaPath(fileId) {
  assertId(fileId);
  return path.join(UPLOAD_DIR, `${fileId}.meta.json`);
}

function getPreviewPath(fileId, page) {
  assertId(fileId);
  assertPositiveInteger(page, 'page');

  return path.join(PREVIEW_DIR, `${fileId}-page-${page}.png`);
}

function getOutputPath(jobId) {
  assertId(jobId);
  return path.join(OUTPUT_DIR, `${jobId}.pdf`);
}


function ensureTmpDirs() {
  for (const dir of [ROOT_TEMP, UPLOAD_DIR, PREVIEW_DIR, OUTPUT_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeJson(filePath, data) {
  const json = JSON.stringify(data, null, 2);
  await fsp.writeFile(filePath, json, 'utf8');
}

async function readJson(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function pathExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(name, fallback = 'merged.pdf') {
  const base = path.basename(String(name || ''));

  let cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');

  if (!cleaned) {
    return fallback;
  }

  if (!cleaned.toLowerCase().endsWith('.pdf')) {
    cleaned += '.pdf';
  }

  return cleaned;
}

async function sweepOldFiles(dir, ttlMs) {
  let entries;

  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === '.gitkeep') {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    try {
      const stat = await fsp.stat(fullPath);
      const ageMs = Date.now() - stat.mtimeMs;

      if (ageMs <= ttlMs) {
        continue;
      }

      if (entry.isDirectory()) {
        await fsp.rm(fullPath, { recursive: true, force: true });
      } else {
        await fsp.unlink(fullPath);
      }
    } catch (err) {
      logger.warn(`Failed to sweep temporary file: ${fullPath}`, err);
    }
  }
}

function startTempSweeper(ttlHours, intervalMinutes = 15) {
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const intervalMs = intervalMinutes * 60 * 1000;

  const interval = setInterval(async () => {
    try {
      await sweepOldFiles(UPLOAD_DIR, ttlMs);
      await sweepOldFiles(PREVIEW_DIR, ttlMs);
      await sweepOldFiles(OUTPUT_DIR, ttlMs);
    } catch (err) {
      logger.error('Temporary file sweep failed', err);
    }
  }, intervalMs);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return interval;
}

module.exports = {
  ROOT_TEMP,
  UPLOAD_DIR,
  PREVIEW_DIR,
  OUTPUT_DIR,
  createId,
  isValidId,
  assertId,
  assertPositiveInteger,
  ensureTmpDirs,
  getUploadPath,
  getMetaPath,
  getPreviewPath,
  getOutputPath,
  writeJson,
  readJson,
  pathExists,
  sanitizeFilename,
  startTempSweeper
};