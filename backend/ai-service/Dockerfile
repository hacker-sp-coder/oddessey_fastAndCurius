FROM python:3.13-slim

WORKDIR /app

# Install FFmpeg for media extraction and curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and test suite
COPY app ./app
COPY tests ./tests
COPY pytest.ini ./

# Ensure temporary storage directory exists
RUN mkdir -p /app/storage/temp

ENV PYTHONUNBUFFERED=1
ENV AI_PORT=8000
ENV AI_HOST=0.0.0.0
ENV TEMP_STORAGE_DIR=/app/storage/temp
ENV FIXTURES_DIR=/app/fixtures
ENV TRANSCRIPTION_PROVIDER=fallback
ENV EVALUATION_PROVIDER=deterministic

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
