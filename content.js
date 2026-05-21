(function () {
  const ACCESSION_RE  = /\b(GSE|GSM|GPL|GDS|GSL)\d+\b/g;
  const GEO_URL       = 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=';
  const GEO_TEXT_BASE = 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi';
  const MAX_SAMPLES_SHOWN = 10;

  // --- Cart state -----------------------------------------------------------
  const cart      = new Map(); // url  → { name, gsm, gse, organism }
  const gseFiles  = new Map(); // gse  → Set<url>
  const fileIndex = new Map(); // url  → { name, gsm, gse, organism }

  // --- Genome detection -----------------------------------------------------
  const ORGANISM_GENOME = {
    'homo sapiens':            'hg38',
    'mus musculus':            'mm39',
    'drosophila melanogaster': 'dm6',
    'danio rerio':             'danRer11',
    'saccharomyces cerevisiae':'sacCer3',
  };
  const IGV_GENOMES = ['hg38', 'hg19', 'mm10', 'mm39', 'dm6', 'danRer11', 'sacCer3'];

  function detectGenome(org) {
    return ORGANISM_GENOME[org?.trim().toLowerCase()] ?? 'hg38';
  }

  // --- SOFT text parsers ----------------------------------------------------

  // Fetches SOFT-format text for a GSE and parses its hierarchy.
  // "SubSeries of: X"    → X is a child sub-series of this record
  // "SuperSeries of: X"  → X is the parent super-series of this record
  async function fetchGEOSeries(acc) {
    const url = GEO_TEXT_BASE + '?acc=' + acc + '&targ=self&form=text&view=brief';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();

    const titleMatch = text.match(/^!Series_title\s*=\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const samples = [], subSeries = [], superSeries = [];
    text.split('\n').forEach(function (raw) {
      const line = raw.trim();
      if (line.startsWith('!Series_sample_id')) {
        const id = line.split('=').slice(1).join('=').trim();
        if (id) samples.push(id);
      } else if (line.startsWith('!Series_relation')) {
        const val = line.split('=').slice(1).join('=').trim();
        const subMatch = val.match(/^SubSeries of:\s*(GSE\d+)/);
        const supMatch = val.match(/^SuperSeries of:\s*(GSE\d+)/);
        if (subMatch) subSeries.push(subMatch[1]);
        if (supMatch) superSeries.push(supMatch[1]);
      }
    });
    return { title, samples, subSeries, superSeries };
  }

  function parseGsmSoft(text) {
    let title = '', organism = 'hg38';
    const bigwigUrls = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line.startsWith('!Sample_title'))
        title = line.split(' = ').slice(1).join(' = ').trim();
      else if (line.startsWith('!Sample_organism_ch1'))
        organism = detectGenome(line.split(' = ').slice(1).join(' = ').trim());
      else if (line.startsWith('!Sample_supplementary_file')) {
        const val = line.split(' = ').slice(1).join(' = ').trim();
        if (/\.(bw|bigwig)$/i.test(val))
          bigwigUrls.push(val.replace(/^ftp:\/\//i, 'https://'));
      }
    }
    return { title, organism, bigwigUrls };
  }

  // --- Cart functions -------------------------------------------------------

  function idFor(url) {
    return 'geo-plugin-bw-' + btoa(url).replace(/[^a-z0-9]/gi, '');
  }

  function registerGsmFiles(gse, gsm, organism, files) {
    if (!gseFiles.has(gse)) gseFiles.set(gse, new Set());
    const set = gseFiles.get(gse);
    files.forEach(function ({ url, name }) {
      set.add(url);
      if (!fileIndex.has(url)) fileIndex.set(url, { name, gsm, gse, organism });
    });
    const btn = document.getElementById('geo-plugin-add-all-loaded-' + gse);
    if (btn) btn.textContent = 'Add all loaded (' + set.size + ')';
  }

  function toggleCart(url, meta, add) {
    if (add) { cart.set(url, meta); }
    else     { cart.delete(url); }
    const cb = document.getElementById(idFor(url));
    if (cb) cb.checked = add;
    updateCartFooter();
  }

  function updateCartFooter() {
    const footer  = document.getElementById('geo-plugin-cart-footer');
    const countEl = document.getElementById('geo-plugin-cart-count');
    if (!footer) return;
    const n = cart.size;
    footer.style.display = n > 0 ? 'flex' : 'none';
    countEl.textContent  = n + ' file' + (n === 1 ? '' : 's');
  }

  function onAddAllLoaded(gse) {
    (gseFiles.get(gse) ?? new Set()).forEach(function (url) {
      if (!cart.has(url)) toggleCart(url, fileIndex.get(url), true);
    });
  }

  // --- IGV checkout ---------------------------------------------------------

  function detectDominantGenome(entries) {
    const freq = {};
    entries.forEach(function ([, m]) {
      freq[m.organism] = (freq[m.organism] ?? 0) + 1;
    });
    return Object.entries(freq).sort(function (a, b) { return b[1] - a[1]; })[0]?.[0] ?? 'hg38';
  }

  function buildIgvHtml(entries) {
    const genome = detectDominantGenome(entries);
    const tracks = entries.map(function ([url, m]) {
      return { format: 'bigwig', url, name: m.name || m.gsm };
    });
    const opts = IGV_GENOMES.map(function (g) {
      return '<option value="' + g + '"' + (g === genome ? ' selected' : '') + '>' + g + '</option>';
    }).join('');

    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<title>IGV — GEO Plugin</title>' +
      '<style>' +
      'body{margin:0;font-family:sans-serif;background:#111;color:#eee}' +
      '#ctrl{padding:8px 12px;display:flex;align-items:center;gap:10px;background:#1a1a2e}' +
      'select{background:#2a2a3e;color:#eee;border:1px solid #555;padding:4px 8px;border-radius:3px}' +
      'button{background:#4a9eff;color:#fff;border:none;padding:5px 12px;border-radius:3px;cursor:pointer}' +
      'button:hover{background:#2a7edf}' +
      '#igv-div{width:100%;height:calc(100vh - 44px)}' +
      '</style></head><body>' +
      '<div id="ctrl"><label for="gs">Genome:</label>' +
      '<select id="gs">' + opts + '</select>' +
      '<button id="rb">Reload with genome</button></div>' +
      '<div id="igv-div"></div>' +
      '<script src="https://cdn.jsdelivr.net/npm/igv@3/dist/igv.min.js"></script>' +
      '<script>' +
      'var TRACKS=' + JSON.stringify(tracks) + ';' +
      'function init(g){' +
        'var d=document.getElementById("igv-div");d.innerHTML="";' +
        'igv.createBrowser(d,{genome:g,tracks:TRACKS})' +
        '.catch(function(e){d.textContent="IGV error: "+e.message;});' +
      '}' +
      'document.getElementById("rb").addEventListener("click",function(){init(document.getElementById("gs").value);});' +
      'window.addEventListener("load",function(){init(' + JSON.stringify(genome) + ');});' +
      '</script></body></html>';
  }

  function openIgvTab(entries) {
    if (!entries.length) return;
    const blob = new Blob([buildIgvHtml(entries)], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }

  // --- GSM node rendering ---------------------------------------------------

  function renderBigwigList(contentEl, gse, gsm, organism, files) {
    files.forEach(function ({ url, name }) {
      const item = document.createElement('div');
      item.className = 'geo-plugin-bigwig-item';

      const cbId = idFor(url);
      const cb   = document.createElement('input');
      cb.type = 'checkbox';
      cb.id   = cbId;
      cb.className = 'geo-plugin-bw-checkbox';
      cb.checked   = cart.has(url);
      cb.addEventListener('change', function (e) {
        toggleCart(url, { name, gsm, gse, organism }, e.target.checked);
      });

      const lbl = document.createElement('label');
      lbl.htmlFor   = cbId;
      lbl.className = 'geo-plugin-bw-label';
      lbl.textContent = name;

      item.appendChild(cb);
      item.appendChild(lbl);
      contentEl.appendChild(item);
    });

    const addAllBtn = document.createElement('button');
    addAllBtn.className   = 'geo-plugin-btn-sm';
    addAllBtn.textContent = 'Add all (' + files.length + ')';
    addAllBtn.addEventListener('click', function () {
      files.forEach(function ({ url, name }) {
        toggleCart(url, { name, gsm, gse, organism }, true);
      });
    });
    contentEl.appendChild(addAllBtn);
  }

  async function expandGsm(gse, gsm, contentEl) {
    if (contentEl.dataset.loaded) return;
    contentEl.innerHTML = '<div class="geo-plugin-loading">Loading…</div>';

    try {
      const resp = await fetch(GEO_TEXT_BASE + '?acc=' + gsm + '&targ=self&form=text&view=brief');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const { organism, bigwigUrls } = parseGsmSoft(await resp.text());

      contentEl.innerHTML = '';
      contentEl.dataset.loaded = '1';

      if (!bigwigUrls.length) {
        const msg = document.createElement('div');
        msg.className   = 'geo-plugin-loading';
        msg.textContent = 'No BigWig files found.';
        contentEl.appendChild(msg);
        return;
      }

      const files = bigwigUrls.map(function (u) {
        return { url: u, name: u.split('/').pop() };
      });
      registerGsmFiles(gse, gsm, organism, files);
      renderBigwigList(contentEl, gse, gsm, organism, files);
    } catch (e) {
      contentEl.innerHTML = '';
      contentEl.dataset.loaded = ''; // clear guard so user can retry
      const err = document.createElement('div');
      err.className   = 'geo-plugin-error';
      err.textContent = 'Failed to load. ';
      const a = document.createElement('a');
      a.href   = GEO_URL + gsm;
      a.textContent = 'View on NCBI →';
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
      err.appendChild(a);
      contentEl.appendChild(err);
    }
  }

  function renderGsmNode(gse, gsm) {
    const node = document.createElement('div');
    node.className = 'geo-plugin-gsm-node';

    const toggle = document.createElement('button');
    toggle.className   = 'geo-plugin-expand geo-plugin-expand-sm';
    toggle.textContent = '▶';
    toggle.title       = 'Expand sample files';

    const link = document.createElement('a');
    link.className = 'geo-plugin-sub-link';
    link.href      = GEO_URL + gsm;
    link.textContent = gsm;
    link.target    = '_blank';
    link.rel       = 'noopener noreferrer';

    const content = document.createElement('div');
    content.className = 'geo-plugin-gsm-content';

    toggle.addEventListener('click', function () {
      const isOpen = content.classList.contains('geo-plugin-open');
      content.classList.toggle('geo-plugin-open', !isOpen);
      toggle.textContent = isOpen ? '▶' : '▼';
      if (!isOpen) expandGsm(gse, gsm, content);
    });

    node.appendChild(toggle);
    node.appendChild(link);
    node.appendChild(content);
    return node;
  }

  // --- GSE tree rendering ---------------------------------------------------

  function buildSection(label, ids) {
    const section = document.createElement('div');
    section.className = 'geo-plugin-section';

    const heading = document.createElement('div');
    heading.className   = 'geo-plugin-section-label';
    heading.textContent = label;
    section.appendChild(heading);

    ids.forEach(function (id) {
      const a = document.createElement('a');
      a.className   = 'geo-plugin-sub-link';
      a.href        = GEO_URL + id;
      a.textContent = id;
      a.target      = '_blank';
      a.rel         = 'noopener noreferrer';
      section.appendChild(a);
    });

    return section;
  }

  function renderTree(tree, acc, data) {
    tree.innerHTML = '';

    if (data.title) {
      const titleEl = document.createElement('div');
      titleEl.className   = 'geo-plugin-tree-title';
      titleEl.textContent = data.title;
      tree.appendChild(titleEl);
    }

    if (data.superSeries.length) {
      tree.appendChild(buildSection('Part of super-series', data.superSeries));
    }

    if (data.subSeries.length) {
      tree.appendChild(buildSection('Sub-series', data.subSeries));
    }

    if (data.samples.length) {
      const heading = document.createElement('div');
      heading.className   = 'geo-plugin-section-label';
      heading.textContent = 'Samples (' + data.samples.length + ')';
      tree.appendChild(heading);

      data.samples.slice(0, MAX_SAMPLES_SHOWN).forEach(function (gsm) {
        tree.appendChild(renderGsmNode(acc, gsm));
      });

      if (data.samples.length > MAX_SAMPLES_SHOWN) {
        const more = document.createElement('a');
        more.className   = 'geo-plugin-view-all';
        more.href        = GEO_URL + acc;
        more.textContent = 'View all ' + data.samples.length + ' samples on NCBI →';
        more.target      = '_blank';
        more.rel         = 'noopener noreferrer';
        tree.appendChild(more);
      }

      const addAllLoaded = document.createElement('button');
      addAllLoaded.className   = 'geo-plugin-btn-sm geo-plugin-add-all-loaded';
      addAllLoaded.id          = 'geo-plugin-add-all-loaded-' + acc;
      addAllLoaded.textContent = 'Add all loaded (0)';
      addAllLoaded.addEventListener('click', function () { onAddAllLoaded(acc); });
      tree.appendChild(addAllLoaded);
    }

    if (!data.title && !data.superSeries.length && !data.subSeries.length && !data.samples.length) {
      const empty = document.createElement('div');
      empty.className = 'geo-plugin-error';
      const emptyLink = document.createElement('a');
      emptyLink.href        = GEO_URL + acc;
      emptyLink.textContent = 'View on NCBI →';
      emptyLink.target      = '_blank';
      emptyLink.rel         = 'noopener noreferrer';
      empty.appendChild(emptyLink);
      tree.appendChild(empty);
    }
  }

  // --- GSE node rendering ---------------------------------------------------

  function buildSimpleLink(acc) {
    const a = document.createElement('a');
    a.className   = 'geo-plugin-link';
    a.href        = GEO_URL + acc;
    a.textContent = acc;
    a.target      = '_blank';
    a.rel         = 'noopener noreferrer';
    return a;
  }

  function buildGSENode(acc) {
    const container = document.createElement('div');
    container.className = 'geo-plugin-gse-node';

    const row = document.createElement('div');
    row.className = 'geo-plugin-gse-row';

    const expandBtn = document.createElement('button');
    expandBtn.className   = 'geo-plugin-expand';
    expandBtn.textContent = '▶';
    expandBtn.title       = 'Expand series hierarchy';

    const a = buildSimpleLink(acc);

    row.appendChild(expandBtn);
    row.appendChild(a);

    const tree = document.createElement('div');
    tree.className = 'geo-plugin-tree';

    expandBtn.addEventListener('click', function () {
      toggleExpand(acc, expandBtn, tree);
    });

    container.appendChild(row);
    container.appendChild(tree);
    return container;
  }

  async function toggleExpand(acc, expandBtn, tree) {
    const isOpen = tree.classList.contains('geo-plugin-open');

    if (isOpen) {
      tree.classList.remove('geo-plugin-open');
      expandBtn.textContent = '▶';
      return;
    }

    if (tree.dataset.loaded) {
      tree.classList.add('geo-plugin-open');
      expandBtn.textContent = '▼';
      return;
    }

    expandBtn.textContent = '…';
    expandBtn.disabled    = true;
    tree.innerHTML        = '<div class="geo-plugin-loading">Loading…</div>';
    tree.classList.add('geo-plugin-open');

    try {
      const data = await fetchGEOSeries(acc);
      renderTree(tree, acc, data);
      tree.dataset.loaded   = '1';
      expandBtn.textContent = '▼';
    } catch (e) {
      tree.innerHTML = '';
      const errDiv  = document.createElement('div');
      errDiv.className   = 'geo-plugin-error';
      errDiv.textContent = 'Failed to load. ';
      const errLink = document.createElement('a');
      errLink.href        = GEO_URL + acc;
      errLink.textContent = 'View on NCBI →';
      errLink.target      = '_blank';
      errLink.rel         = 'noopener noreferrer';
      errDiv.appendChild(errLink);
      tree.appendChild(errDiv);
      expandBtn.textContent = '▶';
      tree.classList.remove('geo-plugin-open');
    }

    expandBtn.disabled = false;
  }

  // --- Panel ----------------------------------------------------------------

  try {
    const matches    = document.body.innerText.match(ACCESSION_RE) || [];
    const accessions = [...new Set(matches)];
    if (accessions.length === 0) return;

    // Badge
    const badge = document.createElement('div');
    badge.id        = 'geo-plugin-badge';
    badge.textContent = accessions.length;
    badge.title     = accessions.length + ' GEO accession' + (accessions.length > 1 ? 's' : '') + ' found';
    document.body.appendChild(badge);

    let panelCreated = false;
    let overlay, panel;

    function createPanel() {
      overlay = document.createElement('div');
      overlay.id = 'geo-plugin-overlay';

      panel = document.createElement('div');
      panel.id = 'geo-plugin-panel';

      // Header
      const header = document.createElement('div');
      header.id = 'geo-plugin-header';

      const title = document.createElement('span');
      title.textContent = 'GEO Accessions (' + accessions.length + ')';

      const closeBtn = document.createElement('button');
      closeBtn.id          = 'geo-plugin-close';
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', closePanel);

      header.appendChild(title);
      header.appendChild(closeBtn);

      // Accession list
      const list = document.createElement('ul');
      list.id = 'geo-plugin-list';

      accessions.forEach(function (acc) {
        const li = document.createElement('li');
        if (acc.startsWith('GSE')) {
          li.appendChild(buildGSENode(acc));
        } else {
          li.appendChild(buildSimpleLink(acc));
        }
        list.appendChild(li);
      });

      // Cart footer (hidden until items selected)
      const footer   = document.createElement('div');
      footer.id      = 'geo-plugin-cart-footer';
      footer.style.display = 'none';

      const countEl  = document.createElement('span');
      countEl.id     = 'geo-plugin-cart-count';
      countEl.textContent = '0 files';

      const igvBtn   = document.createElement('button');
      igvBtn.id      = 'geo-plugin-igv-btn';
      igvBtn.className = 'geo-plugin-igv-btn';
      igvBtn.textContent = 'Open in IGV';
      igvBtn.addEventListener('click', function () {
        openIgvTab([...cart.entries()]);
      });

      footer.appendChild(countEl);
      footer.appendChild(igvBtn);

      panel.appendChild(header);
      panel.appendChild(list);
      panel.appendChild(footer);

      document.body.appendChild(overlay);
      document.body.appendChild(panel);

      overlay.addEventListener('click', closePanel);
      panelCreated = true;
    }

    function openPanel() {
      if (!panelCreated) createPanel();
      badge.style.display = 'none';
      overlay.classList.add('geo-plugin-open');
      panel.classList.add('geo-plugin-open');
    }

    function closePanel() {
      overlay.classList.remove('geo-plugin-open');
      panel.classList.remove('geo-plugin-open');
      badge.style.display = '';
    }

    badge.addEventListener('click', openPanel);
  } catch (e) {
    // Fail silently to avoid breaking the host page
  }
})();
