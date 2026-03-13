FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2t64 && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir . && \
    playwright install chromium

RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

COPY . .

USER appuser
ENV PATH="/home/appuser/.local/bin:$PATH"

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
