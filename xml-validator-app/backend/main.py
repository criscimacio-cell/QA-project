import io
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Literal
import os

from checkers import claim_checker, cf5_checker, esoa_checker
from report_generator import generate_report

app = FastAPI(title="XML Validator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FileInput(BaseModel):
    name: str
    content: str


class ValidateRequest(BaseModel):
    doc_type: Literal["claim", "cf5", "esoa"]
    files: List[FileInput]


@app.post("/validate")
async def validate(request: ValidateRequest):
    checker_map = {
        "claim": claim_checker.check,
        "cf5": cf5_checker.check,
        "esoa": esoa_checker.check,
    }
    checker = checker_map[request.doc_type]
    results = [checker(file.name, file.content) for file in request.files]
    return {"results": results}


@app.post("/download-report")
async def download_report(request: ValidateRequest):
    checker_map = {
        "claim": claim_checker.check,
        "cf5": cf5_checker.check,
        "esoa": esoa_checker.check,
    }
    checker = checker_map[request.doc_type]
    results = [checker(file.name, file.content) for file in request.files]
    report_bytes = generate_report(results)

    return StreamingResponse(
        io.BytesIO(report_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=validation_report.xlsx"},
    )


# Mount static files last so API routes take precedence
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
frontend_path = os.path.abspath(frontend_path)
if os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
