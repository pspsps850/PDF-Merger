const { createId } = require('../utils/file.utils');

const jobs = new Map();

function createJob({ id, type = 'merge', meta = {} } = {}) {
  const jobId = id || createId('job');
  const now = new Date().toISOString();

  const job = {
    id: jobId,
    type,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    error: null,
    downloadUrl: null,
    meta: { ...meta }
  };

  jobs.set(jobId, job);

  return { ...job };
}

function getJob(id) {
  const job = jobs.get(id);

  if (!job) {
    return null;
  }

  return { ...job };
}

function updateJob(id, patch) {
  const job = jobs.get(id);

  if (!job) {
    return null;
  }

  Object.assign(job, patch, {
    updatedAt: new Date().toISOString()
  });

  return { ...job };
}

function sweepOldJobs(ttlHours) {
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const now = Date.now();

  for (const [id, job] of jobs.entries()) {
    const reference = job.completedAt || job.createdAt;
    const ageMs = now - Date.parse(reference);

    if (ageMs > ttlMs) {
      jobs.delete(id);
    }
  }
}

function startJobSweeper(ttlHours, intervalMinutes = 30) {
  const interval = setInterval(() => {
    sweepOldJobs(ttlHours);
  }, intervalMinutes * 60 * 1000);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }

  return interval;
}

module.exports = {
  createJob,
  getJob,
  updateJob,
  sweepOldJobs,
  startJobSweeper
};