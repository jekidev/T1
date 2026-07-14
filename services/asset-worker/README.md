# Asset worker service

This service is the provider-neutral execution boundary for the AI asset pipeline.

It does **not** bundle Hunyuan3D, InstantMesh, TripoSR, FlashVDM, MPFB2, MakeHuman, DECA, ECON, FreeMoCap, MediaPipe or Blender. Build a dedicated image for each worker role, install only the required repository/model there, and configure a fixed administrator command.

The web frontend never imports model code or model weights.

## Security model

- Incoming requests require `Authorization: Bearer $ASSET_WORKER_TOKEN`.
- Source and artifact callbacks use the same shared worker token.
- User input cannot supply an executable command.
- Commands come only from administrator-controlled environment variables.
- Commands are parsed with `shlex` and executed with `shell=False`.
- Only explicit placeholders are substituted.
- Subprocesses receive a restricted environment without API/application secrets.
- Downloads are checksum-verified when a checksum is available.
- Temporary work directories are removed by default.

Deploy workers on a private network or behind authenticated ingress. Use a different token per environment.

## Endpoints

```text
GET  /health
POST /v1/generate   # model/provider workers
POST /v1/process    # Blender headless worker
```

## Install and run

```bash
cd services/asset-worker
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export ASSET_WORKER_TOKEN='replace-with-at-least-24-random-characters'
uvicorn worker:app --host 0.0.0.0 --port 8080
```

Container:

```bash
docker build -t operation-asset-worker services/asset-worker
docker run --rm -p 8080:8080 \
  -e ASSET_WORKER_TOKEN="$ASSET_WORKER_TOKEN" \
  operation-asset-worker
```

The base image is intentionally CPU/minimal. Provider-specific images should extend it with CUDA, PyTorch, Blender or repository dependencies as required.

## Fixed command configuration

Environment variable names are derived from the provider ID:

```text
hunyuan3d-2 → ASSET_COMMAND_HUNYUAN3D_2
instantmesh  → ASSET_COMMAND_INSTANTMESH
triposr      → ASSET_COMMAND_TRIPOSR
flashvdm     → ASSET_COMMAND_FLASHVDM
mpfb2        → ASSET_COMMAND_MPFB2
makehuman    → ASSET_COMMAND_MAKEHUMAN
deca         → ASSET_COMMAND_DECA
econ         → ASSET_COMMAND_ECON
freemocap    → ASSET_COMMAND_FREEMOCAP
mediapipe    → ASSET_COMMAND_MEDIAPIPE
Blender      → ASSET_COMMAND_BLENDER
```

Example wrapper configuration:

```bash
ASSET_WORKDIR_HUNYUAN3D_2=/opt/Hunyuan3D-2
ASSET_COMMAND_HUNYUAN3D_2='python /opt/worker-wrappers/hunyuan.py --input {input} --output-dir {output_dir} --seed {seed}'
ASSET_GENERATOR_VERSION_HUNYUAN3D_2='2.0'

ASSET_WORKDIR_BLENDER=/opt/blender-worker
ASSET_COMMAND_BLENDER='blender --background --python /opt/worker-wrappers/process_asset.py -- --input-dir {input_dir} --output-dir {output_dir} --target-polygons {target_polygon_count} --lod-count {lod_count} --skeleton {skeleton_id}'
ASSET_GENERATOR_VERSION_BLENDER='4.3'
```

The command is administrator configuration, not request data. Do not expose these environment variables through the API or frontend.

## Supported placeholders

```text
{input}                 source file or first downloaded artifact
{input_dir}             directory containing all source/intermediate files
{output_dir}            directory where recognized outputs must be written
{job_id}
{provider}
{operation}
{preset_id}
{skeleton_id}
{clip_name}
{target_polygon_count}
{lod_count}
{seed}
```

## Output convention

Provider wrappers write files into `{output_dir}`. The worker recognizes:

| Filename | Uploaded artifact kind |
|---|---|
| `preview.png`, `preview.jpg`, `preview.webp` | `preview` |
| `mesh.glb`, `mesh.gltf` | `mesh` |
| `final.glb`, `asset.glb`, `output.glb` | `glb` |
| `animation.glb`, `clip.glb` | `animation` |
| `texture.png`, `texture.jpg`, `texture.webp` | `texture` |
| `report.json` | `report` |
| `metadata.json` | parsed metadata, not directly published |

`metadata.json` may contain only these keys:

```json
{
  "id": "generated-asset-id",
  "polygonCount": 50000,
  "textureMemoryBytes": 33554432,
  "lodCount": 3,
  "skeletonId": "operation-kobenhavn-humanoid-v1",
  "promptHash": "optional-hash"
}
```

The API performs its own schema validation and publication checks. Worker metadata is never trusted without validation.

## Provider wrapper responsibilities

### Image-to-3D wrapper

1. load the downloaded image
2. isolate/remove background when requested
3. run the selected model
4. create a preview
5. export an intermediate mesh
6. emit metadata

### Blender wrapper

1. import intermediate artifacts from `{input_dir}`
2. normalize transforms and units
3. retopologize/decimate
4. validate or generate UVs
5. bake/pack textures
6. generate LODs
7. rig/retarget when character or animation
8. validate skin weights and deformation
9. export final GLB or animation GLB
10. create preview and report
11. emit final metadata

### Motion-capture wrapper

1. extract poses
2. smooth temporal noise
3. correct foot contact
4. map to the project skeleton
5. retarget and validate
6. export an animation clip

## Operational limits

```bash
ASSET_COMMAND_TIMEOUT_SECONDS=3600
ASSET_WORKER_MAX_DOWNLOAD_BYTES=1500000000
ASSET_WORKER_ROOT=/work
ASSET_KEEP_WORKDIR=false
```

Production workers should additionally use:

- non-root containers
- read-only base filesystem
- dedicated writable work volume
- GPU quotas
- CPU/RAM limits
- outbound network allowlists
- job-level timeouts
- container/image scanning
- model-weight license inventory
