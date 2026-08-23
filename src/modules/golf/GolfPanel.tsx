import { formatAngle, formatSignedAngle } from '../../utils/kinematics';
import { GOLF_PHASE_LABEL, GOLF_VIEW_LABEL } from './types';
import type { GolfFrontalMetrics } from './types';

interface GolfPanelProps {
  metrics: GolfFrontalMetrics | null;
}

const METRIC_ROWS: Array<{
  key: keyof GolfFrontalMetrics;
  label: string;
  format: (metrics: GolfFrontalMetrics) => string;
}> = [
  {
    key: 'shoulderTiltDeg',
    label: 'Shoulder tilt',
    format: (m) => `${formatSignedAngle(m.shoulderTiltDeg)}  (L high +)`,
  },
  {
    key: 'pelvicTiltDeg',
    label: 'Pelvic tilt',
    format: (m) => `${formatSignedAngle(m.pelvicTiltDeg)}  (L high +)`,
  },
  {
    key: 'lateralTrunkFlexionDeg',
    label: 'Lateral trunk flexion',
    format: (m) => `${formatSignedAngle(m.lateralTrunkFlexionDeg)}  (toward anatomical left +)`,
  },
  {
    key: 'headSwayTowardLeadPct',
    label: 'Head sway',
    format: (m) => (m.headSwayTowardLeadPct === null ? '—' : `${m.headSwayTowardLeadPct.toFixed(0)}% stance toward lead`),
  },
  {
    key: 'hipSwayTowardLeadPct',
    label: 'Hip sway',
    format: (m) => (m.hipSwayTowardLeadPct === null ? '—' : `${m.hipSwayTowardLeadPct.toFixed(0)}% stance toward lead`),
  },
  {
    key: 'leadKneeDeg',
    label: 'Lead knee',
    format: (m) => formatAngle(m.leadKneeDeg),
  },
  {
    key: 'trailKneeDeg',
    label: 'Trail knee',
    format: (m) => formatAngle(m.trailKneeDeg),
  },
  {
    key: 'leadElbowDeg',
    label: 'Lead elbow',
    format: (m) => formatAngle(m.leadElbowDeg),
  },
  {
    key: 'trailElbowDeg',
    label: 'Trail elbow',
    format: (m) => formatAngle(m.trailElbowDeg),
  },
  {
    key: 'stanceToShoulderRatio',
    label: 'Stance / shoulders',
    format: (m) => (m.stanceToShoulderRatio === null ? '—' : `${m.stanceToShoulderRatio.toFixed(2)}×`),
  },
  {
    key: 'kneeWindowRatio',
    label: 'Knee window',
    format: (m) => (m.kneeWindowRatio === null ? '—' : `${(m.kneeWindowRatio * 100).toFixed(0)}% of stance`),
  },
];

export function GolfPanel({ metrics }: GolfPanelProps) {
  return (
    <div className="info-panel">
      <h3>Golf · {GOLF_VIEW_LABEL}</h3>
      <p className="muted plane-note">
        Camera is in front of the player. In PT that is the <strong>frontal (coronal) plane</strong>,
        anterior view. Golf coaches usually say <strong>face-on</strong>. Side-on is sagittal;
        down-the-line is closer to that.
      </p>
      {!metrics ? (
        <p className="muted">Waiting for RTMPose keypoints…</p>
      ) : (
        <>
          <div className="measurement">
            <strong>Phase</strong>
            <span>
              {GOLF_PHASE_LABEL[metrics.phase]}
              {metrics.calibrated ? '' : ' · calibrating address'}
            </span>
          </div>
          <div className="measurement">
            <strong>Lead side</strong>
            <span>
              {metrics.leadSide} ({metrics.handedness}-handed)
            </span>
          </div>
          {METRIC_ROWS.map((row) => (
            <div className="measurement" key={row.key}>
              <strong>{row.label}</strong>
              <span>{row.format(metrics)}</span>
            </div>
          ))}
          <h3 className="cues-heading">Cues</h3>
          {metrics.cues.map((cue) => (
            <div className={`cue cue-${cue.level}`} key={cue.id}>
              <strong>{cue.title}</strong>
              <p>{cue.detail}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
