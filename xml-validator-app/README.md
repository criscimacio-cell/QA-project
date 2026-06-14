# XML Validator App

A local web application to validate Claim, CF5, and ESOA XML documents.

## Setup

### 1. Install dependencies

```bash
pip install fastapi uvicorn openpyxl python-multipart
```

### 2. Run the server

```bash
cd xml-validator-app/backend
uvicorn main:app --reload --port 8000
```

### 3. Open the app

Navigate to [http://localhost:8000](http://localhost:8000)

---

## Features

- **Three document types**: Claim, CF5, ESOA — each with its own validation rules
- **Three input methods**: Paste raw XML, upload individual files, or select an entire folder
- **Inline results**: Per-file pass/fail status with field-level error details
- **Excel report**: Download a `.xlsx` report with a Summary sheet and a Details sheet

## Validation Rules

### Claim
- Required root: `<Claim>` or `<ClaimSet>`
- Required fields: ClaimID, PatientName, ServiceDate, DiagnosisCode, ProcedureCode, BilledAmount
- ServiceDate: `YYYY-MM-DD`
- BilledAmount: positive number
- DiagnosisCode: `[A-Z]\d{2,5}`
- ProcedureCode: exactly 5 digits

### CF5
- Required root: `<CF5>` or `<CF5Form>`
- Required fields: FormID, SubmitterID, TaxYear, GrossAmount, NetAmount, TaxWithheld
- TaxYear: 4-digit year 2000–2099
- NetAmount ≤ GrossAmount
- TaxWithheld ≥ 0

### ESOA
- Required root: `<ESOA>` or `<ESOADocument>`
- Required fields: SOAID, EffectiveDate, ExpiryDate, CoverageType, PremiumAmount, InsuredName
- Dates: `YYYY-MM-DD`, ExpiryDate must be after EffectiveDate
- PremiumAmount: positive decimal
- CoverageType: one of `HEALTH`, `LIFE`, `PROPERTY`, `AUTO`

## Project Structure

```
xml-validator-app/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── checkers/
│   │   ├── claim_checker.py
│   │   ├── cf5_checker.py
│   │   └── esoa_checker.py
│   └── report_generator.py     # Excel generation
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```
