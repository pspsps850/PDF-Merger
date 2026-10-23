const fs = require('fs/promises');
const request = require('supertest');
const { PDFDocument } = require('pdf-lib');

const app = require('../src/app');
const { getUploadPath, getMetaPath } = require('../src/utils/file.utils');

async function createTestPdf() {
  const doc = await PDFDocument.create();
  doc.addPage();

  return Buffer.from(await doc.save());
}

describe('POST /api/upload', () => {
  test('stores the original filename in the response and metadata', async () => {
    const bytes = await createTestPdf();

    const res = await request(app)
      .post('/api/upload')
      .attach('files', bytes, {
        filename: 'sample.pdf',
        contentType: 'application/pdf'
      });

    expect(res.status).toBe(201);

    const [file] = res.body.files;

    expect(file.originalName).toBe('sample.pdf');
    expect(file.pageCount).toBe(1);

    const meta = JSON.parse(await fs.readFile(getMetaPath(file.fileId), 'utf8'));

    expect(meta.originalName).toBe('sample.pdf');

    await fs.unlink(getUploadPath(file.fileId)).catch(() => {});
    await fs.unlink(getMetaPath(file.fileId)).catch(() => {});
  });
});
