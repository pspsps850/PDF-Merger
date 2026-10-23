jest.mock('../src/services/pdfMerge.service', () => ({
  mergePdf: jest.fn().mockResolvedValue({
    pageCount: 1,
    outputPath: '/tmp/fake-output.pdf'
  })
}));

const request = require('supertest');

const app = require('../src/app');
const jobService = require('../src/services/job.service');

describe('POST /api/merge', () => {
  test('rejects empty pages array', async () => {
    const res = await request(app)
      .post('/api/merge')
      .send({
        pages: []
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('rejects invalid page entry', async () => {
    const res = await request(app)
      .post('/api/merge')
      .send({
        pages: [{ fileId: 'file_a', page: 0 }]
      });

    expect(res.status).toBe(400);
  });

  test('accepts valid payload and creates job', async () => {
    const res = await request(app)
      .post('/api/merge')
      .send({
        outputName: 'test-output.pdf',
        pages: [{ fileId: 'file_a', page: 1 }]
      });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.status).toBe('queued');

    await new Promise((resolve) => setTimeout(resolve, 25));

    const job = jobService.getJob(res.body.jobId);

    expect(job).toBeTruthy();
    expect(['processing', 'completed', 'failed']).toContain(job.status);
  });
});