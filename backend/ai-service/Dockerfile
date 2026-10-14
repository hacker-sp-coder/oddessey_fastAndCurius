ARG BASE_IMAGE=python:3.13-slim

# Base stage: System dependencies and FFmpeg
FROM ${BASE_IMAGE} AS base

WORKDIR /app

# Install FFmpeg for media audio extraction and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optimize layer caching: Copy dependency manifests before application code
COPY requirements.txt ./
COPY requirements-gpu.txt* ./

# CPU stage (default build target): installs lightweight CPU dependencies without torch or CUDA stack
FROM base AS cpu
ARG REQUIREMENTS_FILE=requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ${REQUIREMENTS_FILE}

# GPU stage (optional target for CUDA-accelerated container deployments)
FROM base AS gpu
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-gpu.txt

# Final runtime target defaults to CPU stage
FROM cpu AS final

# Copy application source code and test suite
COPY app ./app
COPY tests ./tests
COPY pytest.ini ./

# Ensure temporary storage directory exists
RUN mkdir -p /app/storage/temp /app/storage/models

ENV PYTHONUNBUFFERED=1
ENV AI_PORT=8000
ENV AI_HOST=0.0.0.0
ENV TEMP_STORAGE_DIR=/app/storage/temp
ENV FIXTURES_DIR=/app/fixtures
ENV TRANSCRIPTION_PROVIDER=faster-whisper
ENV EVALUATION_PROVIDER=groq
ENV WHISPER_DEVICE=cpu
ENV WHISPER_COMPUTE_TYPE=int8
ENV WHISPER_CPU_FALLBACK=true

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
