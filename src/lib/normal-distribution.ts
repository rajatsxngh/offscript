function validate(mean: number, deviation: number): void {
  if (!Number.isFinite(mean) || !Number.isFinite(deviation)) throw new Error('Chart parameters must be finite.');
  if (deviation <= 0) throw new Error('Standard deviation must be positive.');
}

export function normalPdf(x: number, mean: number, deviation: number): number {
  validate(mean, deviation);
  if (!Number.isFinite(x)) throw new Error('The chart value must be finite.');
  return Math.exp(-0.5 * ((x - mean) / deviation) ** 2) / (deviation * Math.sqrt(2 * Math.PI));
}

// Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  return sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
}

export function normalProbability(min: number, max: number, mean: number, deviation: number): number {
  validate(mean, deviation);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) throw new Error('Choose a finite range with minimum below maximum.');
  const scale = deviation * Math.SQRT2;
  return Math.max(0, Math.min(1, 0.5 * (erf((max - mean) / scale) - erf((min - mean) / scale))));
}

export function buildNormalCurve(mean: number, deviation: number, points = 121): { x: number; y: number }[] {
  validate(mean, deviation);
  if (!Number.isInteger(points) || points < 2 || points > 10001) throw new Error('Choose 2 to 10001 chart points.');
  return Array.from({ length: points }, (_, i) => {
    const x = mean + deviation * (-4 + 8 * i / (points - 1));
    return { x, y: normalPdf(x, mean, deviation) };
  });
}
