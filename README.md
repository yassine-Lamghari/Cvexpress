# CVzzer

AI-powered CV builder that generates tailored resumes, cover letters, and application emails from your profile and a job posting. Built with Next.js, NVIDIA AI, Celery/Redis, PostgreSQL/Supabase, and MinIO.

## Features

- Multi-step builder: profile, skills, job offer, template selection, AI generation
- 3 LaTeX templates: Professional, Charles, Rezume
- AI-powered CV tailoring via NVIDIA Integrate (`deepseek-ai/deepseek-v4-flash-0731`)
- AI edit bar for post-generation refinements
- LaTeX code preview and editor
- PDF download via server-side LaTeX compilation
- Internationalization (French / English)

## Prerequisites

- **Node.js** 18+
- **pdflatex** (via [TeX Live](https://www.tug.org/texlive/) or [MiKTeX](https://miktex.org/))
- **pdftoppm** (via [poppler-utils](https://poppler.freedesktop.org/) — for PDF preview)
- **ImageMagick** (optional — `magick` binary)

## Setup

1. **Install Node.js dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values:
- `NVIDIA_API_KEY` — server-side key for the NVIDIA Integrate API
- `NVIDIA_BASE_URL` — defaults to `https://integrate.api.nvidia.com/v1`
- `NVIDIA_MODEL` — defaults to `deepseek-ai/deepseek-v4-flash-0731`
- `NVIDIA_FALLBACK_MODEL` — NVIDIA fallback used only if the primary model returns `404`
- `TASK_API_SECRET` — shared only by Next.js and the private Celery task API

## Development

The complete development stack runs in Docker:

```powershell
docker compose --env-file .env.docker up -d --build
```

Open [http://localhost:3000](http://localhost:3000).

## Docker + MinIO object storage

PostgreSQL/Supabase stores relational data and authentication. MinIO stores
private binary objects such as generated PDFs, profile photos, and future raw
data-lake imports.

1. Create the local Docker environment file:

```powershell
Copy-Item .env.docker.example .env.docker
```

2. Replace every placeholder and use long, distinct MinIO passwords. Never put
the MinIO root credentials in a `NEXT_PUBLIC_*` variable.

3. Validate and start the stack:

```powershell
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up -d --build
```

4. Open the services:

- CVzzer: http://localhost:3000
- MinIO S3 API: http://localhost:9000
- MinIO Console: http://localhost:9001
- CVzzer storage health: http://localhost:3000/api/storage/health

The `minio-init` one-shot service creates the private, versioned
`cvzzer-datalake` bucket and an application user restricted to that bucket.
Data is persisted in the `cvzzer-minio-data` Docker volume.

The application connects through the server-only S3 client in
`src/lib/object-storage.ts`. Browser code must call protected CVzzer API routes;
it must never receive MinIO credentials directly.

### Asynchronous PDF pipeline with Celery

PDF downloads use Celery with Redis as both the broker and short-lived result
backend. PostgreSQL remains the durable job-status source:

1. `POST /api/latex/jobs` authenticates the user, creates a PostgreSQL tracking
   row, then calls the private `task-api` service.
2. `task-api` publishes `cvzzer.generate_pdf` to the Redis broker.
3. The Celery `pdf-worker` consumes the task, compiles LaTeX outside the web
   request, uploads the PDF to MinIO, and updates PostgreSQL.
4. The browser polls `GET /api/latex/jobs/{jobId}` and downloads through the
   authenticated `GET /api/latex/jobs/{jobId}/download` proxy.

Before starting the stack, run
`supabase/migrations/202608130001_create_storage_objects.sql` in the Supabase SQL
Editor and set `SUPABASE_SERVICE_ROLE_KEY` in `.env.docker`. This key is private
and is supplied only to the Celery worker. `TASK_API_SECRET` protects the
internal enqueue endpoint and is never exposed to browser code.

### Asynchronous NVIDIA AI pipeline

CV generation also leaves the web request immediately and runs in Celery:

1. `POST /api/generate` validates the input, loads the selected template, and
   submits `cvzzer.generate_cv` to the private task API.
2. The task API publishes the job to Redis on the `ai-generation` queue.
3. Celery calls NVIDIA Integrate with the configured DeepSeek model and consumes
   its streamed response without holding the Next.js request open.
4. The browser polls the signed `GET /api/generate/{jobId}` URL until the result
   has been validated and post-processed.

The worker uses the requested NVIDIA profile: temperature `1`, top-p `0.95`,
up to `16384` output tokens, thinking enabled, and high reasoning effort. If
NVIDIA reports that this primary function is unavailable, CVzzer retries once
with `NVIDIA_FALLBACK_MODEL` so generation remains usable.

Useful commands:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f minio
docker compose --env-file .env.docker down
```

`docker compose down` keeps the MinIO volume. Adding `--volumes` permanently
deletes stored objects and should only be used intentionally.

## Architecture

```
Browser → Next.js API → private task-api → Redis broker → Celery worker
             │                                      │          ├─ NVIDIA AI (streaming)
             │                                      │          ├─ pdflatex
             │                                      │          ├─ MinIO
             │                                      │          └─ Supabase/PostgreSQL
             ├─ Supabase authentication             │
             └─ authenticated MinIO downloads       └─ Redis result backend
```

## Deployment

The project uses the Next.js standalone server. Deploy the Docker Compose stack
or equivalent managed services:

1. **Next.js app** — frontend and authenticated API gateway.
2. **Celery task API and workers** — private network only.
3. **Redis** — broker and short-lived result backend.
4. **MinIO** — persistent object storage.
5. **Supabase/PostgreSQL** — authentication, CV data, and durable job metadata.

```bash
docker compose --env-file .env.docker up -d --build
```

## Project Structure

```
src/
  app/              # Next.js pages (builder, templates)
  components/       # React components (builder steps, editor, PDF, layout)
  lib/              # Utilities (api-config, i18n, LaTeX parser, HTML templates)
  stores/           # Zustand state management
  types/            # TypeScript types
  messages/         # i18n translation files (en.json, fr.json)
services/pdf-worker/
  api.py             # Private enqueue/status API
  tasks.py           # NVIDIA generation and LaTeX/PDF Celery tasks
  celery_app.py      # Redis broker/result configuration
```
