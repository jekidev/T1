from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import mimetypes
import os
import shlex
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, AsyncIterator, Literal
from urllib.parse import quote

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

app = FastAPI(title="Operation København Asset Worker", version="1.0.0")


class SourceReference(BaseModel):
    id: str = Field(min_length=1, max_length=180)
    downloadUrl: HttpUrl


class InputArtifact(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    mimeType: str = Field(min_length=1, max_length=160)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    downloadUrl: HttpUrl


class WorkerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[1]
    job: dict[str, Any]
    role: str = Field(min_length=1, max_length=80)
    generator: str | None = Field(default=None, max_length=80)
    source: SourceReference | None = None
    inputs: list[InputArtifact] = Field(default_factory=list, max_length=100)
    artifactUploadBaseUrl: HttpUrl
    artifactUploadHeader: str = Field(default="x-asset-worker-token", min_length=1, max_length=80)


class WorkerResponse(BaseModel):
    generatorVersion: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class CommandResult(BaseModel):
    return_code: int
    stdout: str
    stderr: str


def worker_token() -> str:
    value = os.getenv("ASSET_WORKER_TOKEN", "")
    if len(value) < 24:
        raise HTTPException(status_code=503, detail="ASSET_WORKER_TOKEN must contain at least 24 characters.")
    return value


async def require_worker_auth(authorization: str | None = Header(default=None)) -> None:
    expected = worker_token()
    supplied = ""
    if authorization:
        prefix, _, value = authorization.partition(" ")
        if prefix.lower() == "bearer":
            supplied = value.strip()
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid worker credential.")


@app.get("/health")
async def health() -> dict[str, Any]:
    configured = sorted(
        key.removeprefix("ASSET_COMMAND_").lower()
        for key, value in os.environ.items()
        if key.startswith("ASSET_COMMAND_") and value.strip()
    )
    return {"status": "ok", "configuredCommands": configured}


@app.post("/v1/generate", response_model=WorkerResponse)
async def generate(
    request: WorkerRequest,
    _: None = Depends(require_worker_auth),
) -> WorkerResponse:
    if request.role == "blender":
        raise HTTPException(status_code=400, detail="The generate endpoint cannot run the Blender role.")
    return await execute_pipeline_step(request, operation="generate")


@app.post("/v1/process", response_model=WorkerResponse)
async def process(
    request: WorkerRequest,
    _: None = Depends(require_worker_auth),
) -> WorkerResponse:
    if request.role != "blender":
        raise HTTPException(status_code=400, detail="The process endpoint is reserved for the Blender role.")
    return await execute_pipeline_step(request, operation="process")


async def execute_pipeline_step(request: WorkerRequest, operation: str) -> WorkerResponse:
    job_id = safe_segment(str(request.job.get("id", "unknown-job")))
    provider = safe_segment(request.role if request.role == "blender" else request.generator or request.role)
    command_template = command_for(provider)
    timeout_seconds = positive_int("ASSET_COMMAND_TIMEOUT_SECONDS", 3600, minimum=10, maximum=86_400)

    work_root = Path(os.getenv("ASSET_WORKER_ROOT", "./work")).resolve()
    work_root.mkdir(parents=True, exist_ok=True)
    job_root = Path(tempfile.mkdtemp(prefix=f"{job_id}-", dir=work_root))
    input_dir = job_root / "inputs"
    output_dir = job_root / "output"
    input_dir.mkdir()
    output_dir.mkdir()

    try:
        source_path = await download_source(request.source, input_dir) if request.source else None
        artifact_paths = await download_artifacts(effective_inputs(request), input_dir)
        primary_input = source_path or (artifact_paths[0] if artifact_paths else None)
        argv = render_command(
            command_template,
            build_placeholders(request, job_id, provider, operation, primary_input, input_dir, output_dir),
        )
        result = await asyncio.to_thread(run_command, argv, command_workdir(provider), timeout_seconds)
        notes = command_notes(result)
        if result.return_code != 0:
            raise HTTPException(
                status_code=502,
                detail={
                    "code": "provider.command_failed",
                    "provider": provider,
                    "returnCode": result.return_code,
                    "stderr": result.stderr[-4_000:],
                },
            )

        metadata = read_metadata(output_dir / "metadata.json")
        uploaded = await upload_outputs(request, output_dir)
        if not uploaded:
            raise HTTPException(status_code=502, detail="Provider completed but produced no recognized output artifacts.")
        notes.append(f"Uploaded {len(uploaded)} artifact(s): {', '.join(uploaded)}")
        return WorkerResponse(generatorVersion=generator_version(provider), metadata=metadata, notes=notes)
    finally:
        if os.getenv("ASSET_KEEP_WORKDIR", "false").lower() not in {"1", "true", "yes"}:
            shutil.rmtree(job_root, ignore_errors=True)


def effective_inputs(request: WorkerRequest) -> list[InputArtifact]:
    if request.inputs:
        return request.inputs
    artifacts = request.job.get("artifacts")
    if not isinstance(artifacts, list):
        return []

    download_base = str(request.artifactUploadBaseUrl).rstrip("/")
    inputs: list[InputArtifact] = []
    for artifact in artifacts[:100]:
        if not isinstance(artifact, dict):
            continue
        kind = artifact.get("kind")
        mime_type = artifact.get("mimeType")
        sha256 = artifact.get("sha256")
        if not isinstance(kind, str) or not isinstance(mime_type, str) or not isinstance(sha256, str):
            continue
        try:
            inputs.append(InputArtifact(
                kind=kind,
                mimeType=mime_type,
                sha256=sha256,
                downloadUrl=f"{download_base}/{quote(sha256, safe='')}",
            ))
        except ValueError:
            continue
    return inputs


async def download_source(source: SourceReference, input_dir: Path) -> Path:
    extension = suffix_from_url(str(source.downloadUrl)) or ".bin"
    destination = input_dir / f"source-{safe_segment(source.id)}{extension}"
    await download_file(str(source.downloadUrl), destination, expected_sha256=None)
    return destination


async def download_artifacts(inputs: list[InputArtifact], input_dir: Path) -> list[Path]:
    paths: list[Path] = []
    for index, artifact in enumerate(inputs):
        extension = mimetypes.guess_extension(artifact.mimeType) or suffix_from_url(str(artifact.downloadUrl)) or ".bin"
        destination = input_dir / f"artifact-{index:03d}-{safe_segment(artifact.kind)}{extension}"
        await download_file(str(artifact.downloadUrl), destination, expected_sha256=artifact.sha256)
        paths.append(destination)
    return paths


async def download_file(url: str, destination: Path, expected_sha256: str | None) -> None:
    headers = {"Authorization": f"Bearer {worker_token()}"}
    timeout = httpx.Timeout(connect=30, read=600, write=60, pool=30)
    maximum_bytes = positive_int("ASSET_WORKER_MAX_DOWNLOAD_BYTES", 1_500_000_000, minimum=1_000_000)
    digest = hashlib.sha256()
    byte_count = 0

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        async with client.stream("GET", url, headers=headers) as response:
            response.raise_for_status()
            with destination.open("wb") as handle:
                async for chunk in response.aiter_bytes():
                    byte_count += len(chunk)
                    if byte_count > maximum_bytes:
                        raise HTTPException(status_code=413, detail="Worker input exceeds download limit.")
                    digest.update(chunk)
                    handle.write(chunk)

    if expected_sha256 and not hmac.compare_digest(digest.hexdigest(), expected_sha256):
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Downloaded artifact checksum mismatch.")


async def upload_outputs(request: WorkerRequest, output_dir: Path) -> list[str]:
    conventions: list[tuple[str, str]] = [
        ("preview.png", "preview"),
        ("preview.jpg", "preview"),
        ("preview.jpeg", "preview"),
        ("preview.webp", "preview"),
        ("mesh.glb", "mesh"),
        ("mesh.gltf", "mesh"),
        ("final.glb", "glb"),
        ("asset.glb", "glb"),
        ("output.glb", "glb"),
        ("animation.glb", "animation"),
        ("clip.glb", "animation"),
        ("texture.png", "texture"),
        ("texture.jpg", "texture"),
        ("texture.webp", "texture"),
        ("report.json", "report"),
    ]
    uploaded: list[str] = []
    seen_kinds: set[str] = set()
    for filename, kind in conventions:
        path = output_dir / filename
        if not path.is_file() or kind in seen_kinds:
            continue
        await upload_artifact(request, path, kind)
        uploaded.append(f"{kind}:{filename}")
        seen_kinds.add(kind)
    return uploaded


async def upload_artifact(request: WorkerRequest, path: Path, kind: str) -> None:
    upload_url = f"{str(request.artifactUploadBaseUrl).rstrip('/')}/{quote(kind, safe='')}"
    headers = {
        request.artifactUploadHeader: worker_token(),
        "Content-Type": "application/octet-stream",
        "X-Artifact-Mime-Type": mime_for_path(path),
        "X-Artifact-SHA256": sha256_file(path),
    }
    timeout = httpx.Timeout(connect=30, read=600, write=600, pool=30)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        response = await client.put(upload_url, headers=headers, content=stream_file(path))
        response.raise_for_status()


async def stream_file(path: Path) -> AsyncIterator[bytes]:
    handle = path.open("rb")
    try:
        while True:
            chunk = await asyncio.to_thread(handle.read, 1024 * 1024)
            if not chunk:
                break
            yield chunk
    finally:
        handle.close()


def build_placeholders(
    request: WorkerRequest,
    job_id: str,
    provider: str,
    operation: str,
    source_path: Path | None,
    input_dir: Path,
    output_dir: Path,
) -> dict[str, str]:
    job_request = request.job.get("request") if isinstance(request.job.get("request"), dict) else {}
    assert isinstance(job_request, dict)
    return {
        "input": str(source_path or ""),
        "input_dir": str(input_dir),
        "output_dir": str(output_dir),
        "job_id": job_id,
        "provider": provider,
        "operation": operation,
        "preset_id": string_value(job_request.get("presetId")),
        "skeleton_id": string_value(job_request.get("skeletonId")),
        "clip_name": string_value(job_request.get("clipName")),
        "target_polygon_count": string_value(job_request.get("targetPolygonCount")),
        "lod_count": string_value(job_request.get("lodCount")),
        "seed": string_value(job_request.get("seed")),
    }


def render_command(template: str, placeholders: dict[str, str]) -> list[str]:
    try:
        tokens = shlex.split(template, posix=True)
    except ValueError as error:
        raise HTTPException(status_code=500, detail=f"Invalid administrator command template: {error}") from error
    if not tokens:
        raise HTTPException(status_code=503, detail="Provider command is not configured.")
    try:
        return [token.format_map(placeholders) for token in tokens]
    except KeyError as error:
        raise HTTPException(status_code=500, detail=f"Unknown command placeholder: {error.args[0]}") from error


def run_command(argv: list[str], cwd: Path, timeout_seconds: int) -> CommandResult:
    completed = subprocess.run(
        argv,
        cwd=cwd,
        env=safe_subprocess_environment(),
        capture_output=True,
        text=True,
        timeout=timeout_seconds,
        check=False,
        shell=False,
    )
    return CommandResult(
        return_code=completed.returncode,
        stdout=completed.stdout[-20_000:],
        stderr=completed.stderr[-20_000:],
    )


def command_for(provider: str) -> str:
    key = provider_env_key("ASSET_COMMAND", provider)
    value = os.getenv(key, "").strip()
    if not value:
        raise HTTPException(status_code=503, detail=f"Administrator command {key} is not configured.")
    return value


def command_workdir(provider: str) -> Path:
    key = provider_env_key("ASSET_WORKDIR", provider)
    directory = Path(os.getenv(key, ".")).resolve()
    if not directory.is_dir():
        raise HTTPException(status_code=503, detail=f"Configured work directory does not exist: {directory}")
    return directory


def generator_version(provider: str) -> str:
    return os.getenv(provider_env_key("ASSET_GENERATOR_VERSION", provider), "unknown").strip()[:80] or "unknown"


def provider_env_key(prefix: str, provider: str) -> str:
    return f"{prefix}_{provider.upper().replace('-', '_').replace('.', '_')}"


def read_metadata(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail=f"Invalid metadata.json: {error}") from error
    if not isinstance(value, dict):
        raise HTTPException(status_code=502, detail="metadata.json must contain an object.")
    allowed = {"id", "polygonCount", "textureMemoryBytes", "lodCount", "skeletonId", "promptHash"}
    return {key: value[key] for key in allowed if key in value}


def safe_subprocess_environment() -> dict[str, str]:
    allowed_prefixes = (
        "PATH",
        "PYTHONPATH",
        "CUDA_",
        "NVIDIA_",
        "HF_",
        "HUGGINGFACE_",
        "TORCH_",
        "OMP_",
        "MKL_",
        "BLENDER_",
    )
    environment = {key: value for key, value in os.environ.items() if key.startswith(allowed_prefixes)}
    environment["PYTHONUNBUFFERED"] = "1"
    return environment


def command_notes(result: CommandResult) -> list[str]:
    notes: list[str] = []
    if result.stdout.strip():
        notes.append(f"stdout: {redact(result.stdout.strip())[-2_000:]}")
    if result.stderr.strip():
        notes.append(f"stderr: {redact(result.stderr.strip())[-2_000:]}")
    return notes


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def mime_for_path(path: Path) -> str:
    if path.suffix.lower() == ".glb":
        return "model/gltf-binary"
    if path.suffix.lower() == ".gltf":
        return "model/gltf+json"
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def suffix_from_url(value: str) -> str:
    suffix = Path(value.split("?", 1)[0]).suffix.lower()
    return suffix if len(suffix) <= 10 else ""


def safe_segment(value: str) -> str:
    safe = "".join(character if character.isalnum() or character in "._-" else "-" for character in value)[:160]
    if not safe or safe in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid identifier.")
    return safe


def positive_int(name: str, fallback: int, minimum: int = 1, maximum: int = 2_147_483_647) -> int:
    try:
        value = int(os.getenv(name, str(fallback)))
    except ValueError:
        return fallback
    return value if minimum <= value <= maximum else fallback


def string_value(value: Any) -> str:
    return "" if value is None else str(value)


def redact(value: str) -> str:
    token = os.getenv("ASSET_WORKER_TOKEN", "")
    return value.replace(token, "[REDACTED]") if token else value
