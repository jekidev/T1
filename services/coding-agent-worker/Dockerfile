FROM python:3.13-slim

ARG OPENHANDS_VERSION=1.36.0
ARG AIDER_VERSION=""

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CODING_AGENT_WORKER_ROOT=/work \
    CODING_AGENT_WORKER_PORT=8787 \
    CODING_AGENT_AIDER_COMMAND_JSON='["python","/app/providers/aider_runner.py","--workspace","{workspace}","--prompt-file","{prompt_file}"]' \
    CODING_AGENT_OPENHANDS_COMMAND_JSON='["python","/app/providers/openhands_runner.py","--workspace","{workspace}","--prompt-file","{prompt_file}"]'

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git openssh-client ripgrep tmux \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir \
      "openhands-sdk==${OPENHANDS_VERSION}" \
      "openhands-tools==${OPENHANDS_VERSION}" \
    && if [ -n "${AIDER_VERSION}" ]; then \
         python -m pip install --no-cache-dir "aider-chat==${AIDER_VERSION}"; \
       else \
         python -m pip install --no-cache-dir aider-chat; \
       fi

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin coding-agent \
    && mkdir -p /app/providers /work \
    && chown -R coding-agent:coding-agent /app /work

COPY --chown=coding-agent:coding-agent worker.py /app/worker.py
COPY --chown=coding-agent:coding-agent providers/ /app/providers/

USER coding-agent
WORKDIR /app
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import json,urllib.request; assert json.load(urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=3))['status']=='ok'"

CMD ["python", "/app/worker.py"]
