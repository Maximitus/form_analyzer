import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '../utils/oneEuroFilter';
import { computeLetterbox, mapModelToSource, mapSourceToModel, rgbaToNchwFloat32 } from '../utils/preprocess';

describe('OneEuroFilter', () => {
  it('passes a constant signal through unchanged', () => {
    const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.3, dCutoff: 1 });
    const samples = [5, 5, 5, 5, 5];
    const out = samples.map((v, i) => filter.filter(v, i * 0.016));
    for (const v of out) {
      expect(v).toBeCloseTo(5, 6);
    }
  });

  it('attenuates high-frequency jitter relative to the raw signal', () => {
    const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.007, dCutoff: 1 });
    const raw: number[] = [];
    const smoothed: number[] = [];
    for (let i = 0; i < 120; i++) {
      const value = 10 + ((i % 2) * 2 - 1) * 0.8;
      raw.push(value);
      smoothed.push(filter.filter(value, i / 60));
    }
    const variance = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    };
    expect(variance(smoothed.slice(20))).toBeLessThan(variance(raw.slice(20)));
  });
});

describe('letterbox mapping', () => {
  it('inverts source → model → source', () => {
    const meta = computeLetterbox(1280, 720, 192, 256);
    const src = { x: 400, y: 200 };
    const model = mapSourceToModel(src.x, src.y, meta);
    const back = mapModelToSource(model.x, model.y, meta);
    expect(back.x).toBeCloseTo(src.x, 6);
    expect(back.y).toBeCloseTo(src.y, 6);
    expect(meta.padX).toBeGreaterThanOrEqual(0);
    expect(meta.padY).toBeGreaterThanOrEqual(0);
  });
});

describe('rgbaToNchwFloat32', () => {
  it('writes RGB planes in NCHW order with ImageNet normalization', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const tensor = rgbaToNchwFloat32(rgba, 1, 1);
    expect(tensor.length).toBe(3);
    expect(tensor[0]).toBeCloseTo((255 - 123.675) / 58.395, 5);
    expect(tensor[1]).toBeCloseTo((0 - 116.28) / 57.12, 5);
    expect(tensor[2]).toBeCloseTo((0 - 103.53) / 57.375, 5);
  });
});
