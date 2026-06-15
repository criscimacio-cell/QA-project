# XML Validator

A local web application for validating XML documents (Claim, CF5, ESOA formats).

## Setup

Install Python dependencies:

```
pip install fastapi uvicorn openpyxl python-multipart lxml pandas
```

## Run

```
cd backend && uvicorn main:app --reload --port 8000
```

Then open: http://localhost:8000

## Usage

1. Select document type (Claim, CF5, or ESOA)
2. Choose input method: paste XML, upload files, or upload a folder
3. Click Validate
4. View results and download Excel report
