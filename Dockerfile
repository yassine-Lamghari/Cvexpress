# -- Étape 1 : Construction (Builder) --
FROM node:20-bullseye AS builder

WORKDIR /app

# Copier les fichiers de dépendances et installer
COPY package.json package-lock.json* ./
RUN npm ci

# Copier tout le code source
COPY . .

# Désactiver la télémétrie Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# Variables d'environnement requises pour le build Next.js (NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Construire l'application (standalone)
RUN npm run build

# -- Étape 2 : Production (Runner) --
FROM node:20-bullseye-slim AS runner

WORKDIR /app

# Installer les dépendances système pour votre projet (LaTeX, poppler, ImageMagick)
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    poppler-utils \
    imagemagick \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Configurer les chemins des binaires (utilisés dans src/lib/latex-compiler.ts)
ENV PDFLATEX_BIN=pdflatex
ENV PDFTOPPM_BIN=pdftoppm
ENV MAGICK_BIN=magick

# Créer le répertoire temporaire pour la compilation LaTeX et lui donner les droits d'écriture
RUN mkdir -p .latex_tmp && chmod 777 .latex_tmp

# Copier les fichiers générés par l'étape de build
# Next.js "standalone" génère un serveur minimaliste contenant uniquement le nécessaire
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Lancer l'application avec le serveur Node basique (sans commande 'next start' car on est en standalone)
CMD ["node", "server.js"]