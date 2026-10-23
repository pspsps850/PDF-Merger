const jobService = require('../src/services/job.service');

describe('job.service', () => {
  test('creates and retrieves a job', () => {
    const job = jobService.createJob({
      meta: {
        outputName: 'test.pdf'
      }
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe('queued');

    const found = jobService.getJob(job.id);

    expect(found).toMatchObject({
      id: job.id,
      status: 'queued'
    });
  });

  test('updates a job', () => {
    const job = jobService.createJob();

    const updated = jobService.updateJob(job.id, {
      status: 'completed'
    });

    expect(updated.status).toBe('completed');
  });

  test('returns null for unknown job', () => {
    expect(jobService.getJob('unknown_job')).toBeNull();
  });
});