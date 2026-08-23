import type { GolfAddressBaseline, GolfCue, GolfFrontalMetrics } from './types';

function abs(n: number | null): number | null {
  return n === null ? null : Math.abs(n);
}

export function buildGolfCues(
  metrics: GolfFrontalMetrics,
  address: GolfAddressBaseline | null,
): GolfCue[] {
  const cues: GolfCue[] = [];
  const leadName = metrics.leadSide === 'left' ? 'left (lead)' : 'right (lead)';
  const trailName = metrics.leadSide === 'left' ? 'right (trail)' : 'left (trail)';

  if (!address) {
    cues.push({
      id: 'calibrate',
      level: 'info',
      title: 'Hold address',
      detail:
        'Stand face-on (frontal plane) at setup. Address calibrates after a short pause with the club down so sway is measured from your midline.',
    });
  }

  const head = abs(metrics.headSwayTowardLeadPct);
  if (head !== null && metrics.phase === 'address') {
    if (head > 25) {
      cues.push({
        id: 'head-sway-flag',
        level: 'flag',
        title: 'Head sway',
        detail: `Head is ${head.toFixed(0)}% of stance width off the frontal midline. Keep the cranium quieter over mid-stance.`,
      });
    } else if (head > 12) {
      cues.push({
        id: 'head-sway-watch',
        level: 'watch',
        title: 'Head drifting',
        detail: `Head offset ${head.toFixed(0)}% of stance. A little motion is normal; large lateral shift usually rides the pelvis.`,
      });
    }
  }

  const hip = abs(metrics.hipSwayTowardLeadPct);
  if (hip !== null && metrics.phase === 'address' && hip > 14) {
    cues.push({
      id: 'hip-sway-address',
      level: 'watch',
      title: 'Pelvis off midline',
      detail: `Hips are ${hip.toFixed(0)}% of stance from the ankle midline. In the frontal plane this looks like a slide rather than a turn.`,
    });
  }

  if (
    metrics.shoulderTiltDeg !== null &&
    metrics.pelvicTiltDeg !== null &&
    Math.sign(metrics.shoulderTiltDeg) !== 0 &&
    Math.sign(metrics.pelvicTiltDeg) !== 0 &&
    Math.sign(metrics.shoulderTiltDeg) !== Math.sign(metrics.pelvicTiltDeg) &&
    Math.abs(metrics.shoulderTiltDeg) > 10 &&
    Math.abs(metrics.pelvicTiltDeg) > 8
  ) {
    cues.push({
      id: 'girdle-opposition',
      level: 'watch',
      title: 'Opposite girdle tilt',
      detail:
        'Shoulder and pelvic lines tilt opposite ways. In frontal-plane golf that often shows up as a reverse-K or stacked-the-wrong-way setup.',
    });
  }

  if (metrics.kneeWindowRatio !== null && metrics.kneeWindowRatio < 0.42) {
    cues.push({
      id: 'knee-window',
      level: 'watch',
      title: 'Narrow knee window',
      detail: `Knees are only ${(metrics.kneeWindowRatio * 100).toFixed(0)}% of stance width — possible valgus / trail-knee cave in the frontal view.`,
    });
  }

  if (metrics.trailKneeDeg !== null && metrics.trailKneeDeg > 176 && metrics.phase === 'address') {
    cues.push({
      id: 'trail-knee-lock',
      level: 'watch',
      title: `Locked ${trailName} knee`,
      detail: 'Trail knee is nearly straight. A soft flex at address usually helps the pelvis rotate instead of slide.',
    });
  }

  if (metrics.leadKneeDeg !== null && metrics.leadKneeDeg < 130 && metrics.phase === 'address') {
    cues.push({
      id: 'lead-knee-soft',
      level: 'info',
      title: `Soft ${leadName} knee`,
      detail: 'Lead knee is quite flexed at setup. Confirm that is intentional and not collapsing toward the midline.',
    });
  }

  if (metrics.stanceToShoulderRatio !== null) {
    if (metrics.stanceToShoulderRatio < 0.85) {
      cues.push({
        id: 'stance-narrow',
        level: 'info',
        title: 'Narrow stance',
        detail: `Ankles are ${(metrics.stanceToShoulderRatio * 100).toFixed(0)}% of shoulder width. Face-on drivers often stand at or slightly outside the shoulders.`,
      });
    } else if (metrics.stanceToShoulderRatio > 1.7) {
      cues.push({
        id: 'stance-wide',
        level: 'info',
        title: 'Wide stance',
        detail: `Ankles are ${(metrics.stanceToShoulderRatio * 100).toFixed(0)}% of shoulder width — stable, but it can limit pelvic turn.`,
      });
    }
  }

  if (metrics.clubHead?.method === 'prior') {
    cues.push({
      id: 'club-prior',
      level: 'info',
      title: 'Club head from shaft length',
      detail: 'No clear head blob — using a wrist-to-length prior. Address and slow motion lock better than a blurred downswing.',
    });
  }

  if (cues.length === 0) {
    cues.push({
      id: 'ok',
      level: 'info',
      title: 'Frontal landmarks look quiet',
      detail: 'Shoulder/pelvic lines, midline, and knee window are in a reasonable face-on window. This is 2D — confirm down-the-line (sagittal) separately.',
    });
  }

  return cues;
}
