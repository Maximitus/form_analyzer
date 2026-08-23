import type { Keypoint2D } from '../../types/pose';
import { computeGolfFrontalMetrics } from './metrics';
import { inferGolfPhase } from './phase';
import type { GolfAddressBaseline, GolfFrontalMetrics, GolfHandedness, GolfPhase } from './types';

const ADDRESS_HOLD_FRAMES = 10;

export class GolfSession {
  private handedness: GolfHandedness;
  private address: GolfAddressBaseline | null = null;
  private addressHold = 0;
  private peakWristElevation = 0;
  private prevWristElevation: number | null = null;
  private phase: GolfPhase = 'unknown';

  constructor(handedness: GolfHandedness = 'right') {
    this.handedness = handedness;
  }

  setHandedness(handedness: GolfHandedness): void {
    if (handedness === this.handedness) return;
    this.handedness = handedness;
    this.reset();
  }

  reset(): void {
    this.address = null;
    this.addressHold = 0;
    this.peakWristElevation = 0;
    this.prevWristElevation = null;
    this.phase = 'unknown';
  }

  update(keypoints: readonly Keypoint2D[]): GolfFrontalMetrics {
    const snapshot = computeGolfFrontalMetrics(keypoints, this.handedness, this.phase, this.address);

    if (snapshot.wristElevation !== null && snapshot.wristElevation > this.peakWristElevation) {
      this.peakWristElevation = snapshot.wristElevation;
    }

    this.phase = inferGolfPhase({
      wristElevation: snapshot.wristElevation,
      hipSwayTowardLeadPct: snapshot.hipSwayTowardLeadPct,
      peakWristElevation: this.peakWristElevation,
      prevWristElevation: this.prevWristElevation,
      prevPhase: this.phase,
      hasAddress: this.address !== null,
    });
    this.prevWristElevation = snapshot.wristElevation;

    if (!this.address && this.looksLikeAddress(snapshot)) {
      this.addressHold += 1;
      if (this.addressHold >= ADDRESS_HOLD_FRAMES) {
        this.address = this.captureAddress(snapshot);
      }
    } else if (!this.address) {
      this.addressHold = 0;
    }

    return computeGolfFrontalMetrics(keypoints, this.handedness, this.phase, this.address);
  }

  private looksLikeAddress(metrics: GolfFrontalMetrics): boolean {
    if (metrics.wristElevation === null || metrics.wristElevation > 0.34) return false;
    if (metrics.landmarks.midAnkle === null || metrics.stanceWidthPx === null) return false;
    return true;
  }

  private captureAddress(metrics: GolfFrontalMetrics): GolfAddressBaseline {
    return {
      midAnkleX: metrics.landmarks.midAnkle?.x ?? 0,
      midHipX: metrics.landmarks.midHip?.x ?? metrics.landmarks.midAnkle?.x ?? 0,
      stanceWidthPx: metrics.stanceWidthPx ?? 1,
      shoulderTiltDeg: metrics.shoulderTiltDeg ?? 0,
      pelvicTiltDeg: metrics.pelvicTiltDeg ?? 0,
    };
  }
}
