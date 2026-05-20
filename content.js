(function () {
  const ACCESSION_RE = /\b(GSE|GSM|GPL|GDS|GSL)\d+\b/g;
  const GEO_URL = 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=';

  try {
    const matches = document.body.innerText.match(ACCESSION_RE) || [];
    const accessions = [...new Set(matches)];
    if (accessions.length === 0) return;

    // Badge
    const badge = document.createElement('div');
    badge.id = 'geo-plugin-badge';
    badge.textContent = accessions.length;
    badge.title = `${accessions.length} GEO accession${accessions.length > 1 ? 's' : ''} found`;
    document.body.appendChild(badge);

    // Panel (created lazily on first open)
    let panelCreated = false;
    let overlay, panel;

    function createPanel() {
      overlay = document.createElement('div');
      overlay.id = 'geo-plugin-overlay';

      panel = document.createElement('div');
      panel.id = 'geo-plugin-panel';

      const header = document.createElement('div');
      header.id = 'geo-plugin-header';

      const title = document.createElement('span');
      title.textContent = `GEO Accessions (${accessions.length})`;

      const closeBtn = document.createElement('button');
      closeBtn.id = 'geo-plugin-close';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', closePanel);

      header.appendChild(title);
      header.appendChild(closeBtn);

      const list = document.createElement('ul');
      list.id = 'geo-plugin-list';

      accessions.forEach(function (acc) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = GEO_URL + acc;
        a.textContent = acc;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
        list.appendChild(li);
      });

      panel.appendChild(header);
      panel.appendChild(list);
      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      overlay.addEventListener('click', closePanel);
      panelCreated = true;
    }

    function openPanel() {
      if (!panelCreated) createPanel();
      overlay.classList.add('geo-plugin-open');
      panel.classList.add('geo-plugin-open');
    }

    function closePanel() {
      overlay.classList.remove('geo-plugin-open');
      panel.classList.remove('geo-plugin-open');
    }

    badge.addEventListener('click', openPanel);
  } catch (e) {
    // Fail silently to avoid breaking the host page
  }
})();
