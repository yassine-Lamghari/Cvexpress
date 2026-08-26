import os
from urllib.parse import quote

from celery import Celery


def redis_url(database: int) -> str:
    host = os.getenv("REDIS_HOST", "redis")
    port = int(os.getenv("REDIS_PORT", "6379"))
    password = quote(os.getenv("REDIS_PASSWORD", ""), safe="")
    credentials = f":{password}@" if password else ""
    return f"redis://{credentials}{host}:{port}/{database}"


celery_app = Celery(
    "cvzzer_pdf",
    broker=redis_url(int(os.getenv("REDIS_BROKER_DB", "0"))),
    backend=redis_url(int(os.getenv("REDIS_RESULT_DB", "1"))),
    include=["tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    result_expires=86_400,
    task_soft_time_limit=150,
    task_time_limit=180,
    broker_transport_options={"visibility_timeout": 1_200},
    result_backend_transport_options={
        "visibility_timeout": 1_200,
        "global_keyprefix": "cvzzer-celery-",
    },
)
