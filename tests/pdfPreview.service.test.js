const previewService = require('../src/services/pdfPreview.service');
const { ensureTmpDirs } = require('../src/utils/file.utils');

describe('pdfPreview.service', () => {
  beforeAll(() => {
    ensureTmpDirs();
  });

  test('rejects missing file', async () => {
    await expect(previewService.renderPage('missing-file', 1)).rejects.toThrow(
      'File not found.'
    );
  });
});