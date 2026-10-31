const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** kg CO2e -> "1,234" (t CO2e). */
export const tCO2e = (kg: number) => nf0.format(Math.round(kg / 1000));
/** kg CO2e -> signed "−1,234". */
export const tCO2eSigned = (kg: number) => (kg < 0 ? '−' : kg > 0 ? '+' : '') + nf0.format(Math.abs(Math.round(kg / 1000)));
export const num0 = (n: number) => nf0.format(n);
export const num1 = (n: number) => nf1.format(n);
export const num2 = (n: number) => nf2.format(n);
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const minus = (s: string) => s.replace('-', '−');

/** Compact factor value for tables, keeping significant digits. */
export function factorValue(v: number | null): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 100) return nf0.format(v);
  if (Math.abs(v) >= 1) return String(Math.round(v * 1000) / 1000);
  return String(Math.round(v * 100000) / 100000);
}

export const STAGE_LABEL: Record<string, string> = {
  collection: 'Collection', sorting: 'Sorting', transport: 'Transport', recycling: 'Recycling',
};

export const MODE_LABEL: Record<string, string> = { road: 'Road', rail: 'Rail', 'road+ferry': 'Road + ferry' };
