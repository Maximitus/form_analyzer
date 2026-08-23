import type { Keypoint2D } from '../../types/pose';

/** Golf coaching: face-on. PT/biomechanics: frontal (coronal) plane, anterior view. */
export const GOLF_VIEW_PLANE = 'frontal' as const;

export const GOLF_VIEW_LABEL = 'Face-on · frontal plane (anterior view)';

export type GolfHandedness = 'right' | 'left';

export type GolfPhase =
  | 'unknown'
  | 'address'
  | 'backswing'
  | 'top'
  | 'downswing'
  | 'impact'
  | 'follow-through';

export const GOLF_PHASE_LABEL: Record<GolfPhase, string> = {
  unknown: 'Unknown',
  address: 'Address',
  backswing: 'Backswing',
  top: 'Top',
  downswing: 'Downswing',
  impact: 'Impact',
  'follow-through': 'Follow-through',
};

export type GolfCueLevel = 'info' | 'watch' | 'flag';

export interface GolfCue {
  id: string;
  level: GolfCueLevel;
  title: string;
  detail: string;
}

export interface GolfAddressBaseline {
  midAnkleX: number;
  midHipX: number;
  stanceWidthPx: number;
  shoulderTiltDeg: number;
  pelvicTiltDeg: number;
}

export interface GolfFrontalMetrics {
  view: typeof GOLF_VIEW_PLANE;
  viewLabel: string;
  handedness: GolfHandedness;
  leadSide: 'left' | 'right';
  phase: GolfPhase;
  calibrated: boolean;
  shoulderTiltDeg: number | null;
  pelvicTiltDeg: number | null;
  lateralTrunkFlexionDeg: number | null;
  leadKneeDeg: number | null;
  trailKneeDeg: number | null;
  leadElbowDeg: number | null;
  trailElbowDeg: number | null;
  stanceWidthPx: number | null;
  shoulderWidthPx: number | null;
  stanceToShoulderRatio: number | null;
  kneeWindowRatio: number | null;
  /** % of stance width; positive is toward the lead side. */
  headSwayTowardLeadPct: number | null;
  hipSwayTowardLeadPct: number | null;
  wristElevation: number | null;
  landmarks: {
    midShoulder: Keypoint2D | null;
    midHip: Keypoint2D | null;
    midAnkle: Keypoint2D | null;
    midWrist: Keypoint2D | null;
    head: Keypoint2D | null;
  };
  cues: GolfCue[];
}
