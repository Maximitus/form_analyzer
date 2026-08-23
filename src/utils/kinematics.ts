import {
  COCO_INDEX,
  type ClinicalAngles,
  type Keypoint2D,
  type Point2D,
} from '../types/pose';

const ANGLE_MIN = 0;
const ANGLE_MAX = 180;

function isFinitePoint(p: Point2D | undefined | null): p is Point2D {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * Interior angle at `vertex` formed by points `a-vertex-c`, in degrees,
 * clamped to [0, 180]. Returns null when the triangle is degenerate.
 */
export function jointAngleDeg(
  a: Point2D | undefined | null,
  vertex: Point2D | undefined | null,
  c: Point2D | undefined | null,
): number | null {
  if (!isFinitePoint(a) || !isFinitePoint(vertex) || !isFinitePoint(c)) {
    return null;
  }

  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = c.x - vertex.x;
  const v2y = c.y - vertex.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 < 1e-6 || mag2 < 1e-6) {
    return null;
  }

  const cos = (v1x * v2x + v1y * v2y) / (mag1 * mag2);
  const clamped = Math.min(1, Math.max(-1, cos));
  const deg = (Math.acos(clamped) * 180) / Math.PI;
  return Math.min(ANGLE_MAX, Math.max(ANGLE_MIN, deg));
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function scored(
  keypoints: readonly Keypoint2D[],
  index: number,
  minScore: number,
): Keypoint2D | null {
  const kp = keypoints[index];
  if (!kp || kp.score < minScore) return null;
  return kp;
}

/**
 * Clinical 2D joint angles from COCO-17 keypoints.
 *
 * - Hip: shoulder–hip–knee
 * - Knee: hip–knee–ankle
 * - Ankle: knee–ankle–vertical-down (no foot keypoints in COCO-17)
 * - Trunk: mid-shoulder–mid-hip vs vertical down
 */
export function computeClinicalAngles(
  keypoints: readonly Keypoint2D[],
  minScore = 0.3,
): ClinicalAngles {
  const L = COCO_INDEX;

  const leftShoulder = scored(keypoints, L.leftShoulder, minScore);
  const rightShoulder = scored(keypoints, L.rightShoulder, minScore);
  const leftHip = scored(keypoints, L.leftHip, minScore);
  const rightHip = scored(keypoints, L.rightHip, minScore);
  const leftKnee = scored(keypoints, L.leftKnee, minScore);
  const rightKnee = scored(keypoints, L.rightKnee, minScore);
  const leftAnkle = scored(keypoints, L.leftAnkle, minScore);
  const rightAnkle = scored(keypoints, L.rightAnkle, minScore);

  const ankleVertical = (ankle: Keypoint2D): Point2D => ({
    x: ankle.x,
    y: ankle.y + 100,
  });

  let trunk: number | null = null;
  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    const midShoulder = midpoint(leftShoulder, rightShoulder);
    const midHip = midpoint(leftHip, rightHip);
    const vertical: Point2D = { x: midHip.x, y: midHip.y + 100 };
    const interior = jointAngleDeg(midShoulder, midHip, vertical);
    // 0° = upright (aligned with vertical); increases with flexion/lean.
    trunk = interior === null ? null : Math.min(180, Math.max(0, 180 - interior));
  }

  return {
    leftHip: jointAngleDeg(leftShoulder, leftHip, leftKnee),
    rightHip: jointAngleDeg(rightShoulder, rightHip, rightKnee),
    leftKnee: jointAngleDeg(leftHip, leftKnee, leftAnkle),
    rightKnee: jointAngleDeg(rightHip, rightKnee, rightAnkle),
    leftAnkle: leftAnkle
      ? jointAngleDeg(leftKnee, leftAnkle, ankleVertical(leftAnkle))
      : null,
    rightAnkle: rightAnkle
      ? jointAngleDeg(rightKnee, rightAnkle, ankleVertical(rightAnkle))
      : null,
    trunk,
  };
}

export function formatAngle(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(0)}°`;
}
