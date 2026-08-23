import { describe, expect, it } from 'vitest';
import { COCO_KEYPOINT_NAMES } from '../../types/pose';
import type { Keypoint2D } from '../../types/pose';
import { computeGolfFrontalMetrics } from './metrics';
import { inferGolfPhase } from './phase';

function kp(index: number, x: number, y: number, score = 1): Keypoint2D {
  return { x, y, score, name: COCO_KEYPOINT_NAMES[index] };
}

/** Face-on stick figure: anatomical left is on the image right. */
function faceOnAddress(): Keypoint2D[] {
  const points: Keypoint2D[] = Array.from({ length: 17 }, (_, i) => kp(i, 0, 0, 0));
  points[0] = kp(0, 50, 8); // nose
  points[5] = kp(5, 70, 20); // L shoulder (image right)
  points[6] = kp(6, 30, 24); // R shoulder slightly lower
  points[7] = kp(7, 74, 48); // L elbow
  points[8] = kp(8, 26, 48); // R elbow
  points[9] = kp(9, 72, 78); // L wrist
  points[10] = kp(10, 28, 78); // R wrist
  points[11] = kp(11, 64, 70); // L hip
  points[12] = kp(12, 36, 70); // R hip
  points[13] = kp(13, 66, 110); // L knee
  points[14] = kp(14, 34, 110); // R knee
  points[15] = kp(15, 68, 150); // L ankle
  points[16] = kp(16, 32, 150); // R ankle
  return points;
}

describe('computeGolfFrontalMetrics', () => {
  it('treats the left side as lead for a right-handed golfer', () => {
    const metrics = computeGolfFrontalMetrics(faceOnAddress(), 'right', 'address', null);
    expect(metrics.view).toBe('frontal');
    expect(metrics.leadSide).toBe('left');
    expect(metrics.shoulderTiltDeg).toBeGreaterThan(0);
    expect(metrics.pelvicTiltDeg).toBeCloseTo(0, 4);
    expect(metrics.lateralTrunkFlexionDeg).toBeCloseTo(0, 4);
    expect(metrics.stanceToShoulderRatio).toBeGreaterThan(0.5);
    expect(metrics.headSwayTowardLeadPct).not.toBeNull();
    expect(Math.abs(metrics.headSwayTowardLeadPct ?? 99)).toBeLessThan(15);
  });

  it('flips lead/trail mapping for a left-handed golfer', () => {
    const rightHanded = computeGolfFrontalMetrics(faceOnAddress(), 'right', 'address', null);
    const leftHanded = computeGolfFrontalMetrics(faceOnAddress(), 'left', 'address', null);
    expect(leftHanded.leadSide).toBe('right');
    expect(leftHanded.leadKneeDeg).toBe(rightHanded.trailKneeDeg);
    expect(leftHanded.trailKneeDeg).toBe(rightHanded.leadKneeDeg);
  });
});

describe('inferGolfPhase', () => {
  it('calls a low wrist position address', () => {
    expect(
      inferGolfPhase({
        wristElevation: 0.2,
        hipSwayTowardLeadPct: 0,
        peakWristElevation: 0.2,
        prevWristElevation: 0.18,
        prevPhase: 'unknown',
        hasAddress: false,
      }),
    ).toBe('address');
  });

  it('calls a high wrist position top, then falling as downswing', () => {
    expect(
      inferGolfPhase({
        wristElevation: 1.2,
        hipSwayTowardLeadPct: -8,
        peakWristElevation: 1.2,
        prevWristElevation: 1.1,
        prevPhase: 'backswing',
        hasAddress: true,
      }),
    ).toBe('top');

    expect(
      inferGolfPhase({
        wristElevation: 0.7,
        hipSwayTowardLeadPct: 0,
        peakWristElevation: 1.2,
        prevWristElevation: 1.15,
        prevPhase: 'top',
        hasAddress: true,
      }),
    ).toBe('downswing');
  });
});
