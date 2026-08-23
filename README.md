# Form Analyzer

Browser-based running and physical-therapy form analysis. Pose estimation runs
**on-device** with [ONNX Runtime Web](https://onnxruntime.ai/) and
[RTMPose](https://github.com/open-mmlab/mmpose/tree/main/projects/rtmpose)
(SimCC, 17 COCO keypoints). There is no BlazePose or MediaPipe dependency.

## Stack

- Vite + React + TypeScript
- `onnxruntime-web` with `executionProviders: ['webgpu', 'wasm']`
- Dedicated Web Worker (`src/workers/rtmpose.worker.ts`)
- Single-canvas compositing via `HTMLVideoElement.requestVideoFrameCallback()`
- 1€ (One-Euro) smoothing and 2D clinical joint angles

## Quick start

```bash
npm install
npm test
npm run dev
```

Then open the printed local URL, upload a video or start the camera, and pick
RTMPose-s (faster) or RTMPose-m (more accurate). Both target 256×192 SimCC
body models.

Production build:

```bash
npm run build
npm run preview
```

## Models

ONNX checkpoints are **not** committed. The worker first requests a same-origin
file under `public/models/`, then falls back to Hugging Face and caches the
download in Cache Storage.

| Variant   | Input   | Keypoints | Source |
|-----------|---------|-----------|--------|
| RTMPose-s | 192×256 | 17 COCO   | `https://huggingface.co/bukuroo/RTMPose-ONNX/resolve/main/rtmpose-s.onnx` |
| RTMPose-m | 192×256 | 17 COCO   | `https://huggingface.co/bukuroo/RTMPose-ONNX/resolve/main/rtmpose-m.onnx` |

Optional offline copy:

```bash
curl -L -o public/models/rtmpose-s.onnx \
  https://huggingface.co/bukuroo/RTMPose-ONNX/resolve/main/rtmpose-s.onnx
```

Override URLs with `VITE_RTMPOSE_MODEL_S` / `VITE_RTMPOSE_MODEL_M`.

## WASM binaries

`postinstall` copies `ort-wasm*.wasm` / `.mjs` from `node_modules/onnxruntime-web`
into `public/ort/`. Vite also copies them into `dist/ort` at build time via
`vite-plugin-static-copy`. The worker sets:

```ts
ort.env.wasm.wasmPaths = `${origin}${base}ort/`
```

Dev/preview servers send COOP + COEP (`credentialless`) so the WASM backend can
use `SharedArrayBuffer` when the browser allows it.

## Pipeline

1. **Main thread** (`PoseTracker`) listens to `requestVideoFrameCallback`.
2. Each frame is transferred as an `ImageBitmap` to the worker (backpressured
   to one in-flight inference).
3. The worker letterboxes to 192×256, ImageNet-normalizes RGB, and builds an
   NCHW `float32` tensor.
4. SimCC-X / SimCC-Y logits are decoded with argmax + local softmax for
   sub-pixel `(x, y)` and a confidence score, then mapped back to video pixels.
5. Results return as transferable `Float32Array` buffers.
6. The main thread applies a One-Euro filter, computes hip / knee / ankle /
   trunk angles (dot product, clamped to `[0°, 180°]`), and paints the matching
   video frame plus overlay onto **one** canvas (`ctx.drawImage` then skeleton).

## Golf module (face-on / frontal plane)

Camera in front of the player is the **frontal (coronal) plane** in PT —
specifically an **anterior** view. Golf coaches call the same setup **face-on**.

The golf module (`src/modules/golf/`) overlays a frontal midline, shoulder and
pelvic lines, and reports tilt, lateral trunk flexion, head/hip sway, knee
window, and a coarse swing-phase hint. Side-on analysis is sagittal (golf
*down-the-line* is closer to that) and is not this module.

Club head is **not** an RTMPose keypoint. In golf mode the worker runs a second
stage on the same frame: estimate shaft direction from lead→trail wrists, search
along that ray for a high-contrast distal blob, and fall back to a body-height
shaft prior when the head is lost (typical on a blurred downswing).

## Layout

```
src/
  components/PoseTracker.tsx   # rVFC loop, single-canvas compositing
  workers/rtmpose.worker.ts    # ORT session, SimCC decode, club-head search
  utils/clubHead.ts            # shaft prior + image search
  modules/golf/                # face-on frontal metrics and overlay
  utils/simcc.ts               # SimCC postprocess
  utils/oneEuroFilter.ts       # 1€ filter
  utils/kinematics.ts          # clinical 2D angles
  utils/preprocess.ts          # letterbox + NCHW normalize
  pose/rtmposeClient.ts        # worker bridge
```
