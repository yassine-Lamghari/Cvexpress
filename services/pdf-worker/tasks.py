import base64
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import boto3
import requests
from botocore.client import Config
from celery.utils.log import get_task_logger
from PIL import Image

from celery_app import celery_app


logger = get_task_logger(__name__)
ALLOWED_TEMPLATES = {
    "professional", "charles", "rezume", "modern_image", "one_and_half_column"
}
FORBIDDEN_LATEX = re.compile(r"\\write18\b|\\immediate\s*\\write18|\\input\s*\|", re.I)


class PermanentTaskError(Exception):
    pass


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def update_record(job_id: str, values: dict) -> None:
    supabase_url = required_env("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
    service_key = required_env("SUPABASE_SERVICE_ROLE_KEY")
    response = requests.patch(
        f"{supabase_url}/rest/v1/storage_objects",
        params={"job_id": f"eq.{job_id}"},
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=values,
        timeout=15,
    )
    response.raise_for_status()


def set_progress(task, job_id: str, progress: int, status: str = "processing") -> None:
    task.update_state(state="PROGRESS", meta={"progress": progress})
    update_record(job_id, {"status": status, "progress": progress})


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", value)[:170]
    return cleaned or "CV.pdf"


def write_photo(photo_data_url: str, directory: Path) -> None:
    if not photo_data_url:
        return
    match = re.fullmatch(r"data:image/(png|jpe?g|webp);base64,(.+)", photo_data_url, re.I | re.S)
    if not match:
        raise PermanentTaskError("Invalid photo data URL")
    try:
        raw = base64.b64decode(match.group(2), validate=True)
        if len(raw) > 8_000_000:
            raise PermanentTaskError("Photo exceeds 8 MB")
        with Image.open(io.BytesIO(raw)) as image:
            image.convert("RGB").save(directory / "photo.png", format="PNG")
    except PermanentTaskError:
        raise
    except Exception as exc:
        raise PermanentTaskError("Invalid photo image") from exc


def compile_pdf(payload: dict) -> tuple[bytes, Path]:
    latex_code = str(payload.get("latexCode", "")).strip()
    template = str(payload.get("template", ""))
    if template not in ALLOWED_TEMPLATES:
        raise PermanentTaskError("Unknown template")
    if len(latex_code) < 20 or len(latex_code) > 1_000_000:
        raise PermanentTaskError("Invalid LaTeX document length")
    if FORBIDDEN_LATEX.search(latex_code):
        raise PermanentTaskError("Forbidden LaTeX command")

    temp_root = Path(os.getenv("LATEX_TMP_DIR", "/app/.latex_tmp"))
    temp_root.mkdir(parents=True, exist_ok=True)
    work_dir = Path(tempfile.mkdtemp(prefix="job_", dir=temp_root))
    try:
        (work_dir / "cv.tex").write_text(latex_code, encoding="utf-8")
        write_photo(str(payload.get("photo", "")), work_dir)

        command = ["pdflatex", "-no-shell-escape", "-interaction=nonstopmode", "cv.tex"]
        for _ in range(2):
            subprocess.run(
                command,
                cwd=work_dir,
                capture_output=True,
                timeout=45,
                check=False,
            )

        pdf_path = work_dir / "cv.pdf"
        if not pdf_path.exists():
            log_path = work_dir / "cv.log"
            details = log_path.read_text(encoding="utf-8", errors="replace")[-1500:] if log_path.exists() else ""
            raise PermanentTaskError(f"LaTeX compilation failed: {details}")
        return pdf_path.read_bytes(), work_dir
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise


def upload_pdf(key: str, pdf: bytes) -> None:
    endpoint = required_env("MINIO_ENDPOINT")
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=os.getenv("MINIO_REGION", "us-east-1"),
        aws_access_key_id=required_env("MINIO_ACCESS_KEY"),
        aws_secret_access_key=required_env("MINIO_SECRET_KEY"),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    client.put_object(
        Bucket=required_env("MINIO_BUCKET"),
        Key=key,
        Body=pdf,
        ContentType="application/pdf",
    )


@celery_app.task(
    bind=True,
    name="cvzzer.generate_cv",
    max_retries=1,
    acks_late=True,
    reject_on_worker_lost=True,
    soft_time_limit=890,
    time_limit=900,
)
def generate_cv(self, payload: dict) -> dict:
    self.update_state(state="PROGRESS", meta={"progress": 5})
    base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1").rstrip("/")
    model = os.getenv("NVIDIA_MODEL", "deepseek-ai/deepseek-v4-flash-0731")
    fallback_model = os.getenv("NVIDIA_FALLBACK_MODEL", "minimaxai/minimax-m3").strip()
    api_key = required_env("NVIDIA_API_KEY")

    try:
        def request_completion(selected_model: str) -> requests.Response:
            request_body = {
                "model": selected_model,
                "messages": [
                    {"role": "system", "content": str(payload["systemPrompt"])},
                    {"role": "user", "content": str(payload["userPrompt"])},
                ],
                "temperature": 0.2,
                "top_p": 0.95,
                "max_tokens": 8192,
                "stream": True,
            }
            return requests.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
                stream=True,
                timeout=(15, 90),
            )

        response = request_completion(model)
        if response.status_code == 404 and fallback_model and fallback_model != model:
            response.close()
            logger.warning("NVIDIA model %s is unavailable; using fallback %s", model, fallback_model)
            response = request_completion(fallback_model)
        response.raise_for_status()
        content_parts: list[str] = []
        content_length = 0
        chunk_count = 0
        for raw_line in response.iter_lines(decode_unicode=True):
            if isinstance(raw_line, bytes):
                raw_line = raw_line.decode("utf-8", errors="replace")
            if not raw_line or not raw_line.startswith("data:"):
                continue
            encoded = raw_line[5:].strip()
            if encoded == "[DONE]":
                break
            try:
                chunk = json.loads(encoded)
            except json.JSONDecodeError:
                continue
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            text = delta.get("content")
            if text:
                text_part = str(text)
                content_parts.append(text_part)
                content_length += len(text_part)
            chunk_count += 1
            if chunk_count % 100 == 0:
                progress = min(90, 5 + content_length // 250)
                self.update_state(state="PROGRESS", meta={"progress": progress})

        content = "".join(content_parts).strip()
        response.close()
        if not content:
            raise RuntimeError("NVIDIA API returned an empty completion")
        return {
            "responseText": content,
            "template": str(payload["template"]),
            "locale": str(payload["locale"]),
        }
    except requests.RequestException as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=5)
        raise


