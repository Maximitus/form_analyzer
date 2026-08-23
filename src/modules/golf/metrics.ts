import { COCO_INDEX, type ClubHeadEstimate, type Keypoint2D } from '../../types/pose';
import {
  jointAngleDeg,
  leanFromVerticalDeg,
  midpoint,
  scoredKeypoint,
  tiltFromHorizontalDeg,
} from '../../utils/kinematics';
import type { GolfAddressBaseline, GolfFrontalMetrics, GolfHandedness, GolfPhase } from './types';
import { GOLF_VIEW_LABEL, GOLF_VIEW_PLANE } from './types';
import { buildGolfCues } from './cues';

const MIN_SCORE = 0.3;

export function leadSideFor(handedness: GolfHandedness): 'left' | 'right' {
  return handedness === 'right' ? 'left' : 'right';
}

function pair(
  keypoints: readonly Keypoint2D[],
  leftIndex: number,
  rightIndex: number,
): { left: Keypoint2D | null; right: Keypoint2D | null; mid: Keypoint2D | null } {
  const left = scoredKeypoint(keypoints, leftIndex, MIN_SCORE);
  const right = scoredKeypoint(keypoints, rightIndex, MIN_SCORE);
  if (!left || !right) {
    return { left, right, mid: null };
  }
  const midPt = midpoint(left, right);
  return {
    left,
    right,
    mid: {
      ...midPt,
      score: Math.min(left.score, right.score),
      name: left.name,
    },
  };
}

function towardLeadPct(
  pointX: number,
  originX: number,
  leadX: number,
  trailX: number,
  stanceWidth: number,
): number | null {
  if (stanceWidth < 1e-3) return null;
  const leadDir = Math.sign(leadX - trailX) || 1;
  return (((pointX - originX) * leadDir) / stanceWidth) * 100;
}

export function computeGolfFrontalMetrics(
  keypoints: readonly Keypoint2D[],
  handedness: GolfHandedness,
  phase: GolfPhase,
  address: GolfAddressBaseline | null,
  extras: {
    clubHead?: ClubHeadEstimate | null;
    clubHeadSpeedPxPerSec?: number | null;
  } = {},
): GolfFrontalMetrics {
  const L = COCO_INDEX;
  const leadSide = leadSideFor(handedness);

  const shoulders = pair(keypoints, L.leftShoulder, L.rightShoulder);
  const hips = pair(keypoints, L.leftHip, L.rightHip);
  const knees = pair(keypoints, L.leftKnee, L.rightKnee);
  const ankles = pair(keypoints, L.leftAnkle, L.rightAnkle);
  const wrists = pair(keypoints, L.leftWrist, L.rightWrist);
  const head = scoredKeypoint(keypoints, L.nose, MIN_SCORE);

  const leftElbow = scoredKeypoint(keypoints, L.leftElbow, MIN_SCORE);
  const rightElbow = scoredKeypoint(keypoints, L.rightElbow, MIN_SCORE);

  const stanceWidthPx =
    ankles.left && ankles.right ? Math.hypot(ankles.right.x - ankles.left.x, ankles.right.y - ankles.left.y) : null;
  const shoulderWidthPx =
    shoulders.left && shoulders.right
      ? Math.hypot(shoulders.right.x - shoulders.left.x, shoulders.right.y - shoulders.left.y)
      : null;
  const kneeWidthPx =
    knees.left && knees.right ? Math.hypot(knees.right.x - knees.left.x, knees.right.y - knees.left.y) : null;

  const originX = address?.midAnkleX ?? ankles.mid?.x ?? hips.mid?.x ?? null;
  const leadAnkle = leadSide === 'left' ? ankles.left : ankles.right;
  const trailAnkle = leadSide === 'left' ? ankles.right : ankles.left;
  const widthForSway = address?.stanceWidthPx ?? stanceWidthPx;

  const headSwayTowardLeadPct =
    head && originX !== null && leadAnkle && trailAnkle && widthForSway
      ? towardLeadPct(head.x, originX, leadAnkle.x, trailAnkle.x, widthForSway)
      : null;
  const hipSwayTowardLeadPct =
    hips.mid && originX !== null && leadAnkle && trailAnkle && widthForSway
      ? towardLeadPct(hips.mid.x, originX, leadAnkle.x, trailAnkle.x, widthForSway)
      : null;

  let wristElevation: number | null = null;
  if (wrists.mid && hips.mid && shoulders.mid) {
    const torso = Math.hypot(shoulders.mid.x - hips.mid.x, shoulders.mid.y - hips.mid.y);
    if (torso > 1e-3) {
      wristElevation = (hips.mid.y - wrists.mid.y) / torso;
    }
  }

  const leadKneeDeg =
    leadSide === 'left'
      ? jointAngleDeg(hips.left, knees.left, ankles.left)
      : jointAngleDeg(hips.right, knees.right, ankles.right);
  const trailKneeDeg =
    leadSide === 'left'
      ? jointAngleDeg(hips.right, knees.right, ankles.right)
      : jointAngleDeg(hips.left, knees.left, ankles.left);

  const leadElbowDeg =
    leadSide === 'left'
      ? jointAngleDeg(shoulders.left, leftElbow, wrists.left)
      : jointAngleDeg(shoulders.right, rightElbow, wrists.right);
  const trailElbowDeg =
    leadSide === 'left'
      ? jointAngleDeg(shoulders.right, rightElbow, wrists.right)
      : jointAngleDeg(shoulders.left, leftElbow, wrists.left);

  const clubHead = extras.clubHead ?? null;
  const clubHeadTowardLeadPct =
    clubHead && originX !== null && leadAnkle && trailAnkle && widthForSway
      ? towardLeadPct(clubHead.x, originX, leadAnkle.x, trailAnkle.x, widthForSway)
      : null;

  const metrics: GolfFrontalMetrics = {
    view: GOLF_VIEW_PLANE,
    viewLabel: GOLF_VIEW_LABEL,
    handedness,
    leadSide,
    phase,
    calibrated: address !== null,
    shoulderTiltDeg: tiltFromHorizontalDeg(shoulders.left, shoulders.right),
    pelvicTiltDeg: tiltFromHorizontalDeg(hips.left, hips.right),
    lateralTrunkFlexionDeg: leanFromVerticalDeg(shoulders.mid, hips.mid),
    leadKneeDeg,
    trailKneeDeg,
    leadElbowDeg,
    trailElbowDeg,
    stanceWidthPx,
    shoulderWidthPx,
    stanceToShoulderRatio:
      stanceWidthPx && shoulderWidthPx && shoulderWidthPx > 1e-3 ? stanceWidthPx / shoulderWidthPx : null,
    kneeWindowRatio: stanceWidthPx && kneeWidthPx !== null && stanceWidthPx > 1e-3 ? kneeWidthPx / stanceWidthPx : null,
    headSwayTowardLeadPct,
    hipSwayTowardLeadPct,
    wristElevation,
    clubHead,
    clubHeadTowardLeadPct,
    clubHeadSpeedPxPerSec: extras.clubHeadSpeedPxPerSec ?? null,
    landmarks: {
      midShoulder: shoulders.mid,
      midHip: hips.mid,
      midAnkle: ankles.mid,
      midWrist: wrists.mid,
      head,
    },
    cues: [],
  };

  metrics.cues = buildGolfCues(metrics, address);
  return metrics;
}
