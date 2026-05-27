# GEO Plugin

A Chrome browser extension that detects **GEO accession numbers** on research journal pages and surfaces them in an interactive panel — complete with a hierarchical series/sample tree, BigWig file selection, and one-click IGV genome browser launch.

---

## Purpose

Genomics researchers frequently encounter GEO accession numbers (GSE, GSM, GPL, GDS, GSL) embedded in journal articles, preprints, and supplementary materials. Navigating from a citation to the actual data on NCBI requires multiple clicks and context switches. GEO Plugin eliminates that friction by:

- Automatically scanning any page for GEO accession numbers
- Displaying a count badge and a slide-in panel listing every accession found
- Expanding GSE series into their super-series / sub-series / sample hierarchy (fetched live from NCBI)
- Identifying BigWig (`.bw` / `.bigwig`) supplementary files within individual samples
- Letting researchers select files into a cart and open them directly in an embedded IGV genome browser

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension platform | Chrome Extension — Manifest V3 |
| Runtime language | Vanilla JavaScript (ES2020, no build step) |
| Styling | Plain CSS (all selectors namespaced `geo-plugin-`) |
| Genome data API | NCBI GEO SOFT text format (`acc.cgi?form=text`) |
| Genome browser | [IGV.js v3](https://github.com/igvteam/igv.js) (loaded via jsDelivr CDN at checkout time) |
| Icons | PNG (generated via PowerShell System.Drawing) |

No npm, no bundler, no framework. The extension installs as a directory of static files.

---

## Installation (Development)

1. **Clone the repository**
   ```
   git clone https://github.com/treznicek/GEO_Plugin.git
   cd GEO_Plugin
   ```

2. **Load into Chrome**
   - Open `chrome://extensions`
   - Enable **Developer mode** (toggle, top-right)
   - Click **Load unpacked** and select the `GEO_Plugin` directory

3. **Test it**
   - Navigate to any genomics article — e.g. `https://pmc.ncbi.nlm.nih.gov/articles/PMC12136341/`
   - A red badge appears in the bottom-right corner showing the count of GEO accessions found
   - Click the badge to open the panel

4. **After editing source files**
   - Return to `chrome://extensions` and click the **refresh icon** on the GEO Plugin card
   - Reload the target browser tab

---

## Core Architecture

```
GEO_Plugin/
├── manifest.json       Extension entry point (Manifest V3)
├── content.js          Single content script — all runtime logic
├── content.css         All styles, injected alongside content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── NOTICE              Third-party attribution (IGV.js)
├── CONTRIBUTING.md     Contributor guide
├── .github/
│   └── CODEOWNERS      Code review assignments
└── .gitignore
```

### content.js — functional sections

| Section | Responsibility |
|---|---|
| **Accession scan** | Regex `/\b(GSE\|GSM\|GPL\|GDS\|GSL)\d+\b/g` run against `document.body.innerText`; deduplication via `Set` |
| **Badge** | Fixed red circle (`#geo-plugin-badge`) — hides on panel open, reappears on close |
| **Panel** | Slide-in drawer (`#geo-plugin-panel`) with dark overlay; lazy-created on first badge click |
| **GSE tree** | Expand button fetches NCBI SOFT text, parses title / super-series / sub-series / sample IDs |
| **GSM nodes** | Each sample is expandable; fetches GSM SOFT text to find BigWig supplementary files |
| **Cart** | In-memory `Map` (url → metadata); sticky footer shows count + "Open in IGV" button |
| **IGV checkout** | Generates a self-contained HTML blob with IGV.js pre-configured with selected tracks; opens in a new tab |

### Data flow

```
Page load
  └─ Scan innerText for GEO accessions
       └─ Badge rendered (count)
            └─ User clicks badge → Panel opens
                 └─ GSE accession clicked (▶)
                      └─ fetch NCBI SOFT text (GSE)
                           ├─ Render: title, super/sub-series, sample list
                           └─ GSM accession clicked (▶)
                                └─ fetch NCBI SOFT text (GSM)
                                     └─ Render: BigWig file checkboxes
                                          └─ User checks files → Cart updated
                                               └─ "Open in IGV" → Blob URL → New tab
```

### Key constants and utilities (`content.js`)

| Symbol | Purpose |
|---|---|
| `ACCESSION_RE` | Master regex for all GEO accession types |
| `GEO_URL` | Base link to NCBI GEO accession viewer |
| `GEO_TEXT_BASE` | Base URL for NCBI SOFT text API |
| `MAX_SAMPLES_SHOWN` | Max GSM rows rendered inline (default 10) |
| `cart` | `Map<url, {name, gsm, gse, organism}>` — selected BigWig files |
| `gseFiles` | `Map<gse, Set<url>>` — all fetched BigWig URLs per series |
| `fileIndex` | `Map<url, metadata>` — flat lookup used by "Add all loaded" |
| `ORGANISM_GENOME` | Maps organism strings to IGV genome IDs |
| `fetchGEOSeries(acc)` | Fetches and parses a GSE SOFT record |
| `parseGsmSoft(text)` | Parses a GSM SOFT record for BigWig URLs and organism |
| `buildIgvHtml(entries)` | Generates the IGV viewer HTML blob |

---

## Third-Party Notices

See [NOTICE](NOTICE) for third-party attribution.

---

## License

MIT — see [LICENSE](LICENSE).
