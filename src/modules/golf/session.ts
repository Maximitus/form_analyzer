import type { ClubHeadEstimate, Keypoint2D } from '../../types/pose';
import { OneEuroFilter } from '../../utils/oneEuroFilter';
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
  private readonly clubX = new OneEuroFilter({ minCutoff: 1.2, beta: 0.4, dCutoff: 1 });
  private readonly clubY = new OneEuroFilter({ minCutoff: 1.2, beta: 0.4, dCutoff: 1 });
  private prevClub: { x: number; y: number; t: number } | null = null;

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
    this.clubX.reset();
    this.clubY.reset();
    this.prevClub = null;
  }

  update(
    keypoints: readonly Keypoint2D[],
    rawClub: ClubHeadEstimate | undefined,
    mediaTime: number,
  ): GolfFrontalMetrics {
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

    const { clubHead, speed } = this.smoothClub(rawClub, mediaTime);

    return computeGolfFrontalMetrics(keypoints, this.handedness, this.phase, this.address, {
      clubHead,
      clubHeadSpeedPxPerSec: speed,
    });
  }

  private smoothClub(
    rawClub: ClubHeadEstimate | undefined,
    mediaTime: number,
  ): { clubHead: ClubHeadEstimate | null; speed: number | null } {
    if (!rawClub || rawClub.score < 0.12) {
      return { clubHead: null, speed: null };
    }

    const t = mediaTime > 0 ? mediaTime : performance.now() / 1000;
    const x = this.clubX.filter(rawClub.x, t);
    const y = this.clubY.filter(rawClub.y, t);
    let speed: number | null = null;
    if (this.prevClub) {
      const dt = t - this.prevClub.t;
      if (dt > 1e-3) {
        speed = Math.hypot(x - this.prevClub.x, y - this.prevClub.y) / dt;
      }
    }
    this.prevClub = { x, y, t };
    return {
      clubHead: { ...rawClub, x, y },
      speed,
    };
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
