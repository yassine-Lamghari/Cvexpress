import hmac
import os

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, Field

from celery.result import AsyncResult

from celery_app import celery_app


class PdfJobPayload(BaseModel):
    jobId: str = Field(min_length=1, max_length=100)
    userId: str = Field(min_length=1, max_length=100)
    cvId: str | None = None
    latexCode: str = Field(min_length=20, max_length=1_000_000)
    photo: str = Field(default="", max_length=12_000_000)
    template: str
    filename: str = Field(min_length=1, max_length=180)


class AiJobPayload(BaseModel):
    jobId: str = Field(min_length=1, max_length=100)
    systemPrompt: str = Field(min_length=1, max_length=50_000)
    userPrompt: str = Field(min_length=1, max_length=100_000)
    template: str = Field(min_length=1, max_length=100)
    locale: str = Field(pattern="^(fr|en)$")


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


@app.post("/ai-jobs", status_code=status.HTTP_202_ACCEPTED)
def create_ai_job(
    payload: AiJobPayload,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    verify_secret(x_internal_secret)
    celery_app.send_task(
        "cvzzer.generate_cv",
        args=[payload.model_dump()],
        task_id=payload.jobId,
        queue="ai-generation",
    )
    return {"jobId": payload.jobId, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    x_internal_secret: str | None = Header(default=None),
) -> dict:
    verify_secret(x_internal_secret)
    task = AsyncResult(job_id, app=celery_app)
    response: dict = {"jobId": job_id, "state": task.state}
    if task.state == "SUCCESS":
        response["result"] = task.result
    elif task.state == "FAILURE":
        response["error"] = str(task.result)[:2_000]
    elif isinstance(task.info, dict):
        response["progress"] = int(task.info.get("progress", 0))
    return response
