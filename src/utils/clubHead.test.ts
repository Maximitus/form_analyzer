import { describe, expect, it } from 'vitest';
import { estimateClubHead, kinematicClubHead, shaftDirection } from './clubHead';
import type { ClubSearchLandmarks } from './clubHead';

const faceOn: ClubSearchLandmarks = {
  leadWrist: { x: 102, y: 80 },
  trailWrist: { x: 98, y: 92 },
  midHip: { x: 100, y: 70 },
  midShoulder: { x: 100, y: 30 },
  head: { x: 100, y: 10 },
  midAnkle: { x: 100, y: 150 },
};

describe('shaftDirection', () => {
  it('points generally downward past the trail hand at face-on address', () => {
    const dir = shaftDirection(faceOn);
    expect(dir).not.toBeNull();
    expect(dir!.y).toBeGreaterThan(0.5);
  });
});

describe('kinematicClubHead', () => {
  it('places the prior beyond the trail wrist along the shaft', () => {
    const dir = shaftDirection(faceOn)!;
    const grip = faceOn.trailWrist!;
    const head = kinematicClubHead(grip, dir, 140, 0.58);
    expect(head.y).toBeGreaterThan(grip.y + 20);
  });
});

describe('estimateClubHead', () => {
  it('locks onto a dark distal blob along the shaft', () => {
    const width = 200;
    const height = 200;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 210;
      rgba[i + 1] = 210;
      rgba[i + 2] = 210;
      rgba[i + 3] = 255;
    }
    const dir = shaftDirection(faceOn)!;
    const grip = faceOn.trailWrist!;
    const target = kinematicClubHead(grip, dir, 140, 0.72);
    const paint = (cx: number, cy: number, r: number, value: number) => {
      for (let y = Math.round(cy) - r; y <= Math.round(cy) + r; y++) {
        for (let x = Math.round(cx) - r; x <= Math.round(cx) + r; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const i = (y * width + x) * 4;
          rgba[i] = value;
          rgba[i + 1] = value;
          rgba[i + 2] = value;
        }
      }
    };
    for (let t = 20; t < 110; t += 2) {
      paint(grip.x + dir.x * t, grip.y + dir.y * t, 2, 40);
    }
    paint(target.x, target.y, 7, 15);

    const estimate = estimateClubHead(rgba, width, height, faceOn);
    expect(estimate).not.toBeNull();
    expect(estimate!.method).toBe('image');
    expect(estimate!.x).toBeGreaterThan(target.x - 16);
    expect(estimate!.x).toBeLessThan(target.x + 16);
    expect(estimate!.y).toBeGreaterThan(target.y - 16);
    expect(estimate!.y).toBeLessThan(target.y + 16);
  });
});
