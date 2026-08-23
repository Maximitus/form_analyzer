import { describe, expect, it } from 'vitest';
import { computeClinicalAngles, jointAngleDeg } from '../utils/kinematics';
import { COCO_KEYPOINT_NAMES } from '../types/pose';
import type { Keypoint2D } from '../types/pose';

describe('jointAngleDeg', () => {
  it('returns 90° for a right triangle', () => {
    const angle = jointAngleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(angle).toBeCloseTo(90, 5);
  });

  it('returns 180° for collinear opposite points', () => {
    const angle = jointAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(angle).toBeCloseTo(180, 5);
  });

  it('clamps to [0, 180] and returns null for a degenerate vertex', () => {
    expect(jointAngleDeg({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
});

function kp(index: number, x: number, y: number, score = 1): Keypoint2D {
  return { x, y, score, name: COCO_KEYPOINT_NAMES[index] };
}

describe('computeClinicalAngles', () => {
  it('computes hip, knee, ankle, and trunk from a stick figure', () => {
    const points: Keypoint2D[] = Array.from({ length: 17 }, (_, i) => kp(i, 0, 0, 0));
    // upright person, left side, 90° knee
    points[5] = kp(5, 10, 0); // L shoulder
    points[6] = kp(6, 30, 0); // R shoulder
    points[11] = kp(11, 10, 40); // L hip
    points[12] = kp(12, 30, 40); // R hip
    points[13] = kp(13, 10, 80); // L knee
    points[14] = kp(14, 30, 80); // R knee
    points[15] = kp(15, 50, 80); // L ankle (90° at knee)
    points[16] = kp(16, 70, 80); // R ankle

    const angles = computeClinicalAngles(points);
    expect(angles.leftKnee).toBeCloseTo(90, 4);
    expect(angles.rightKnee).toBeCloseTo(90, 4);
    expect(angles.leftHip).toBeCloseTo(180, 4);
    expect(angles.trunk).toBeCloseTo(0, 4);
    expect(angles.leftAnkle).not.toBeNull();
  });

  it('ignores low-confidence joints', () => {
    const points: Keypoint2D[] = Array.from({ length: 17 }, (_, i) => kp(i, i, i, 0.01));
    const angles = computeClinicalAngles(points);
    expect(angles.leftKnee).toBeNull();
    expect(angles.trunk).toBeNull();
  });
});
