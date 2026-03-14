# ── Divido Chatbot — Backend Dockerfile ──────────────────────────────────────
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/
COPY data/ ./data/

EXPOSE 8000 8001