@celery_app.task(
    bind=True,
    name="cvzzer.generate_pdf",
    max_retries=2,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_pdf(self, payload: dict) -> dict:
    job_id = str(self.request.id)
    work_dir: Path | None = None
    try:
        set_progress(self, job_id, 10)
        pdf, work_dir = compile_pdf(payload)
        set_progress(self, job_id, 65)

        user_id = re.sub(r"[^a-zA-Z0-9-]", "", str(payload["userId"]))
        filename = safe_filename(str(payload["filename"]))
        if not user_id:
            raise PermanentTaskError("Invalid user identifier")
        object_key = f"users/{user_id}/pdfs/{job_id}-{filename}"

        upload_pdf(object_key, pdf)
        set_progress(self, job_id, 90)

        result = {
            "objectKey": object_key,
            "filename": filename,
            "contentType": "application/pdf",
            "sizeBytes": len(pdf),
            "checksumSha256": hashlib.sha256(pdf).hexdigest(),
        }
        update_record(job_id, {
            "status": "completed",
            "progress": 100,
            "object_key": result["objectKey"],
            "size_bytes": result["sizeBytes"],
            "checksum_sha256": result["checksumSha256"],
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": None,
        })
        return result
    except PermanentTaskError as exc:
        try:
            update_record(job_id, {
                "status": "failed", "progress": 100, "error_message": str(exc)[:1000]
            })
        except Exception:
            logger.exception("Unable to persist permanent failure for job %s", job_id)
        raise
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 1))
        try:
            update_record(job_id, {
                "status": "failed", "progress": 100, "error_message": str(exc)[:1000]
            })
        except Exception:
            logger.exception("Unable to persist failed state for job %s", job_id)
        raise
    finally:
        if work_dir:
            shutil.rmtree(work_dir, ignore_errors=True)
