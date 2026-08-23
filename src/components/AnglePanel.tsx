import type { ClinicalAngles } from '../types/pose';
import { formatAngle } from '../utils/kinematics';

interface AnglePanelProps {
  angles: ClinicalAngles | null;
}

const ROWS: Array<{ key: keyof ClinicalAngles; label: string }> = [
  { key: 'leftHip', label: 'Left hip' },
  { key: 'rightHip', label: 'Right hip' },
  { key: 'leftKnee', label: 'Left knee' },
  { key: 'rightKnee', label: 'Right knee' },
  { key: 'leftAnkle', label: 'Left ankle' },
  { key: 'rightAnkle', label: 'Right ankle' },
  { key: 'trunk', label: 'Trunk' },
];

export function AnglePanel({ angles }: AnglePanelProps) {
  return (
    <div className="info-panel">
      <h3>Clinical joint angles</h3>
      {!angles ? (
        <p className="muted">Waiting for RTMPose keypoints…</p>
      ) : (
        ROWS.map((row) => (
          <div className="measurement" key={row.key}>
            <strong>{row.label}</strong>
            <span>{formatAngle(angles[row.key])}</span>
          </div>
        ))
      )}
    </div>
  );
}
