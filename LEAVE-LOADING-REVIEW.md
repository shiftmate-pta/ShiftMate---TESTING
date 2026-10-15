# TEST annual leave loading review

## Full-time-only update (2.7.10)

The app now supports full-time employees only. Legacy employmentFraction and partTimeLeaveHours values are ignored in all entitlement calculations, including saved cycles and restored data. Explicit individual leave hours are retained. Cap year/history inputs remain optional under the collapsed Advanced leave-loading settings section; blank history remains Unknown. No tax, mileage or acting-pay formula change is made. The part-time description below records the superseded 2.7.9 implementation, not current behaviour.


## Source and effective date

PTA/RTBU exchange of letters dated 3 August 2026, Attachment A, supplied privately for this review. The operational-roster table applies from 23 August 2026. The source document, payslips, signatures and screenshots are not committed. The percentages are implemented in annualLeaveLoading.js and apply to the substantive classification and base rate resolved for each leave date, including profile progression within a cycle. Acting/higher-duty flags do not increase the loading. Existing historical calculations before 23 August are retained.

The MOU says further roster, wage or weekday-penalty changes require a replacement exchange of letters. Future unverified tables are not established by this update.

## Payment-line rounding policy

Retain the precise hourly percentage result. Round base and loading independently to cents on each leave date, including the annual portion of mixed personal/annual leave. The MOU does not specify payment-line grouping. This explicit daily-line policy is supported by the supplied ten-hour payments; four such daily lines also reproduce payroll's combined forty-hour payment. A different future payroll grouping can differ by a cent and needs evidence before changing this policy.

Example: 44.37 x .2879 = 12.774123 per hour. Ten hours rounds to 127.74, not 127.70. Seven daily lines total 894.18; aggregating all seventy hours before rounding would incorrectly produce 894.19 for the supplied comparison.

## Cap and part-time handling

The 2026 cap is 2648.49 for 200 hours. Cap the hourly loading at 2648.49/200; this applies to FCO as well as other classifications and scales proportionally with annual leave hours. 320 hours has a 4237.58 ceiling. The part-time annual entitlement and ceiling scale with the contracted-hours fraction, so the cap per actual leave hour is unchanged. Actual part-time leave hours must be entered using regular ordinary hours or the qualifying-service average under clause 6.5.6; the UI accepts that average and per-day overrides rather than guessing an attendance pattern.

Optional cap history settings record payroll-confirmed annual leave hours and loading paid before the current cycle, by year. A further cumulative ceiling is enforced when these are supplied. Without complete history the app explicitly warns that cumulative reconciliation is unverified, while still applying the proportional rate cap. History must be updated for each cycle; it is not automatically inferred from potentially incomplete local rosters. Payroll rounding differences can accumulate across payment lines. This update does not claim a fully reconciled annual cap ledger.

Only the 2026 cap is sourced. Other years show a warning rather than silently applying the 2026 cap. Cap year defaults to the leave date; the optional Annual leave block commencement field selects the commencement-year cap for a block spanning New Year. A block beginning before 2026 still needs that year's sourced cap, and complete payroll history remains necessary for exact cumulative reconciliation.

## Confirmed prerequisites preserved in this focused change

The isolated main-based checkout did not yet contain the previously requested holiday/route corrections. This change includes those narrow prerequisites, without PDF-formatting or scanner development:

- Paid annual/personal leave on a holiday uses entered ordinary leave hours; a genuine full-time non-rostered day retains eight hours. Day details allow explicit ordinary-day eligibility and hours. Part-time non-rostered eligibility is not guessed.
- Public holiday leave has no annual loading or annual usage, including the mixed annual portion. Leave-form hour totals use the same exclusion. LSL, LWOP and parental exceptions do not gain a public-holiday entitlement.
- The specific Armadale-home/Burswood to Ellenbrook-station return route uses the payroll-confirmed provisional 54.3 km in preference to the road estimate 55.0. Official Schedule 2 routes, other Ellenbrook-line stations and reverse arrangements are unchanged. Mileage and transfer remain separate and cost-neutral/home-line exclusions remain.
- Mileage rate and withholding treatment are unchanged. The UI identifies provisional route status and unverified mileage withholding rather than claiming exemption.

## Anonymous component reconciliation

### Mixed worked/leave fortnight (September)

Confirmed calculator components: worked shifts 2273.96; shift allowances 245.30; separate transfer 44.37; mileage 54.3 x .98 = 53.214, displayed 53.21; annual base 1331.10 plus loading 383.22 = 1714.32.

Current minute-based additional-hours calculation is 1996.354133..., while payroll reports 1996.07. Calculator earnings including mileage are about 0.29 above payroll's 6327.23. This small unresolved difference is retained, not corrected by altering ordinary rates. Gross in the legacy app excludes mileage; compare earnings including mileage when comparing payroll reported gross.

The original screenshot differed from payroll by 61.06 net (4121.82 versus 4182.88). The former regression's 4182.8781 target was a misleading match involving wrong mileage and withholding. It has been replaced by component assertions.

### Leave/holiday fortnight (September/October)

Annual base 3105.90 + loading 894.18 = 4000.08; holiday 10 x 44.37 = 443.70; roster-derived gross 4443.78. Payroll gross 4444.26 includes a separate retrospective mileage adjustment of 0.48, which is not baked into rates. Annual leave usage is 70 hours, total paid hours 80.

Pre-tax packaging 546.95 and super 100; post-tax deductions 7.40 (social club 2 and railway institute 5.40): total excluding withholding 654.35. The unchanged annualised tax engine estimates 850 and net 2939.43 on corrected roster earnings; actual payroll tax is 854 and net 2935.91, including the 0.48 adjustment. Neither value is a forced regression target. The original screenshot difference was 68.02 net, distinct from the other fortnight.

## Withholding remains a separate investigation

No acting pay, income-tax formula or mileage withholding change is made here. ATO PAYG must be verified using the payment-date schedule, employee declarations and any variations. Gross inclusion or a reimbursement label cannot establish CDTX treatment. The existing mileage exclusion is explicitly labelled unverified.

Sources for subsequent withholding/entitlement review:

- Agreement clauses 6.1, 6.5.6 and 6.5.7: https://downloads.wairc.wa.gov.au/agreements/pub070.pdf
- PAYG instrument effective 1 July 2026: https://www.legislation.gov.au/F2026L00716/asmade
- Metropolitan mileage rate from 1 July 2026: https://www.wa.gov.au/media/164105/download?inline=

## Validation and iPhone testing

Run node tests/annualLeaveLoading.test.js, node tests/payCalculator.test.js, node tests/offlineAllowanceCoverage.test.js, and node tests/annualLeaveLoading.browser.test.cjs (with PLAYWRIGHT_MODULE configured). The browser check exercises mobile-sized day controls and a network-disabled reload; it does not substitute for a physical iPhone/WebKit test.

Cache and changed script URLs use 2.7.10-full-time. The new module and exact versioned shell URLs are precached. After the TEST branch is deployed, open TEST online, close and reopen the installed app, confirm version 2.7.10 FULL TIME in Settings, then verify both cycles online and in airplane mode. Back up local roster data before any manual cache troubleshooting. This PR does not deploy or promote to LIVE.
