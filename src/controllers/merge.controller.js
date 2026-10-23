const jobService = require('../services/job.service');
const pdfMergeService = require('../services/pdfMerge.service');

const {
  createId,
  getOutputPath,
  sanitizeFilename
} = require('../utils/file.utils');

const logger = require('../utils/logger.utils');

async function createMergeJob(req, res, next) {
  try {
    const jobId = createId('job');

    const payload = {
      outputName: sanitizeFilename(req.body.outputName || 'merged.pdf'),
      pages: req.body.pages
    };

    const job = jobService.createJob({
      id: jobId,
      type: 'merge',
      meta: {
        outputName: payload.outputName,
        requestedPageCount: payload.pages.length
      }
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      statusUrl: `/api/job/${job.id}`
    });

    setImmediate(() => {
      processMerge(job.id, payload).catch((err) => {
        logger.error('Merge processing failed unexpectedly', err);
      });
    });
  } catch (err) {
    next(err);
  }
}

async function processMerge(jobId, payload) {
  try {
    jobService.updateJob(jobId, {
      status: 'processing'
    });

    const outputPath = getOutputPath(jobId);

    const result = await pdfMergeService.mergePdf(payload, outputPath);

    jobService.updateJob(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      downloadUrl: `/api/job/${jobId}/download`,
      result: {
        pageCount: result.pageCount
      }
    });
  } catch (err) {
    jobService.updateJob(jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: err.message
    });
  }
}

module.exports = {
  createMergeJob
};