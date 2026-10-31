import * as XLSX from 'xlsx';
import type { CountrySummary, CountryCode, Confidence, Factor, RawDataRow, RawPartner } from './types';

/**
 * Parses the LZP partners workbook. Shared by the build script (scripts/build-data.ts)
 * and the in-app "Upload Excel" button, so both read the format the same way.
 */

export const COUNTRY_MAP: Record<string, CountryCode> = {
  latvija: 'LV', latvia: 'LV', lv: 'LV',
  lietuva: 'LT', lithuania: 'LT', lt: 'LT',
  igaunija: 'EE', estonia: 'EE', ee: 'EE',
  polija: 'PL', poland: 'PL', pl: 'PL',
  somija: 'FI', finland: 'FI', fi: 'FI',
  ukraina: 'UA', ukraine: 'UA', ua: 'UA',
};

export function toCountry(raw: unknown): CountryCode | null {
  const k = String(raw ?? '').trim().toLowerCase();
  return COUNTRY_MAP[k] ?? null;
}

type Row = unknown[];

function rows(wb: XLSX.WorkBook, name: string): Row[] {
  const sheet = wb.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { header: 1, blankrows: false, defval: null });
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Finds the header row by looking for all the given labels (case-insensitive, prefix match). */
function findHeader(data: Row[], labels: string[]): { index: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(data.length, 15); i++) {
    const cells = data[i].map((c) => str(c).toLowerCase());
    const cols: Record<string, number> = {};
    for (const label of labels) {
      const idx = cells.findIndex((c) => c.startsWith(label.toLowerCase()));
      if (idx >= 0) cols[label] = idx;
    }
    if (Object.keys(cols).length === labels.length) return { index: i, cols };
  }
  return null;
}

export function parsePartners(wb: XLSX.WorkBook): RawPartner[] {
  const data = rows(wb, 'Partners');
  const h = findHeader(data, ['Partner', 'Country', 'Total', 'Film']);
  if (!h) throw new Error('Sheet "Partners": header row with Partner / Country / Total / Film not found.');
  const header = data[h.index].map((c) => str(c).toLowerCase());
  const col = (prefix: string) => header.findIndex((c) => c.startsWith(prefix));
  const c = {
    name: h.cols.Partner, country: h.cols.Country, total: h.cols.Total, film: h.cols.Film,
    share: col('share'), location: col('location'), process: col('what they do'),
    capacity: col('stated capacity'), distance: col('approx'), status: col('research status'), sources: col('sources'),
  };
  const out: RawPartner[] = [];
  for (const r of data.slice(h.index + 1)) {
    const name = str(r[c.name]);
    if (!name || name.toUpperCase() === 'TOTAL') continue;
    const totalT = num(r[c.total]);
    if (totalT === null) continue;
    out.push({
      name,
      countryRaw: str(r[c.country]),
      country: toCountry(r[c.country]),
      totalT,
      filmT: num(r[c.film]) ?? 0,
      share: c.share >= 0 ? num(r[c.share]) ?? 0 : 0,
      location: c.location >= 0 ? str(r[c.location]) : '',
      process: c.process >= 0 ? str(r[c.process]) : '',
      capacityT: c.capacity >= 0 ? num(r[c.capacity]) : null,
      distanceKm: c.distance >= 0 ? num(r[c.distance]) : null,
      researchStatus: c.status >= 0 ? str(r[c.status]) : '',
      sources: c.sources >= 0 ? str(r[c.sources]) : '',
    });
  }
  return out;
}

export function parseAssumptions(wb: XLSX.WorkBook): Factor[] {
  const data = rows(wb, 'Assumptions');
  const h = findHeader(data, ['ID', 'Parameter', 'Base']);
  if (!h) return [];
  const header = data[h.index].map((c) => str(c).toLowerCase());
  const col = (prefix: string) => header.findIndex((c) => c.startsWith(prefix));
  const c = {
    id: h.cols.ID, parameter: h.cols.Parameter, base: h.cols.Base, low: col('low'), high: col('high'),
    unit: col('unit'), source: col('source'), year: col('year'), confidence: col('confidence'),
    status: col('status'), notes: col('notes'),
  };
  const out: Factor[] = [];
  let group = '';
  for (const r of data.slice(h.index + 1)) {
    const id = str(r[c.id]);
    const parameter = str(r[c.parameter]);
    // Section rows have text in the ID column and nothing else.
    if (id && !parameter && num(r[c.base]) === null) { group = id; continue; }
    if (!/^[A-Z]{1,3}\d+$/.test(id)) continue;
    const status = str(r[c.status]);
    const conf = str(r[c.confidence]) as Confidence;
    out.push({
      id,
      group,
      parameter,
      base: num(r[c.base]),
      low: num(r[c.low]),
      high: num(r[c.high]),
      unit: str(r[c.unit]),
      source: str(r[c.source]),
      year: num(r[c.year]),
      confidence: (['High', 'Medium', 'Low'] as const).includes(conf) ? conf : 'Low',
      status,
      estimated: /assum|estim/i.test(status),
      notes: str(r[c.notes]) || undefined,
      origin: 'workbook',
    });
  }
  return out;
}

