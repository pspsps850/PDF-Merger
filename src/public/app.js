/* Page Shop — front-end controller. Vanilla JS, no dependencies. */
(() => {
  'use strict';

  // ── state ────────────────────────────────────────────────
  const files = new Map(); // fileId -> {fileId, originalName, pageCount, size}
  let sequence = [];       // [{fileId, page, uid}]
  let seqCounter = 0;
  let busy = false;

  // ── boot: elements ───────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  const els = {
    dropzone: $('#dropzone'),
    browseLink: $('#browseLink'),
    fileInput: $('#fileInput'),
    uploadStatus: $('#uploadStatus'),
    fileList: $('#fileList'),
    fileCardTpl: $('#fileCardTpl'),
    pageCellTpl: $('#pageCellTpl'),
    trayCount: $('#trayCount'),
    clearTrays: $('#clearTrays'),
    maxMb: $('#maxMb'),
    mergeForm: $('#mergeForm'),
    outputName: $('#outputName'),
    mergeBtn: $('#mergeBtn'),
    statPages: $('#statPages'),
    statFiles: $('#statFiles'),
    jobStatus: $('#jobStatus'),
    strip: $('#strip'),
    stripEmpty: $('#stripEmpty'),
    seqItemTpl: $('#seqItemTpl'),
    clearSeq: $('#clearSeq'),
    sequenceSection: document.querySelector('.sequence'),
    health: $('#health'),
  };

  const PREVIEW_THUMB_MAX = 60; // preview images to render per file

  // Reserve exactly as much bottom space as the fixed sequence dock occupies
  // so it never covers the cards or their click targets.
  function syncDockHeight() {
    if (!els.sequenceSection) return;

    const height = Math.ceil(els.sequenceSection.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--dock-h', `${height}px`);
  }

  if (els.sequenceSection && typeof ResizeObserver === 'function') {
    new ResizeObserver(syncDockHeight).observe(els.sequenceSection);
  } else {
    window.addEventListener('resize', syncDockHeight);
  }

  syncDockHeight();

  // ── helpers ──────────────────────────────────────────────
  const fmtSize = (bytes) => {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' mb';
    if (bytes >= 1024) return Math.round(bytes / 1024) + ' kb';
    return bytes + ' b';
  };

  const previewUrl = (fileId, page) => `/api/preview/${encodeURIComponent(fileId)}/pages/${page}`;

  function showBanner(el, kind, html) {
    el.hidden = false;
    el.dataset.kind = kind;
    el.innerHTML = html;
  }

  function hideBanner(el) {
    el.hidden = true;
    el.textContent = '';
  }

  // ── upload ───────────────────────────────────────────────
  async function uploadFiles(fileList) {
    const pdfs = [...fileList].filter((f) =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) {
      showBanner(els.uploadStatus, 'error', 'Only PDF files can go in the trays.');
      return;
    }

    const fd = new FormData();
    for (const f of pdfs) fd.append('files', f, f.name);

    hideBanner(els.uploadStatus);
    showBanner(els.uploadStatus, 'busy', `Uploading ${pdfs.length} file${pdfs.length > 1 ? 's' : ''}…`);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await apiError(res));

      const body = await res.json();
      for (const meta of body.files) files.set(meta.fileId, meta);

      hideBanner(els.uploadStatus);
      renderTrays();
      refreshStats();
    } catch (err) {
      showBanner(els.uploadStatus, 'error',
        `Upload didn't land. ${err.message}`);
    }
  }

  // ── rendering: trays ─────────────────────────────────────
  function renderTrays() {
    const list = els.fileList;
    list.textContent = '';
    els.clearTrays.hidden = files.size === 0;

    for (const meta of files.values()) {
      const card = els.fileCardTpl.content.cloneNode(true);
      card.querySelector('.file-name').textContent = meta.originalName;
      card.querySelector('.file-meta').textContent =
        `${meta.pageCount} pages · ${fmtSize(meta.size)} · ${meta.fileId.slice(0, 12)}`;
      if (meta.flatten) {
        card.querySelector('.flat-badge').hidden = false;
        card.querySelector('.flat-badge').title =
          'This PDF is encrypted but opens without a password; its pages will merge as flattened images.';
      }

      card.querySelector('.file-remove').addEventListener('click', () => removeFile(meta.fileId, meta.originalName));

      const grid = card.querySelector('.page-grid');
      const pages = Math.min(meta.pageCount, PREVIEW_THUMB_MAX);

      for (let p = 1; p <= pages; p += 1) {
        grid.appendChild(makePageCell(meta, p));
      }

      const addAll = card.querySelector('.add-all');
      addAll.addEventListener('click', () => {
        const next = sequence.filter((s) => s.fileId !== meta.fileId)
          .concat([...Array(meta.pageCount)].map((_, i) => ({
            fileId: meta.fileId,
            page: i + 1,
            uid: ++seqCounter,
          })));
        sequence = next;
        renderStrip();
        refreshStats();
      });

      list.appendChild(card);
    }

    els.trayCount.textContent = files.size === 0 ? 'empty'
      : `${files.size} file${files.size > 1 ? 's' : ''}`;
  }

  // ── tray management: remove one / clear all ──────────────
  function purgeViewState(fileId) {
    if (fileId) {
      files.delete(fileId);
      sequence = sequence.filter((s) => s.fileId !== fileId);
    } else {
      files.clear();
      sequence = [];
    }
    renderTrays();
    renderStrip();
    refreshStats();
  }

  async function removeFile(fileId, originalName) {
    if (busy) return;

    try {
      const res = await fetch(`/api/upload/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await apiError(res));
      purgeViewState(fileId);
      showBanner(els.uploadStatus, 'ok',
        `Removed <b>${escapeHtml(originalName || fileId)}</b> from the trays.`);
    } catch (err) {
      showBanner(els.uploadStatus, 'error',
        `Couldn't remove <b>${escapeHtml(originalName || fileId)}</b>. ${err.message}`);
    }
  }

  async function clearTrays() {
    if (busy || files.size === 0) return;

    const names = [...files.values()].map((f) => f.originalName).join(', ');
    showBanner(els.uploadStatus, 'busy', 'Clearing the trays…');

    let removed = 0;
    for (const fileId of files.keys()) {
      try {
        const res = await fetch(`/api/upload/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await apiError(res));
        removed += 1;
        files.delete(fileId);
      } catch {
        // keep going; anything that failed stays in the tray
        continue;
      }
    }

    const left = files.size;
    purgeViewState();

    if (left === 0) {
      showBanner(els.uploadStatus, 'ok', `Trays cleared (${removed} file${removed === 1 ? '' : 's'}).`);
    } else {
      showBanner(els.uploadStatus, 'error',
        `Removed ${removed}, but ${left} wouldn't delete: <b>${escapeHtml(names)}</b>`);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function apiError(res) {
    let msg = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body && body.error) msg = escapeHtml(body.error);
    } catch { /* non-JSON error body */ }
    return msg;
  }

  function makePageCell(meta, page) {
    const cell = els.pageCellTpl.content.cloneNode(true);
    const btn = cell.querySelector('.page-cell');
    const img = btn.querySelector('img');

    img.src = previewUrl(meta.fileId, page);
    img.alt = `Page ${page} of ${meta.originalName}`;
    const existing = sequence.filter((s) => s.fileId === meta.fileId &&
      s.page === page).length;
    btn.querySelector('.page-no').textContent = page + (existing ? ' ✓' : '');
    btn.title = `Add page ${page}`;

    btn.addEventListener('click', () => addToSequence(meta, page));
    return cell;
  }

  // ── rendering: sequence strip ────────────────────────────
  function addToSequence(meta, page) {
    sequence.push({ fileId: meta.fileId, page, uid: ++seqCounter });
    renderStrip();
    refreshStats();
  }

  function moveInSequence(uid, delta) {
    const i = sequence.findIndex((s) => s.uid === uid);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= sequence.length) return;
    [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    renderStrip();
  }

  function renderStrip() {
    els.sequenceSection.classList.toggle('has-items', sequence.length > 0);
    els.strip.textContent = '';
    els.clearSeq.hidden = sequence.length === 0;

    const byId = new Map([...files.values()].map((f) => [f.fileId, f.originalName]));

    sequence.forEach((entry, index) => {
      const item = els.seqItemTpl.content.cloneNode(true);
      const li = item.querySelector('.seq-item');
      li.dataset.uid = String(entry.uid);

      item.querySelector('.folio').textContent = String(index + 1).padStart(2, '0');
      const img = item.querySelector('.seq-thumb');
      img.src = previewUrl(entry.fileId, entry.page);
      img.alt = `Sequence position ${index + 1}: page ${entry.page}`;
      item.querySelector('.seq-src').textContent =
        `${byId.get(entry.fileId) || entry.fileId.slice(0, 10)} · p.${entry.page}`;

      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', entry.uid);
        e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        li.classList.add('dragover-neighbour');
      });
      li.addEventListener('dragleave', () => li.classList.remove('dragover-neighbour'));
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('dragover-neighbour');
        const uid = Number(e.dataTransfer.getData('text/plain'));
        const from = sequence.findIndex((s) => s.uid === uid);
        if (from !== -1 && from !== index) {
          const [moved] = sequence.splice(from, 1);
          sequence.splice(index, 0, moved);
          renderStrip();
        }
      });

      item.querySelector('.move-left').addEventListener('click', () => moveInSequence(entry.uid, -1));
      item.querySelector('.move-right').addEventListener('click', () => moveInSequence(entry.uid, +1));
      item.querySelector('.remove').addEventListener('click', () => {
        sequence = sequence.filter((s) => s.uid !== entry.uid);
        renderStrip();
        refreshStats();
      });

      els.strip.appendChild(item);
    });
  }

  function refreshStats() {
    els.statPages.textContent = sequence.length;
    const used = new Set(sequence.map((s) => s.fileId));
    els.statFiles.textContent = used.size;
    els.mergeBtn.disabled = busy || sequence.length === 0;
  }

  els.clearSeq.addEventListener('click', () => {
    if (busy) return;
    sequence = [];
    renderStrip();
    refreshStats();
  });

  els.clearTrays.addEventListener('click', clearTrays);

  // ── merge + job poll ─────────────────────────────────────
  async function startMerge(ev) {
    ev.preventDefault();
    if (busy || sequence.length === 0) return;

    const name = (els.outputName.value || 'merged.pdf').trim();

    if (!name.toLowerCase().endsWith('.pdf')) {
      showBanner(els.jobStatus, 'error', 'Output name must end with <b>.pdf</b>.');
      return;
    }

    busy = true;
    refreshStats();
    showBanner(els.jobStatus, 'busy', 'Sending the job to the press…');

    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: sequence.map(({ fileId, page }) => ({ fileId, page })),
          outputName: name,
        }),
      });
      if (!res.ok) throw new Error(await apiError(res));

      const { jobId, statusUrl } = await res.json();
      showBanner(els.jobStatus, 'busy',
        `Job <b class="mono">${jobId.slice(0, 14)}</b> on the press — merging ${sequence.length} pages…`);
      await pollJob((statusUrl && statusUrl.startsWith('/api/') && !statusUrl.includes('undefined'))
        ? statusUrl : `/api/job/${jobId}`);
    } catch (err) {
      showBanner(els.jobStatus, 'error', `Merge didn't start. ${err.message}`);
      busy = false;
      refreshStats();
    }
  }

  async function pollJob(url) {
    const deadline = Date.now() + 120000;

    while (Date.now() < deadline) {
      let job;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(await apiError(res));
        job = await res.json();
      } catch (err) {
        showBanner(els.jobStatus, 'error', `Lost contact with the press. ${err.message}`);
        busy = false;
        refreshStats();
        return;
      }

      if (job.status === 'completed') {
        const dl = job.downloadUrl || `${url}/download`;
        const dlName = (job.meta && job.meta.outputName) || 'merged.pdf';
        const pages = (job.result && job.result.pageCount) ||
          (job.meta && job.meta.requestedPageCount) || sequence.length;
        showBanner(els.jobStatus, 'ok',
          `Bound <b class="mono">${dlName}</b> — ${pages} pages. ` +
          `<a href="${dl}">Download the merged PDF</a>`);
        busy = false;
        refreshStats();
        return;
      }

      if (job.status === 'failed') {
        const reason = (job.error || '').replace(/</g, '&lt;');
        showBanner(els.jobStatus, 'error',
          `Job <b class="mono">${(job.jobId || '').slice(0, 14)}</b> misprinted: ${reason}`);
        busy = false;
        refreshStats();
        return;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    showBanner(els.jobStatus, 'error', 'The press took too long. Check the job with <b class="mono">GET ' +
      url + '</b> and try again.');
    busy = false;
    refreshStats();
  }

  els.mergeForm.addEventListener('submit', startMerge);

  // ── dropzone wiring ──────────────────────────────────────
  els.dropzone.addEventListener('click', () => els.fileInput.click());
  els.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.browseLink.addEventListener('click', (e) => {
    e.preventDefault();
    els.fileInput.click();
  });
  els.fileInput.addEventListener('change', () => {
    uploadFiles(els.fileInput.files);
    els.fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    }));
  ['dragleave', 'drop'].forEach((ev) =>
    els.dropzone.addEventListener(ev, () => els.dropzone.classList.remove('dragover')));
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  });

  // keep strip alive for whole-page drops outside the zone
  ['dragover', 'drop'].forEach((ev) =>
    window.addEventListener(ev, (e) => e.preventDefault()));

  // ── metadata + health ────────────────────────────────────
  fetch('/health').then(async (r) => {
    const ok = r.ok;
    els.health.dataset.state = ok ? 'ok' : 'down';
    els.health.querySelector('.health-label').textContent = ok ? 'on press' : 'offline';
  }).catch(() => {
    els.health.dataset.state = 'down';
    els.health.querySelector('.health-label').textContent = 'offline';
  });

  (async () => {
    try {
      const res = await fetch('/api/limits');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.MAX_UPLOAD_MB) els.maxMb.textContent = `${cfg.MAX_UPLOAD_MB} MB`;
      }
    } catch { /* header default stands in */ }
  })();
})();
