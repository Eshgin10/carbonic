import locations from '../../data/locations.json';
import extra from '../../data/extraFactors.json';
import type { CountryCode, Factor, Partner, RawPartner } from './types';

/** Workbook rows first, then curated extras. An extra with the same id replaces the workbook row. */
export function mergeFactors(workbook: Factor[]): Factor[] {
  const extras = extra.factors as unknown as Factor[];
  const byId = new Map<string, Factor>();
  for (const f of workbook) byId.set(f.id, { direction: 1, ...f });
  for (const e of extras) {
    const prev = byId.get(e.id);
    const note = prev && prev.base !== e.base ? `Workbook value ${prev.base} ${prev.unit} replaced.` : '';
    byId.set(e.id, { direction: 1, ...e, notes: [e.notes, note].filter(Boolean).join(' ') || undefined });
  }
  return [...byId.values()];
}

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Adds coordinates, model distance, transport mode and partner overrides to workbook rows. */
export function enrichPartners(raw: RawPartner[], factors: Factor[]): Partner[] {
  const f = (id: string) => factors.find((x) => x.id === id)?.base ?? null;
  const perCountry: Record<string, number> = {};
  return raw
    .filter((p): p is RawPartner & { country: CountryCode } => p.country !== null)
    .map((p) => {
      const known = locations.known.find((k) => p.name.toLowerCase().includes(k.match));
      const c = locations.centroids[p.country];
      const i = (perCountry[p.country] = (perCountry[p.country] ?? -1) + 1);
      // Spread unverified partners around the centroid on a small spiral so they stay clickable.
      const angle = i * 2.4;
      const r = i === 0 ? 0 : 0.18 + 0.07 * Math.sqrt(i);
      const defaultKm = f(locations.defaultDistanceFactorIds[p.country]) ?? 0;
      const modeDefault = (locations.defaultModes as Record<string, { mode: Partner['mode']; seaKm: number }>)[p.country];
      const isNordic = /nordic plast/i.test(p.name);
      return {
        ...p,
        id: slug(p.name),
        lat: known ? known.lat : c.lat + r * Math.sin(angle),
        lng: known ? known.lng : c.lng + r * 1.6 * Math.cos(angle),
        location: p.location || (known ? known.label : ''),
        locationVerified: Boolean(known),
        km: p.distanceKm ?? defaultKm,
        distanceEstimated: true,
        mode: modeDefault?.mode ?? 'road',
        seaKm: modeDefault?.seaKm ?? 0,
        yieldOverride: isNordic ? f('P3-NP') : null,
        kwhOverride: isNordic ? f('P1-NP') : null,
        overrideSource: isNordic ? 'Bureau Veritas Latvia LCA, Nov 2024 (2023 data)' : undefined,
      };
    });
}

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  LV: 'Latvia', LT: 'Lithuania', EE: 'Estonia', PL: 'Poland', FI: 'Finland', UA: 'Ukraine',
};

export const ORIGIN = locations.origin;
export const MATERIALS = extra.materials;
