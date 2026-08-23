import { COCO_KEYPOINT_COUNT, COCO_KEYPOINT_NAMES, RTMPOSE_MODELS } from '../types/pose';
import type { Keypoint2D, PoseFrame, RtmposeVariant } from '../types/pose';
import type { WorkerInboundMessage, WorkerOutboundMessage } from './protocol';

export interface RtmposeClientOptions {
  variant?: RtmposeVariant;
  wasmPaths?: string;
  onReady?: (info: { executionProvider: string; inputWidth: number; inputHeight: number }) => void;
  onPose?: (pose: PoseFrame) => void;
  onError?: (message: string) => void;
}

function defaultWasmPaths(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  const origin = self.location?.origin ?? '';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${origin}${prefix}ort/`;
}

export class RtmposeClient {
  private worker: Worker | null = null;
  private busy = false;
  private frameId = 0;
  private readonly options: RtmposeClientOptions;

  constructor(options: RtmposeClientOptions = {}) {
    this.options = options;
  }

  get isBusy(): boolean {
    return this.busy;
  }

  async start(): Promise<void> {
    this.stop();
    const variant = this.options.variant ?? 's';
    const spec = RTMPOSE_MODELS[variant];
    const worker = new Worker(new URL('../workers/rtmpose.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker = worker;

    worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
      const message = event.data;
      if (message.type === 'pose') {
        this.busy = false;
        const keypoints: Keypoint2D[] = [];
        for (let i = 0; i < Math.min(COCO_KEYPOINT_COUNT, message.xs.length); i++) {
          keypoints.push({
            x: message.xs[i],
            y: message.ys[i],
            score: message.scores[i],
            name: COCO_KEYPOINT_NAMES[i],
          });
        }
        this.options.onPose?.({
          frameId: message.frameId,
          mediaTime: message.mediaTime,
          inferenceMs: message.inferenceMs,
          width: message.width,
          height: message.height,
          keypoints,
        });
        return;
      }
      if (message.type === 'ready') {
        this.options.onReady?.({
          executionProvider: message.executionProvider,
          inputWidth: message.inputWidth,
          inputHeight: message.inputHeight,
        });
        return;
      }
      if (message.type === 'error') {
        this.busy = false;
        this.options.onError?.(message.message);
      }
    };

    worker.onerror = (event) => {
      this.busy = false;
      this.options.onError?.(event.message || 'RTMPose worker crashed');
    };

    const envOverride =
      variant === 's'
        ? import.meta.env.VITE_RTMPOSE_MODEL_S
        : import.meta.env.VITE_RTMPOSE_MODEL_M;

    const init: Extract<WorkerInboundMessage, { type: 'init' }> = {
      type: 'init',
      modelUrl: envOverride || spec.localUrl,
      fallbackUrl: spec.remoteUrl,
      wasmPaths: this.options.wasmPaths ?? defaultWasmPaths(),
      inputWidth: spec.inputWidth,
      inputHeight: spec.inputHeight,
      simccSplitRatio: spec.simccSplitRatio,
    };
    worker.postMessage(init);
  }

  /**
   * Transfer an ImageBitmap frame to the worker. Returns false if the worker
   * is still inferring the previous frame (backpressure).
   */
  submitFrame(bitmap: ImageBitmap, mediaTime: number): boolean {
    if (!this.worker || this.busy) {
      bitmap.close();
      return false;
    }
    this.busy = true;
    const frameId = ++this.frameId;
    const message: Extract<WorkerInboundMessage, { type: 'frame' }> = {
      type: 'frame',
      frameId,
      mediaTime,
      bitmap,
    };
    this.worker.postMessage(message, [bitmap]);
    return true;
  }

  stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'dispose' } satisfies WorkerInboundMessage);
      this.worker.terminate();
      this.worker = null;
    }
    this.busy = false;
  }
}
