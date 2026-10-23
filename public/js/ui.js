(function () {
  let els = {};

  function init() {
    els.fileInput = document.getElementById('file-input');
    els.uploadBtn = document.getElementById('upload-btn');
    els.status = document.getElementById('status');
    els.pages = document.getElementById('pages');
    els.mergeBtn = document.getElementById('merge-btn');
    els.downloadLink = document.getElementById('download-link');
  }

  function setStatus(message, isError = false) {
    if (!els.status) {
      return;
    }

    els.status.textContent = message;
    els.status.className = isError ? 'status error' : 'status';
  }

  function clearPages() {
    if (!els.pages) {
      return;
    }

    els.pages.innerHTML = '';
  }

  function renderPages(pages) {
    if (!els.pages) {
      return;
    }

    clearPages();

    pages.forEach((item, index) => {
      const li = document.createElement('li');

      li.className = 'page-card';
      li.draggable = true;
      li.dataset.index = String(index);
      li.dataset.fileId = item.fileId;
      li.dataset.page = String(item.page);

      const img = document.createElement('img');
      img.src = window.Api.previewUrl(item.fileId, item.page);
      img.alt = `Page ${item.page} of ${item.name || item.fileId}`;

      const caption = document.createElement('span');
      caption.textContent = `${item.name || item.fileId} · page ${item.page}`;

      li.append(img, caption);

      els.pages.appendChild(li);
    });
  }

  function setMergeEnabled(enabled) {
    if (!els.mergeBtn) {
      return;
    }

    els.mergeBtn.disabled = !enabled;
  }

  function showDownload(jobId) {
    if (!els.downloadLink) {
      return;
    }

    els.downloadLink.href = window.Api.downloadUrl(jobId);
    els.downloadLink.hidden = false;
    els.downloadLink.textContent = 'Download merged PDF';
  }

  function hideDownload() {
    if (!els.downloadLink) {
      return;
    }

    els.downloadLink.hidden = true;
    els.downloadLink.removeAttribute('href');
  }

  function getElements() {
    return els;
  }

  window.Ui = {
    init,
    setStatus,
    clearPages,
    renderPages,
    setMergeEnabled,
    showDownload,
    hideDownload,
    getElements
  };
})();