import { CITIES, defaultOption, feasibleMode, optionForCity, optionForPartner, type PlanOption } from './planner';
import type { Factor, Mode, Partner } from './types';

/** One spreadsheet row that matched the database and can be calculated. */
export interface ImportRow {
  /** 1-based row number in the sheet (header = row 1). */
  row: number;
  option: PlanOption;
  customer: string;
  /** ISO date if the sheet had a readable one. */
  date: string | null;
}

export interface ImportParse {
  rows: ImportRow[];
  /** Rows left out because something in them is not in the database (or is missing). */
  skipped: number;
  total: number;
}

/** Column names we recognise, after lower-casing and removing everything but letters and digits. */
const COLUMNS: Record<keyof Cells, string[]> = {
  tonnes: ['tonnes', 'tonne', 'tons', 'ton', 't', 'weight', 'weightt', 'quantity', 'quantityt', 'qty', 'amount', 'amountt'],
  destination: ['destination', 'recycler', 'partner', 'city', 'to', 'place', 'recyclercity', 'destinationcity'],
  mode: ['mode', 'transport', 'transportmode', 'vehicle'],
  material: ['material', 'type', 'packaging', 'packagingtype'],
  customer: ['customer', 'client', 'company', 'producer'],
  date: ['date', 'shipped', 'shipmentdate', 'day'],
  emptyReturn: ['emptyreturn', 'returnempty', 'returntripempty'],
};

interface Cells { tonnes: unknown; destination: unknown; mode: unknown; material: unknown; customer: unknown; date: unknown; emptyReturn: unknown }

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Lower-case, no accents, no punctuation and no company-form words, for matching names. */
export function normName(s: string) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(uab|sia|as|ab|oy|oyj|sp|z|o|gmbh|ltd|llc|ou|spolka)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cells(raw: Record<string, unknown>): Cells {
  const byKey = new Map(Object.entries(raw).map(([k, v]) => [key(k), v]));
  const out = {} as Cells;
  for (const [field, names] of Object.entries(COLUMNS) as [keyof Cells, string[]][]) {
    out[field] = names.map((n) => byKey.get(n)).find((v) => v !== undefined && v !== '');
  }
  return out;
}

function toNumber(v: unknown) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v.replace(/\s/g, '').replace(',', '.'));
  return NaN;
}

/** Only LDPE film has sourced factors; other materials are not in the database yet. */
function material(v: unknown): string | null {
  if (v === undefined) return 'LDPE';
  return /ldpe|film|polyethylene|\bpe\b/i.test(String(v)) ? 'LDPE' : null;
}

function mode(v: unknown): Mode | null {
  if (v === undefined) return 'road';
  const s = String(v).toLowerCase();
  if (/ferry|sea|ship/.test(s)) return 'road+ferry';
  if (/rail|train/.test(s)) return 'rail';
  if (/truck|road|lorry|car/.test(s)) return 'road';
  return null;
}

function date(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return v.toISOString();
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return isNaN(+d) ? null : d.toISOString();
  }
  return null;
}

function emptyReturn(v: unknown) {
  return v !== undefined && /^(y|yes|true|1|x|ja|jā)$/i.test(String(v).trim());
}

/**
 * Turns spreadsheet rows into planner options. A row is kept only when every value we need is
 * present and known to the database: LDPE material, tonnes > 0, a destination that is a known
 * recycler or city, and a recognised transport mode. Everything else is skipped, not guessed.
 */
export function parseRouteRows(raw: Record<string, unknown>[], partners: Partner[], factors: Factor[]): ImportParse {
  const base = defaultOption(partners);
  const byName = partners.map((p) => ({ p, n: normName(p.name) }));
  const rows: ImportRow[] = [];
  raw.forEach((r, i) => {
    const c = cells(r);
    const t = toNumber(c.tonnes);
    const mat = material(c.material);
    const m = mode(c.mode);
    const dest = c.destination === undefined ? '' : normName(String(c.destination));
    if (!(t > 0) || !mat || !m || !dest) return;

    const partner = byName.find((x) => x.n === dest)?.p ?? byName.find((x) => dest.length >= 4 && x.n.length >= 4 && (x.n.includes(dest) || dest.includes(x.n)))?.p;
    const city = partner ? undefined : CITIES.find((x) => normName(x.name) === dest);
    if (!partner && !city) return;

    const start = { ...base, material: mat, tonnes: t, emptyReturn: emptyReturn(c.emptyReturn) };
    const option = partner ? optionForPartner(start, partner, m) : optionForCity({ ...start, mode: m }, city!, factors);
    rows.push({ row: i + 2, option: { ...option, mode: feasibleMode(m, option.country) }, customer: c.customer === undefined ? '' : String(c.customer).trim(), date: date(c.date) });
  });
  return { rows, skipped: raw.length - rows.length, total: raw.length };
}

/** Example sheet: real recyclers and cities, plus two rows the database cannot answer. */
export function sampleRows(partners: Partner[]): Record<string, unknown>[] {
  const film = partners.filter((p) => p.filmT > 0 && p.locationVerified).sort((a, b) => b.filmT - a.filmT);
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const pick = (i: number) => film[i % Math.max(1, film.length)]?.name ?? 'Riga';
  const customers = ['Rimi Latvia', 'Maxima', 'Cido Grupa', 'Aldaris', 'Orkla Latvija'];
  const rows: Record<string, unknown>[] = [];
  const dests = [pick(0), pick(1), 'Kaunas', pick(2), 'Tallinn', 'Helsinki', pick(0), 'Warsaw', pick(3), 'Vilnius', pick(1), 'Tartu'];
  const modes = ['Truck', 'Truck', 'Truck', 'Rail', 'Truck', 'Truck + ferry', 'Truck', 'Rail', 'Truck', 'Truck', 'Truck', 'Truck'];
  dests.forEach((d, i) => {
    rows.push({ Date: day(i * 2), Customer: customers[i % customers.length], Material: 'LDPE film', Tonnes: [24, 18, 12, 60, 22, 20, 30, 80, 14, 26, 9, 16][i], Destination: d, Mode: modes[i], 'Empty return': i % 4 === 0 ? 'yes' : 'no' });
  });
  rows.push({ Date: day(3), Customer: 'Aldaris', Material: 'Glass', Tonnes: 40, Destination: 'Riga', Mode: 'Truck', 'Empty return': 'no' });
  rows.push({ Date: day(5), Customer: 'Maxima', Material: 'LDPE film', Tonnes: 15, Destination: 'Unknown Recycling Ltd', Mode: 'Truck', 'Empty return': 'no' });
  return rows;
}
