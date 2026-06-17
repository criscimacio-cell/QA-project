# core_checker.py / fpe_xml_checker.py / spe_xml_checker.py — fix log

All changes verified against `KonsultaData_v1_14_1.dtd` and the Rev-14 data
dictionary, then smoke-tested with `smoke_test.py` (included). Every fix
below produced the expected ERROR/WARNING in isolation before being merged.

## Fixed

1. **DTD filename mismatch** (`core_checker.py`, `make_arg_parser`)
   Default path was `KonsultaData_v1.14_1.dtd` (dot); the real file is
   `KonsultaData_v1_14_1.dtd` (underscore). Without an explicit `--dtd`,
   structural validation was silently skipped. Corrected the default.

2. **ID byte-length ceiling** (`pHciCaseNo`, `pHciTransNo`)
   Was checked against 30 bytes everywhere; the dictionary specifies
   `VARCHAR2(21)`. Corrected to 21 across ENLISTMENT, PROFILE, SOAP,
   MEDICINE, DIAGNOSTICEXAMRESULT, DOCUMENT.

3. **Enum mix-ups in the RULES table**
   - `SPUTUM.pFindings` had FOBT/PPDTest's `{P,N}` set; corrected to the
     documented numeric `{1,2}`.
   - `SPUTUM.pDataCollection` had `{S1,S2,S3}`; corrected to `{1,2,3,X}`.
   - `FOBT.pFindings` / `PPDTest.pFindings` had no enum at all; added
     `{P,N}` (and fixed byte length 2000→1).
   - `MEDICINE.pCategory` incorrectly carried `{NCD,ANTIBIOTIC,OTHERS}`;
     removed (it's library-referenced, not a fixed enum).
   - `MEDICINE.pOthMedDrugGrouping` — the field that actually owns that
     enum — had no check at all; added it.
   - `FECALYSIS.pColor` / `pConsistency` / `pBlood` had no valid-value
     enforcement despite documented coded values; added.

4. **Missing library files now visible in the report**
   `load_libraries()` now returns `(libs, missing_filenames)` instead of
   silently `continue`-ing past absent files. Both checker scripts surface
   each missing file as a `WARNING` in the actual report, not just a
   stderr line that's easy to miss.

5. **Severity: numeric/length violations now ERROR, not WARNING**
   A non-numeric value or an over-length field is a guaranteed DB-insert
   failure downstream; both now fail validation by default instead of
   requiring `--strict`.

6. **Primary-key uniqueness** (`check_unique_keys`, new)
   `pHciTransNo` is documented PK on ENLISTMENT/PROFILE/SOAP. Duplicates
   within the same element type now raise an ERROR.

7. **Structured-ID format checks** (`check_id_formats`, new)
   Validates the documented prefix-letter + digit-count shape of
   `pHciTransmittalNumber` (R+20 digits), `pHciTransNo` (E/P/S+20 digits),
   and `pHciCaseNo` (T+19 digits). WARNING-level — it checks shape, not
   whether the embedded year/month is plausible.

8. **Sex/age-conditional plausibility** (`check_demographic_rules`, new)
   Flags `MENSHIST`/`PREGHIST` marked applicable on a male patient, and
   flags a patient ≤24 months old whose pediatric PEPERT measurements
   (`pLength`, `pHeadCirc`, etc.) are all blank. WARNING-level by design —
   these are plausibility checks, not hard structural rules.

9. **Cross-record identity consistency** (`check_identity_consistency`, new)
   For every PROFILE/SOAP/MEDICINE/DIAGNOSTICEXAMRESULT that references a
   `pHciCaseNo`, confirms `pMemPin`/`pPatientPin`/`pPatientType` actually
   match the linked ENLISTMENT, not just that the case number exists.

## Investigated, not changed

- **Tranche-blind required-field enforcement.** Originally flagged as "a
  field required only in tranche 2 could go missing in a tranche-1 run
  undetected." Checked this against the actual DTD's `#REQUIRED`/`#IMPLIED`
  markers field-by-field: this DTD marks nearly everything `#REQUIRED`
  regardless of tranche — far stricter than the dictionary's per-tranche
  columns in most cases (e.g. `MEDICINE.pDrugCode` is `#REQUIRED` in the
  DTD even though the dictionary marks it "not required" in either
  tranche, relying instead on documented sentinel placeholders like
  `'NOMED...'`). So the practical risk runs the *opposite* direction from
  what I originally described: the DTD may be too rigid for a genuine
  tranche-1-only submission (forcing placeholder SOAP/MEDICINE data that
  shouldn't be expected yet), not too lax. Writing an independent
  presence-check on top of this without confirming how Stash's actual
  tranche-1 generator populates those placeholder elements would risk
  manufacturing false failures rather than catching real ones. Flagging
  this for a business-side decision rather than guessing at a fix.

- **Diabetes/NCD cross-field rule scope.** The footnote referencing
  "highlighted parameters under DIAGNOSTICEXAMRESULT" implies more fields
  may be in scope than the current FBS/RBS-only check. Left as-is since
  confirming the full intended set needs the color-highlighted PDF, which
  doesn't survive text extraction.

## Files changed
`core_checker.py`, `fpe_xml_checker.py`, `spe_xml_checker.py` — diffs
included as `*.diff`. `smoke_test.py` is a standalone regression check for
the new functions (not wired into the CLI scripts); useful to re-run after
any future RULES-table edits.
