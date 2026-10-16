import type { NoteBlock } from '@/lib/types';
import { normalPdf, normalProbability } from '@/lib/normal-distribution';

export function NormalCurve({ chart }: { chart: NonNullable<NoteBlock['chart']> }) {
  const { mean, deviation, shadeMin, shadeMax } = chart;
  if (![mean, deviation, shadeMin, shadeMax].every(Number.isFinite) || deviation <= 0 || shadeMin > shadeMax) return <p className="error-message">This chart needs valid values. Edit it to use a positive standard deviation and a shaded range whose start is below its end.</p>;
  const sigma = deviation;
  const w = 660, h = 235, left = 44, right = 640, baseline = 190;
  const peak = normalPdf(mean, mean, sigma);
  const probability = normalProbability(shadeMin, shadeMax, mean, sigma);
  const x = (v: number) => left + ((v - mean) / sigma + 3.5) / 7 * (right - left);
  const y = (v: number) => baseline - normalPdf(v, mean, sigma) / peak * 150;
  const points = Array.from({ length: 181 }, (_, i) => mean + sigma * (-3.5 + i * 7 / 180));
  const curve = points.map((v, i) => `${i ? 'L' : 'M'}${x(v).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const lo = Math.max(mean - 3.5 * sigma, Math.min(shadeMin, shadeMax));
  const hi = Math.min(mean + 3.5 * sigma, Math.max(shadeMin, shadeMax));
  const shade = lo < hi ? `M${x(lo)},${baseline} ` + Array.from({ length: 81 }, (_, i) => lo + i * (hi - lo) / 80).map(v => `L${x(v)},${y(v)}`).join(' ') + ` L${x(hi)},${baseline} Z` : '';
  const format = (v: number) => Number(v.toFixed(2)).toString();
  return <div className="curve-wrap">
    <div className="chart-caption"><span>THE NORMAL DISTRIBUTION</span><span>μ = {format(mean)} · σ = {format(sigma)}</span></div>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Normal probability density with mean ${mean} and standard deviation ${sigma}. Shaded interval from ${shadeMin} to ${shadeMax}. The highest density is ${format(1 / (sigma * Math.sqrt(2 * Math.PI)))} at the mean.`}>
      <line x1={left} y1={baseline} x2={right} y2={baseline} stroke="#cbd3cc" />
      <line x1={left} y1="40" x2={left} y2={baseline} stroke="#dce2d8" />
      <text x={left - 5} y="43" textAnchor="end" fontSize="9" fill="#788079">{peak.toPrecision(2)}</text>
      <text x={left - 5} y={baseline + 3} textAnchor="end" fontSize="9" fill="#788079">0</text>
      <text x="12" y="113" transform="rotate(-90 12 113)" fontSize="10" fill="#788079">Probability density</text>
      {[-2, -1, 0, 1, 2].map(n => <g key={n}><line x1={x(mean + n * sigma)} y1={y(mean + n * sigma)} x2={x(mean + n * sigma)} y2={baseline} stroke="#d9dfd9" strokeDasharray="4 5" /><text x={x(mean + n * sigma)} y={baseline + 20} textAnchor="middle" fill="#747d75" fontSize="11">{format(mean + n * sigma)}</text></g>)}
      <path d={shade} fill="#dce9dd" />
      <path d={curve} fill="none" stroke="#3d6e53" strokeWidth="2.6" strokeLinecap="round" />
      <text x={x(mean)} y="24" textAnchor="middle" fill="#3d6e53" fontSize="11">mean (μ)</text>
      <text x={(left + right) / 2} y="232" textAnchor="middle" fill="#788079" fontSize="10">Value</text>
    </svg>
    <div className="chart-key"><span><i /> Selected interval · {(probability * 100).toFixed(2)}%</span><span>Area under the full curve = 1</span></div>
  </div>;
}
