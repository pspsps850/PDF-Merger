const fs = require('fs/promises');
const { PDFDocument } = require('pdf-lib');

const pdfPreviewService = require('../src/services/pdfPreview.service');

jest.mock('../src/services/pdfPreview.service', () => ({
  renderPageToBuffer: jest.fn(),
  renderPage: jest.fn(),
  getPageCount: jest.fn(),
  inspectRenderable: jest.fn()
}));

const pdfMergeService = require('../src/services/pdfMerge.service');
const {
  ensureTmpDirs,
  getUploadPath,
  getOutputPath
} = require('../src/utils/file.utils');

// 1x1 transparent PNG; avoids invoking PDF.js inside the unit test.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function createTestPdf(pageCount) {
  const doc = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    doc.addPage();
  }

  return Buffer.from(await doc.save());
}

describe('pdfMerge.service', () => {
  const fileIdA = 'test-file-a';
  const fileIdB = 'test-file-b';
  const fileIdEncrypted = 'test-file-encrypted';
  const outputPath = getOutputPath('test-merge-output');
  const flatOutputPath = getOutputPath('test-merge-flat-output');

  beforeAll(() => {
    ensureTmpDirs();
  });

  beforeAll(async () => {
    await fs.writeFile(getUploadPath(fileIdA), await createTestPdf(2));
    await fs.writeFile(getUploadPath(fileIdB), await createTestPdf(1));
  });

  afterAll(async () => {
    await fs.unlink(getUploadPath(fileIdA)).catch(() => {});
    await fs.unlink(getUploadPath(fileIdB)).catch(() => {});
    await fs.unlink(getUploadPath(fileIdEncrypted)).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    await fs.unlink(flatOutputPath).catch(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('merges pages in the exact requested order', async () => {
    const result = await pdfMergeService.mergePdf(
      {
        pages: [
          { fileId: fileIdA, page: 2 },
          { fileId: fileIdB, page: 1 },
          { fileId: fileIdA, page: 1 }
        ]
      },
      outputPath
    );

    expect(result.pageCount).toBe(3);

    const mergedBytes = await fs.readFile(outputPath);
    const mergedDoc = await PDFDocument.load(mergedBytes);

    expect(mergedDoc.getPageCount()).toBe(3);
  });

  test('flattens encrypted sources instead of failing', async () => {
    await fs.writeFile(getUploadPath(fileIdEncrypted), 'encrypted-bytes');

    pdfPreviewService.renderPageToBuffer.mockResolvedValue(PNG_1X1);

    const encryptedError = new Error(
      'Input document to `PDFDocument.load` is encrypted. You can use `PDFDocument.load(..., { ignoreEncryption: true })` if you wish to load the document anyways.'
    );

    const loadSpy = jest
      .spyOn(PDFDocument, 'load')
      .mockRejectedValue(encryptedError);

    let result;

    try {
      result = await pdfMergeService.mergePdf(
        { pages: [{ fileId: fileIdEncrypted, page: 1 }] },
        flatOutputPath
      );
    } finally {
      loadSpy.mockRestore();
    }

    expect(result.pageCount).toBe(1);
    expect(pdfPreviewService.renderPageToBuffer).toHaveBeenCalledWith(
      fileIdEncrypted,
      1,
      expect.any(Number)
    );

    const mergedDoc = await PDFDocument.load(await fs.readFile(flatOutputPath));
    const resources = mergedDoc.getPages()[0].node.Resources().toString();

    expect(mergedDoc.getPageCount()).toBe(1);
    expect(resources).toContain('/XObject');
    expect(resources).toContain('/Image');
  });
});
