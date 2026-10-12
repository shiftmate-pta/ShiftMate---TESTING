# PTA form PDF review

These changes belong to the TEST repository only. No LIVE checkout or deployment is involved.

## References and rendering

Leave uses the supplied **Application for Leave Form (Transit Officers), effective 1 July 2026**. Microsoft Word exported a read-only copy to PDF. `leave-form-template.pdf` retains the official page, embedded fonts, vector tables, selectable wording, approval fields, and footer. Its original page dimensions are 595.32 × 842.04 points. Document metadata was replaced with a generic title; the source Word file is not committed.

Shift Swap retains the repository's blank PTA **Shift Change Request Form, Form No. 4030-000-XXX.1 Rev 2** image. The supplied filled PDF confirms the layout and illustrates the existing alignment problems. Neither the filled reference nor its personal data is committed. A blank Swap Word original was not supplied, so independent equivalence to that Word original cannot be claimed. The image is embedded losslessly on A4 (595.276 × 841.89 points), rather than treating its pixels as PDF points.

`vendor/pdf-lib.min.js` is locally bundled pdf-lib 1.17.1 under its accompanying MIT license. There are no CDN/font/network dependencies during generation once the updated app shell has been cached.

## Field mapping

All destinations are page 1, with one copy per existing Leave group or Swap entry. `formPdfFields.js` contains the complete coordinate/dimension map in top-left template pixels. `formPdf.js` converts it to PDF points. Existing application data and grouping/validation logic remain in `app.js`.

| Source | Destination | Rendering and validation |
| --- | --- | --- |
| Settings employee name, service number, home line | Leave Section 1 | Left aligned, regular Helvetica, 22 template pixels; shrink within the cell |
| Saved/manual leave group, first/last dates, adjusted hours, comments | Leave selected Section 2 row | Dates keep existing en-AU formatting; hours retain one decimal; comments wrap within the row |
| Contactable/evidence selectors | Leave Section 3 Yes/No square interiors | Vector X, exactly one mark per pair |
| Settings employee name and generation date | Leave Section 4 employee name/date | Signature and approval areas remain blank |
| Requesting/replacement names and service numbers | Swap employee identity lines | Bold Helvetica, 25 template pixels, constrained to each field |
| Request and partner dates, shifts, start/finish values | Swap original/requested position cells | Preserve reciprocal mapping; roster mode retains PEddmmyyyy and blank dates/times |
| Contingent, others involved, cost neutrality | Swap option squares/name field | Vector X; retain existing conditional validation |
| Both names, service numbers, generation date | Swap confirmation rows | Preserve existing values; remove only placeholder ink, retaining borders and printed labels |

Entered text remains selectable for WinAnsi characters, including curly apostrophes and common diacritics. Other Unicode names use a small transparent canvas overlay with the browser's Arial fallback fonts. No entered value is silently truncated; text shrinks to 14 template pixels, then reports a field-specific error if it cannot fit. Stored data is never modified by that error.

## Browser and offline behavior

The preview tab opens synchronously after existing form validation, before template/PDF awaits, to retain Safari's user activation. Generation errors close that tab. Popup-blocked/closed-tab cases use the existing download fallback. Blob URLs remain valid for five minutes.

The service worker cache includes both templates, the renderer, pdf-lib, and every versioned script/stylesheet referenced by HTML. An uncached asset failure returns a network error rather than substituting HTML as a PDF/script. Navigation retains the offline HTML fallback. This cache version requires one online load/update before first offline use.

## Verification

- `node tests/formPdf.test.js`: all 13 Leave rows/reasons, multipage output, original/A4 page dimensions, long-value rejection, diacritics, and first-use offline asset coverage.
- `node tests/payCalculator.test.js` and `node tests/offlineAllowanceCoverage.test.js`: existing pay and allowance regressions.
- `tests/formPdf.browser.test.cjs`: actual Leave and single/roster Swap buttons, synthetic data, iPhone 13 viewport, Unicode fallback, synchronous preview reservation, and reload. Run with an installed Playwright module; use `FORM_RENDER_ONLY=1` only when explicitly checking rendering without offline coverage.
- Render generated PDFs with Poppler and visually inspect field alignment at their mapped resolutions. Compare Leave with the official Word export outside entered-field regions.

The completed checks passed in Chromium with first-use offline generation and offline reload, and in Windows WebKit with online generation/reload. Both engines passed popup-blocked downloads, Unicode rendering, mixed Leave groups (including partial book-off and adjusted hours), and stored-data preservation. The WebKit build's service-worker registration stalled, so WebKit offline behavior was not verified. The Leave render comparison found **zero changed pixels outside mapped populated fields** at 1414 × 2000 pixels.

Real iPhone Safari and installed-PWA open/save/share/print checks require a physical device and remain a review gate before any LIVE release. Windows WebKit testing does not replace those checks.

For device review, open the TEST review build online once and let its service worker update. Generate Leave and both Swap modes in Safari and in the installed PWA, then repeat in airplane mode after closing/reopening the app. Check Files saving, the native Share sheet, and Print preview at 100% A4 scale. Verify that approvals/signature areas, long names, and checked/unchecked choices remain legible.
