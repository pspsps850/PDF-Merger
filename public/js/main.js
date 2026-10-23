(function () {
  function init() {
    window.Ui.init();

    const els = window.Ui.getElements();

    els.uploadBtn.addEventListener('click', handleUpload);
    els.mergeBtn.addEventListener('click', handleMerge);
  }

  async function handleUpload() {
    const els = window.Ui.getElements();

    const files = Array.from(els.fileInput.files || []).filter((file) => {
      return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    });

    if (files.length === 0) {
      window.Ui.setStatus('Choose at least one PDF file.', true);
      return;
    }

    try {
      window.Ui.hideDownload();
      window.Ui.setStatus('Uploading PDFs...');

      const result = await window.Api.uploadFiles(files);

      window.Arranger.addFiles(result.files);

      els.fileInput.value = '';

      window.Ui.setStatus(
        `Uploaded ${result.files.length} file(s). Drag pages to reorder.`
      );
    } catch (err) {
      window.Ui.setStatus(err.message, true);
    }
  }

  async function handleMerge() {
    try {
      window.Ui.setStatus('Starting merge job...');

      const payload = window.Arranger.buildPayload();
      const response = await window.Api.merge(payload);

      await pollJob(response.jobId);
    } catch (err) {
      window.Ui.setStatus(err.message, true);
    }
  }

  async function pollJob(jobId) {
    while (true) {
      const job = await window.Api.getJob(jobId);

      if (job.status === 'completed') {
        window.Ui.setStatus('Merge completed.');
        window.Ui.showDownload(jobId);
        return;
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Merge job failed.');
      }

      window.Ui.setStatus(`Merge status: ${job.status}`);

      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();