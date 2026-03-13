# CV Express IA

AI-powered CV builder that generates tailored resumes, cover letters, and application emails from your profile and a job posting. Built with Next.js (static frontend) + PHP (LaTeX compilation API) + Google Gemini AI.

## Features

- Multi-step builder: profile, skills, job offer, template selection, AI generation
- 3 LaTeX templates: Professional, Charles, Rezume
- AI-powered CV tailoring via Google Gemini
- AI edit bar for post-generation refinements
- LaTeX code preview and editor
- PDF download via server-side LaTeX compilation
- Internationalization (French / English)

## Prerequisites

- **Node.js** 18+
- **PHP** 8.1+
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
- `GEMINI_API_KEY` — get a free key at [Google AI Studio](https://aistudio.google.com/apikey)
- `NEXT_PUBLIC_LATEX_API_URL` — defaults to `http://localhost:8000`

3. **Verify LaTeX dependencies:**

```bash
php -S localhost:8000 -t api/
# Then visit: http://localhost:8000/health.php
```

The health endpoint will report which binaries are found.

## Development

Run both servers:

```bash
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — PHP API server
php -S localhost:8000 -t api/
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────┐
│  Next.js Frontend   │────▶│     PHP API Server       │
│  (Static Export)    │     │  localhost:8000           │
│  localhost:3000     │     │                           │
│                     │     │  /generate.php  (Gemini)  │
│  - React + Zustand  │     │  /edit.php      (Gemini)  │
│  - Tailwind CSS     │     │  /latex-download.php      │
│  - i18n (fr/en)     │     │  /latex-preview.php       │
│                     │     │  /health.php              │
└─────────────────────┘     └─────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              │  pdflatex   │
                              │  pdftoppm   │
                              └─────────────┘
```

## Deployment

The project uses `output: "export"` for static HTML. Deploy as two services:

1. **Frontend** — Vercel, Netlify, or any static hosting. Set `NEXT_PUBLIC_LATEX_API_URL` to your API domain.
2. **API** — A server with PHP 8.1+ and TeX Live installed. Set `ALLOWED_ORIGIN` env var to your frontend domain for CORS.

```bash
# Build static frontend
npm run build
# Output in out/

# API server (production example with nginx/apache)
# Point to the api/ directory, ensure pdflatex is in PATH
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
api/
  generate.php      # AI CV generation endpoint (Gemini)
  edit.php           # AI edit endpoint (Gemini)
  latex-download.php # LaTeX → PDF compilation
  latex-preview.php  # LaTeX → PNG preview
  health.php         # Dependency health check
  cors.php           # Shared CORS configuration
  latex-config.php   # Binary path detection
  templates/         # .tex template files
```
