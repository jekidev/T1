# AI asset pipeline

## Status

The repository now contains a complete web/API orchestration layer for generated assets:

- typed job contracts in `@workspace/asset-pipeline`
- streamed image/video upload
- persistent job and artifact storage adapter
- ordered job state machine
- provider selection and fallback
- authenticated GPU-worker callbacks
- mandatory Blender processing stage
- metadata and publication validation
- preview/review UI in `/asset-lab`
- game asset manifest publication
- OpenTelemetry spans for upload, generation, artifact upload and publication

The neural models are deliberately not bundled into the frontend or API server. Actual model inference requires separately deployed workers.

## Architecture

```text
Web application
    ↓
Asset Generation API
    ↓
Persistent job queue
    ↓
GPU provider worker
    ↓
Blender headless worker
    ↓
Validation and publication gate
    ↓
Storage adapter
    ↓
Game asset manifest
```

## Pipeline stages

1. `queued`
2. `validating_input`
3. `preprocessing`
4. `generating`
5. `blender_processing`
6. `validating_output`
7. `awaiting_review`
8. `published`

Jobs may also enter `failed` or `cancelled`. Failed and cancelled jobs can be retried through the same job ID.

## Repository evaluation

| Repository | Integrated role | Runtime | Default |
|---|---|---|---|
| `Tencent-Hunyuan/Hunyuan3D-2` | Primary high-quality image-to-mesh and texture generation | GPU worker | Enabled when configured |
| `TencentARC/InstantMesh` | Fast image-to-mesh preview/fallback | GPU worker | Fallback |
| `Stability-AI/TripoSR` | Fast single-image reconstruction fallback | GPU worker | Fallback |
| `Tencent/FlashVDM` | Experimental accelerated reconstruction | GPU worker | Disabled pending benchmark |
| `makehumancommunity/mpfb2` | Primary reproducible Blender-based human generation | Blender worker | Primary human path |
| `makehumancommunity/makehuman` | Parametric human preset authoring and fallback | Offline/worker | Fallback |
| `YuliangXiu/ECON` | Special clothed-character reconstruction | GPU worker | Disabled by default |
| `yfeng95/DECA` | Unique face reconstruction for selected leaders | GPU worker | Disabled by default |
| `freemocap/freemocap` | Offline video motion capture | Offline/GPU worker | Primary offline mocap |
| `google-ai-edge/mediapipe` | Browser-worker realtime pose/face/hand tracking | Browser worker | Realtime tracking only |

The code license and model-weight license are separate concerns. The pipeline therefore defaults every uploaded or generated item to `licenseStatus: "unverified"`. Only a user-reviewed `verified` asset can enter the production manifest.

## Image to 3D

Default preference order:

```text
Hunyuan3D-2 → InstantMesh → TripoSR
```

A configured provider worker must:

1. download the source image from the token-protected callback URL
2. isolate/remove the background if requested
3. generate geometry
4. generate or bake textures
5. upload a preview and intermediate mesh
6. return generator version and preliminary metadata

The Blender worker then performs:

- scene cleanup
- scale/orientation normalization
- retopology or decimation
- UV validation/generation
- texture baking
- LOD generation
- glTF/GLB export
- glTF validation
- texture compression
- final preview rendering
- metadata report

No image-to-3D output is published directly from the generator worker.

## Human assets

Standard characters use:

```text
skeletonId = operation-kobenhavn-humanoid-v1
```

The default path is MPFB2 with deterministic presets and seeds. MakeHuman remains a preset-authoring and fallback source.

DECA and ECON are specialized steps only. Their output cannot be imported as a gameplay character until the Blender worker confirms:

- retopology
- common skeleton rigging
- skin weights
- deformation test
- animation test
- topology constraints
- LODs
- material budget

## Video to animation

Default preference order:

```text
FreeMoCap → MediaPipe fallback
```

The worker output must pass:

- temporal smoothing
- coordinate normalization
- foot-contact correction
- skeleton mapping
- retargeting
- clip boundary validation
- glTF animation export

MediaPipe in the browser is intended for realtime tracking and capture assistance. It is not used to create an authoritative character mesh.

## Asset metadata

Every publishable asset conforms to `GeneratedAssetMetadataSchema`:

```ts
interface GeneratedAssetMetadata {
  id: string
  sourceType: "image" | "video" | "text" | "procedural"
  sourceProvider?: string
  generator: string
  generatorVersion: string
  promptHash?: string
  seed?: number
  licenseStatus: "verified" | "unverified" | "restricted"
  assetType: "prop" | "building" | "character" | "animation"
  polygonCount: number
  textureMemoryBytes: number
  lodCount: number
  skeletonId?: string
  createdAt: string
}
```

## Publication gates

Automatic or manual publication is rejected when any of these conditions apply:

- license status is not verified
- glTF/animation artifact is missing
- preview artifact is missing
- validation report contains an error
- polygon budget is exceeded
- texture memory budget is exceeded
- required LOD count is missing
- character skeleton does not match the project skeleton
- animation skeleton/clip validation failed

## API

### Upload source

```http
POST /api/asset-generation/sources
Content-Type: image/png | image/jpeg | image/webp | video/mp4 | video/webm
X-File-Name: optional-name.png
```

### Create job

```http
POST /api/asset-generation/jobs
Content-Type: application/json
```

### Read and control jobs

```text
GET  /api/asset-generation/jobs
GET  /api/asset-generation/jobs/:id
POST /api/asset-generation/jobs/:id/cancel
POST /api/asset-generation/jobs/:id/retry
POST /api/asset-generation/jobs/:id/publish
GET  /api/asset-generation/jobs/:id/artifacts/:sha
GET  /api/asset-generation/manifest
```

### Worker callbacks

```text
GET /api/asset-generation/worker/sources/:sourceId
PUT /api/asset-generation/worker/jobs/:jobId/artifacts/:kind
```

Worker callback endpoints require `ASSET_WORKER_TOKEN` through either `Authorization: Bearer ...` or `X-Asset-Worker-Token`.

## Required environment

```bash
PUBLIC_BASE_URL=https://game.example.com
ASSET_WORKER_TOKEN=replace-with-at-least-24-random-characters
ASSET_PIPELINE_ROOT=/persistent/asset-pipeline
ASSET_BLENDER_WORKER_URL=https://blender-worker.example.com

ASSET_WORKER_HUNYUAN3D_2_URL=https://hunyuan-worker.example.com
ASSET_WORKER_INSTANTMESH_URL=https://instantmesh-worker.example.com
ASSET_WORKER_TRIPOSR_URL=https://triposr-worker.example.com
ASSET_WORKER_MPFB2_URL=https://human-worker.example.com
ASSET_WORKER_FREEMOCAP_URL=https://mocap-worker.example.com
```

A missing worker does not silently produce a fake asset. The job fails with a retryable provider error and remains visible in Asset Lab.

## Storage

`AssetStorage` is the current local persistent adapter. Its interface separates sources, jobs, artifacts and the published manifest so S3/R2/GCS can replace it later without changing job contracts.

Local development directories:

```text
data/asset-pipeline/
├── sources/
├── jobs/
├── artifacts/
└── published/manifest.json
```
