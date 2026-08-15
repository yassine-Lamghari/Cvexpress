import hmac
import os

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from celery_app import celery_app


class PdfJobPayload(BaseModel):
    jobId: str = Field(min_length=1, max_length=100)
    userId: str = Field(min_length=1, max_length=100)
    cvId: str | None = None
    latexCode: str = Field(min_length=20, max_length=1_000_000)
    photo: str = Field(default="", max_length=12_000_000)
    template: str
    filename: str = Field(min_length=1, max_length=180)


app = FastAPI(title="CVzzer PDF Task API", docs_url=None, redoc_url=None)


def verify_secret(value: str | None) -> None:
    expected = os.getenv("TASK_API_SECRET", "")
    if not expected or not value or not hmac.compare_digest(value, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    try:
        celery_app.backend.client.ping()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Redis unavailable") from exc
    return {"status": "ok", "broker": "redis", "worker": "celery"}


@app.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
def create_job(
    payload: PdfJobPayload,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    verify_secret(x_internal_secret)
    celery_app.send_task(
        "cvzzer.generate_pdf",
        args=[payload.model_dump()],
        task_id=payload.jobId,
        queue="pdf-generation",
    )
    return {"jobId": payload.jobId, "status": "queued"}