export function parseByCountry(wb: XLSX.WorkBook): CountrySummary[] {
  const data = rows(wb, 'By country');
  const h = findHeader(data, ['Country', 'Total', 'Film']);
  if (!h) return [];
  const header = data[h.index].map((c) => str(c).toLowerCase());
  const share = header.findIndex((c) => c.startsWith('share'));
  const count = header.findIndex((c) => c.startsWith('partners'));
  return data
    .slice(h.index + 1)
    .filter((r) => str(r[h.cols.Country]) && str(r[h.cols.Country]).toUpperCase() !== 'TOTAL')
    .map((r) => ({
      countryRaw: str(r[h.cols.Country]),
      country: toCountry(r[h.cols.Country]),
      totalT: num(r[h.cols.Total]) ?? 0,
      filmT: num(r[h.cols.Film]) ?? 0,
      share: share >= 0 ? num(r[share]) ?? 0 : 0,
      partners: count >= 0 ? num(r[count]) ?? 0 : 0,
    }));
}

export function parseRawData(wb: XLSX.WorkBook): RawDataRow[] {
  const data = rows(wb, 'Raw data');
  const h = findHeader(data, ['Polymer', 'Recycler (original)', 'Country', 'Quantity']);
  if (!h) return [];
  const header = data[h.index].map((c) => str(c).toLowerCase());
  const inter = header.findIndex((c) => c.startsWith('intermediary'));
  const norm = header.findIndex((c) => c.startsWith('recycler (normalized)'));
  const film = header.findIndex((c) => c.startsWith('film'));
  return data.slice(h.index + 1).map((r) => ({
    polymer: str(r[h.cols.Polymer]),
    intermediary: inter >= 0 ? str(r[inter]) : '',
    recycler: str(r[h.cols['Recycler (original)']]),
    countryRaw: str(r[h.cols.Country]),
    quantityT: num(r[h.cols.Quantity]) ?? 0,
    recyclerNormalized: norm >= 0 ? str(r[norm]) : str(r[h.cols['Recycler (original)']]),
    film: film >= 0 ? /^y/i.test(str(r[film])) : false,
  }));
}

export interface ParsedWorkbook {
  partners: RawPartner[];
  assumptions: Factor[];
  byCountry: CountrySummary[];
  rawData: RawDataRow[];
}

export function parseWorkbook(wb: XLSX.WorkBook): ParsedWorkbook {
  return {
    partners: parsePartners(wb),
    assumptions: parseAssumptions(wb),
    byCountry: parseByCountry(wb),
    rawData: parseRawData(wb),
  };
}

/** Cross-checks the Partners sheet against Raw data and By country. Returns human-readable issues. */
export function validateWorkbook(p: ParsedWorkbook): string[] {
  const issues: string[] = [];
  const unknown = p.partners.filter((x) => !x.country);
  if (unknown.length) issues.push(`Unknown country for: ${unknown.map((x) => x.name).join(', ')}`);
  if (p.rawData.length) {
    const byRecycler = new Map<string, { total: number; film: number }>();
    for (const r of p.rawData) {
      const e = byRecycler.get(r.recyclerNormalized) ?? { total: 0, film: 0 };
      e.total += r.quantityT;
      if (r.film) e.film += r.quantityT;
      byRecycler.set(r.recyclerNormalized, e);
    }
    for (const partner of p.partners) {
      const raw = byRecycler.get(partner.name);
      if (raw && Math.abs(raw.total - partner.totalT) > 0.5) {
        issues.push(`${partner.name}: Partners total ${partner.totalT.toFixed(1)} t vs Raw data ${raw.total.toFixed(1)} t`);
      }
    }
  }
  if (p.byCountry.length) {
    const sum = p.partners.reduce((a, x) => a + x.totalT, 0);
    const sumCountry = p.byCountry.reduce((a, x) => a + x.totalT, 0);
    if (Math.abs(sum - sumCountry) > 0.5) issues.push(`Partner total ${sum.toFixed(1)} t vs By country ${sumCountry.toFixed(1)} t`);
  }
  return issues;
}
