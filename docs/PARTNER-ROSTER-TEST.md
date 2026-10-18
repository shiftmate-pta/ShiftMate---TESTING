# Partner roster — TEST handoff

Scope: TEST repository only. Shared days off use a soft dusty-rose background in the existing Calendar and Home fortnight strip. Existing shift borders, Today indicator, actual/projected classes and OT recommendation logic remain in place. There is no calendar toggle. A compact legend appears after configuration.

## Setup

Open Settings → Partner roster. Pick a repeating cycle (7, 10, 14, 28 or custom 1–84 days) and tap numbered days between Work and Off. The 6-on/4-off preset is generic; no personal roster or name is preloaded. Set a known date, its cycle day, and the effective date. Preview partner availability by weekday, then save. Use a new effective date for a changed pattern, or choose an existing pattern to edit it. Prior patterns are retained.

For the approved 10-day sample, cycle day 1 is 19 October 2026. Six Work days produce Off dates 25–28 October and 4–7 November. With the sample own roster, only 25–26 October shade: the sample user works 27–28 October.

Tap a preview date to cycle an individual override through Work, Off, Unknown and back to the pattern. Manual mode has no repeating availability; unentered dates remain unknown. Remove partner roster clears the feature.

## Data and comparison rules

Partner availability is device-wide, stored under `ptaV2PartnerRoster`, independently of saved pay-cycle employment settings. Opening historical pays cannot revert it. Backups include it; restoring a legacy backup clears absent partner data. App reset removes it. No account connection or synchronization is introduced.

Pattern arithmetic uses UTC date ordinals, avoiding DST drift. Known own shifts/leave override predictions. Consistent with the existing calendar, blank dates in a cycle containing entered shifts are treated as off; saved actual cycles also establish availability. A wholly untouched cycle without a projection is unknown. Partial book-off remains a working date while the original shift remains in place. Partner unknown dates never count as off. Shared availability means rostered days off, including the first day after nights; exact hours and recovery time are deliberately excluded.

## Validation

Run `node tests/partnerRoster.test.js` for cycle lengths, date/anchor alignment, repeating boundaries, unknown handling, overrides, manual mode, effective-dated history and DST-safe arithmetic.

Run the existing `payCalculator.test.js`, `annualLeaveLoading.test.js`, `formPdf.test.js` and `offlineAllowanceCoverage.test.js` from the repository root.

Run `PLAYWRIGHT_MODULE=/path/to/playwright PARTNER_BROWSER=webkit node tests/partnerRoster.browser.test.cjs` for mobile browser integration. `PARTNER_BROWSER_EXECUTABLE` can select a locally installed browser executable/wrapper. Tests cover UI setup, exact matching days, working-day exclusions, rose CSS, unchanged star counts and border colours, Today, Home, persistence, selecting any anchor cycle day, pattern revisions, invalid custom lengths, individual overrides, manual mode, backup/legacy restore, cached assets, unknown own days and removal.

On this Linux WebKit host a full offline `page.reload()` returns an internal navigation error. `PARTNER_SKIP_OFFLINE_RELOAD=1` skips only that step, while still checking service-worker control and all new cached assets. Full offline reopening and native Safari visual/flip behaviour must be checked on the target iPhone before declaring those validated. Headless Linux WebKit also exposes mirrored legacy flip backs in screenshots; compare the target device before considering any unrelated flip changes.

## Apply through Codex

Review the feature branch against current TEST main, reconcile any intervening changes, run checks, and apply to TEST only. Verify the new partner scripts and CSS are in the offline shell and the cache version is updated. Keep LIVE, payroll rules, form generation and the paused scanner untouched. Report the actual deployed TEST commit and URL; do not claim deployment from a branch/PR alone.
