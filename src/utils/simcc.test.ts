import { describe, expect, it } from 'vitest';
import { decodeSimcc, identifySimccOutputs, softArgmax1d } from '../utils/simcc';

describe('softArgmax1d', () => {
  it('returns the peak index when the window is a single bin', () => {
    const data = new Float32Array([0, 0, 4, 0, 0]);
    const result = softArgmax1d(data, 0, 5, 2, 1);
    expect(result.coord).toBe(2);
  });

  it('shifts sub-pixel toward a stronger neighbor', () => {
    const data = new Float32Array([0, 1, 5, 4, 0]);
    const result = softArgmax1d(data, 0, 5, 2, 5);
    expect(result.coord).toBeGreaterThan(2);
    expect(result.coord).toBeLessThan(3);
  });
});

describe('decodeSimcc', () => {
  it('decodes argmax bins into model-space pixels using the split ratio', () => {
    const keys = 17;
    const xBins = 384;
    const yBins = 512;
    const split = 2;
    const simccX = new Float32Array(keys * xBins);
    const simccY = new Float32Array(keys * yBins);

    for (let k = 0; k < keys; k++) {
      simccX[k * xBins + 40] = 8;
      simccY[k * yBins + 80] = 8;
    }

    const decoded = decodeSimcc(simccX, [1, keys, xBins], simccY, [1, keys, yBins], {
      splitRatio: split,
      softWindow: 1,
    });

    expect(decoded.xs.length).toBe(keys);
    expect(decoded.xs[0]).toBeCloseTo(40 / split);
    expect(decoded.ys[0]).toBeCloseTo(80 / split);
    expect(decoded.scores[0]).toBeGreaterThan(0.9);
  });
});

describe('identifySimccOutputs', () => {
  it('uses tensor names when present', () => {
    const id = identifySimccOutputs(
      [
        { name: 'simcc_y', dims: [1, 17, 512] },
        { name: 'simcc_x', dims: [1, 17, 384] },
      ],
      192,
      256,
      2,
    );
    expect(id).toEqual({ xName: 'simcc_x', yName: 'simcc_y' });
  });

  it('falls back to expected bin counts', () => {
    const id = identifySimccOutputs(
      [
        { name: 'output0', dims: [1, 17, 384] },
        { name: 'output1', dims: [1, 17, 512] },
      ],
      192,
      256,
      2,
    );
    expect(id).toEqual({ xName: 'output0', yName: 'output1' });
  });
});
