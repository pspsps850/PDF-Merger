(function () {
  async function parseResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    const body = isJson
      ? await res.json().catch(() => null)
      : await res.text().catch(() => '');

    if (!res.ok) {
      const message =
        body?.error ||
        body?.message ||
        `Request failed with status ${res.status}`;

      throw new Error(message);
    }

    return body;
  }

  window.Api = {
    async uploadFiles(files) {
      const formData = new FormData();

      for (const file of files) {
        formData.append('files', file);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      return parseResponse(res);
    },

    async merge(payload) {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return parseResponse(res);
    },

    async getJob(jobId) {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
      return parseResponse(res);
    },

    previewUrl(fileId, page) {
      return `/api/preview/${encodeURIComponent(fileId)}/pages/${encodeURIComponent(page)}`;
    },

    downloadUrl(jobId) {
      return `/api/jobs/${encodeURIComponent(jobId)}/download`;
    }
  };
})();