(function () {
  let pages = [];
  let dragIndex = null;

  function normalizePages(input) {
    return input.map((item) => ({
      fileId: String(item.fileId),
      page: Number(item.page),
      name: item.name || ''
    }));
  }

  function bindDragEvents() {
    const cards = Array.from(document.querySelectorAll('.page-card'));

    cards.forEach((card) => {
      card.addEventListener('dragstart', onDragStart);
      card.addEventListener('dragover', onDragOver);
      card.addEventListener('drop', onDrop);
      card.addEventListener('dragend', onDragEnd);
    });
  }

  function onDragStart(event) {
    const card = event.currentTarget;

    dragIndex = Number(card.dataset.index);
    card.classList.add('dragging');

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.dataset.index);
  }

  function onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function onDrop(event) {
    event.preventDefault();

    const target = event.currentTarget;
    const dropIndex = Number(target.dataset.index);

    if (dragIndex === null || Number.isNaN(dropIndex) || dragIndex === dropIndex) {
      return;
    }

    const updated = [...pages];
    const [moved] = updated.splice(dragIndex, 1);

    updated.splice(dropIndex, 0, moved);

    pages = normalizePages(updated);
    render();
  }

  function onDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    dragIndex = null;
  }

  function render() {
    window.Ui.renderPages(pages);
    window.Ui.setMergeEnabled(pages.length > 0);
    bindDragEvents();
  }

  function addFiles(filesMeta) {
    const additions = [];

    for (const file of filesMeta) {
      const pageCount = Number(file.pageCount) || 0;

      for (let page = 1; page <= pageCount; page += 1) {
        additions.push({
          fileId: file.fileId,
          page,
          name: file.originalName || file.name || ''
        });
      }
    }

    pages = pages.concat(additions);
    render();
  }

  function clear() {
    pages = [];
    render();
    window.Ui.hideDownload();
  }

  function buildPayload() {
    return {
      outputName: 'merged.pdf',
      pages: pages.map(({ fileId, page }) => ({
        fileId,
        page
      }))
    };
  }

  window.Arranger = {
    addFiles,
    clear,
    buildPayload
  };
})();