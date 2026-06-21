import io
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
import os

from checkers.claim_checker import check_claim
from checkers.cf4_checker import check_cf4
from checkers.cf5_checker import check_cf5
from checkers.esoa_checker import check_esoa
from checkers.yakap_fpe_checker import check_yakap_fpe
from checkers.yakap_spe_checker import check_yakap_spe
from report_generator import generate_report

app = FastAPI(title="XML Validator API")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:3000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- Request / Response Models ----

class FileInput(BaseModel):
    name: str
    content: str


class ValidateRequest(BaseModel):
    doc_type: str  # "claim" | "cf5" | "esoa"
    files: List[FileInput]


# ---- Routing helper ----

CHECKER_MAP = {
    "claim": check_claim,
    "cf4": check_cf4,
    "cf5": check_cf5,
    "esoa": check_esoa,
    "yakap_fpe": check_yakap_fpe,
    "yakap_spe": check_yakap_spe,
}


# ---- Endpoints ----

@app.post("/validate")
async def validate(payload: ValidateRequest):
    doc_type = payload.doc_type.lower()
    checker = CHECKER_MAP.get(doc_type)
    if checker is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown doc_type '{payload.doc_type}'. Must be one of: claim, cf4, cf5, esoa"
        )

    results = []
    for f in payload.files:
        result = checker(f.name, f.content)
        results.append(result)

    if doc_type == "cf5":
        _apply_cf5_batch_checks(results)

    return {"results": results}


def _apply_cf5_batch_checks(results: list):
    """FIX 7: ClaimNumber uniqueness across batch (cross-file UNIQUE constraint)."""
    from lxml import etree
    seen = {}  # {claim_number: [filename, ...]}
    for r in results:
        try:
            # Re-extract ClaimNumber from filename/content isn't available here;
            # scan existing errors to find it, or parse on the fly isn't possible.
            # Instead we store it during per-file check via a side-channel in result.
            cn = r.get("_claim_number", "")
            if cn:
                seen.setdefault(cn, []).append(r["filename"])
        except Exception:
            pass

    for cn, files in seen.items():
        if len(files) > 1:
            for r in results:
                if r["filename"] in files:
                    r["errors"].append({
                        "field": "BATCH > ClaimNumber",
                        "rule": "UNIQUE CONSTRAINT (ClaimNumber across batch)",
                        "message": f"[UNIQUE] ClaimNumber '{cn}' appears in multiple files: {', '.join(files)}.",
                        "line": None,
                        "severity": "error",
                    })
                    r["status"] = "fail"


@app.post("/download-report")
async def download_report(payload: ValidateRequest):
    doc_type = payload.doc_type.lower()
    checker = CHECKER_MAP.get(doc_type)
    if checker is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown doc_type '{payload.doc_type}'. Must be one of: claim, cf4, cf5, esoa"
        )

    results = []
    for f in payload.files:
        result = checker(f.name, f.content)
        results.append(result)

    if doc_type == "cf5":
        _apply_cf5_batch_checks(results)

    xlsx_bytes = generate_report(results)

    return StreamingResponse(
        io.BytesIO(xlsx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=validation_report.xlsx"
        }
    )


# ---- Static files (serve frontend) ----
# Mount after API routes so /validate and /download-report take priority
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
frontend_path = os.path.abspath(frontend_path)

if os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
