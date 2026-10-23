const jobService = require('../services/job.service');
const { getOutputPath, pathExists } = require('../utils/file.utils');
const { httpError } = require('../middleware/errorHandler.middleware');

async function getJob(req, res, next) {
  try {
    const job = jobService.getJob(req.params.jobId);

    if (!job) {
      throw httpError(404, 'Job not found.');
    }

    res.json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.error ?? null,
      downloadUrl: job.downloadUrl ?? null,
      result: job.result ?? null,
      meta: job.meta ?? {}
    });
  } catch (err) {
    next(err);
  }
}

async function downloadJob(req, res, next) {
  try {
    const job = jobService.getJob(req.params.jobId);

    if (!job) {
      throw httpError(404, 'Job not found.');
    }

    if (job.status !== 'completed') {
      throw httpError(409, `Job is currently ${job.status}.`);
    }

    const filePath = getOutputPath(job.id);

    if (!(await pathExists(filePath))) {
      throw httpError(410, 'Merged output file is no longer available.');
    }

    const outputName = job.meta?.outputName || 'merged.pdf';

    res.download(filePath, outputName);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getJob,
  downloadJob
};