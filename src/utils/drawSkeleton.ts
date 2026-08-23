import type { ClinicalAngles, Keypoint2D } from '../types/pose';
import { COCO_INDEX, COCO_SKELETON } from '../types/pose';

const LEFT = new Set<number>([
  COCO_INDEX.leftEye,
  COCO_INDEX.leftEar,
  COCO_INDEX.leftShoulder,
  COCO_INDEX.leftElbow,
  COCO_INDEX.leftWrist,
  COCO_INDEX.leftHip,
  COCO_INDEX.leftKnee,
  COCO_INDEX.leftAnkle,
]);

const RIGHT = new Set<number>([
  COCO_INDEX.rightEye,
  COCO_INDEX.rightEar,
  COCO_INDEX.rightShoulder,
  COCO_INDEX.rightElbow,
  COCO_INDEX.rightWrist,
  COCO_INDEX.rightHip,
  COCO_INDEX.rightKnee,
  COCO_INDEX.rightAnkle,
]);

function sideColor(i: number, j: number): string {
  if (LEFT.has(i) && LEFT.has(j)) return '#4ade80';
  if (RIGHT.has(i) && RIGHT.has(j)) return '#fb923c';
  return '#67e8f9';
}

function keypointColor(index: number): string {
  if (LEFT.has(index)) return '#4ade80';
  if (RIGHT.has(index)) return '#fb923c';
  return '#67e8f9';
}

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: readonly Keypoint2D[],
  minScore = 0.3,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = 4;

  for (const [i, j] of COCO_SKELETON) {
    const a = keypoints[i];
    const b = keypoints[j];
    if (!a || !b || a.score < minScore || b.score < minScore) continue;
    ctx.strokeStyle = sideColor(i, j);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (let i = 0; i < keypoints.length; i++) {
    const kp = keypoints[i];
    if (!kp || kp.score < minScore) continue;
    ctx.fillStyle = keypointColor(i);
    ctx.beginPath();
    ctx.arc(kp.x, kp.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    ctx.stroke();
  }

  ctx.restore();
}

interface AngleLabel {
  text: string;
  at: Keypoint2D | undefined;
}

export function drawJointAngleLabels(
  ctx: CanvasRenderingContext2D,
  keypoints: readonly Keypoint2D[],
  angles: ClinicalAngles,
  minScore = 0.3,
): void {
  const L = COCO_INDEX;
  const labels: AngleLabel[] = [
    { text: angles.leftKnee !== null ? `L knee ${angles.leftKnee.toFixed(0)}°` : '', at: keypoints[L.leftKnee] },
    { text: angles.rightKnee !== null ? `R knee ${angles.rightKnee.toFixed(0)}°` : '', at: keypoints[L.rightKnee] },
    { text: angles.leftHip !== null ? `L hip ${angles.leftHip.toFixed(0)}°` : '', at: keypoints[L.leftHip] },
    { text: angles.rightHip !== null ? `R hip ${angles.rightHip.toFixed(0)}°` : '', at: keypoints[L.rightHip] },
    { text: angles.leftAnkle !== null ? `L ank ${angles.leftAnkle.toFixed(0)}°` : '', at: keypoints[L.leftAnkle] },
    { text: angles.rightAnkle !== null ? `R ank ${angles.rightAnkle.toFixed(0)}°` : '', at: keypoints[L.rightAnkle] },
  ];

  if (angles.trunk !== null) {
    const midHip =
      keypoints[L.leftHip] && keypoints[L.rightHip]
        ? {
            x: (keypoints[L.leftHip].x + keypoints[L.rightHip].x) / 2,
            y: (keypoints[L.leftHip].y + keypoints[L.rightHip].y) / 2,
            score: Math.min(keypoints[L.leftHip].score, keypoints[L.rightHip].score),
            name: keypoints[L.leftHip].name,
          }
        : undefined;
    labels.push({ text: `Trunk ${angles.trunk.toFixed(0)}°`, at: midHip });
  }

  ctx.save();
  ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  for (const label of labels) {
    if (!label.text || !label.at || label.at.score < minScore) continue;
    const x = label.at.x + 10;
    const y = label.at.y - 12;
    const width = ctx.measureText(label.text).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(x - 6, y - 11, width + 12, 22);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label.text, x, y);
  }

  ctx.restore();
}
