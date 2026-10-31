import cityData from '../../data/cities.json';
import locations from '../../data/locations.json';
import { partnerImpact, type Params, type PartnerInput, type PartnerResult } from './calc';
import { COUNTRY_NAMES } from './enrich';
import type { CountryCode, Factor, Mode, Partner } from './types';

/** One shipment option in the Route planner. */
export interface PlanOption {
  material: string;
  tonnes: number;
  /** 'country' only appears in records saved before cities were added. */
  destKind: 'partner' | 'city' | 'country';
  partnerId: string | null;
  cityId?: string | null;
  country: CountryCode;
  mode: Mode;
  km: number;
  seaKm: number;
  emptyReturn: boolean;
}

export interface ResolvedOption {
  input: PartnerInput;
  label: string;
  sub: string;
  lat: number;
  lng: number;
  verified: boolean;
}

export interface City { id: string; name: string; country: CountryCode; lat: number; lng: number; seaKm?: number }
export const CITIES = cityData.cities as City[];

const R = 6371;
/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated road km from Riga: great-circle x circuity factor D7, rounded to 10 km. */
export function cityKm(city: City, factors: Factor[]) {
  const circuity = factors.find((f) => f.id === 'D7')?.base ?? 1.25;
  return Math.max(10, Math.round((haversineKm(locations.origin, city) * circuity) / 10) * 10);
}

export const MODE_NAME: Record<Mode, string> = { road: 'Truck', rail: 'Rail', 'road+ferry': 'Truck + ferry' };

/** Ferry is only offered where a sea leg exists in the data (Finland via Tallinn–Helsinki). */
export const ferryAvailable = (country: CountryCode) => country in (locations.defaultModes as Record<string, unknown>);
export const defaultSeaKm = (country: CountryCode) => (locations.defaultModes as Record<string, { seaKm: number }>)[country]?.seaKm ?? 0;

/**
 * The mode a shipment can actually use. Where a sea leg exists (Finland) a truck cannot get there
 * on its own and there is no rail link, so it is always truck + ferry; elsewhere there is no ferry.
 */
export const feasibleMode = (mode: Mode, country: CountryCode): Mode =>
  ferryAvailable(country) ? 'road+ferry' : mode === 'road+ferry' ? 'road' : mode;

export function resolveOption(o: PlanOption, partners: Partner[]): ResolvedOption {
  const p = o.destKind === 'partner' ? partners.find((x) => x.id === o.partnerId) : undefined;
  const city = o.destKind === 'city' ? CITIES.find((x) => x.id === o.cityId) : undefined;
  const country = p?.country ?? city?.country ?? o.country;
  const c = city ?? locations.centroids[country];
  const place = city ? city.name : COUNTRY_NAMES[country];
  const mode = feasibleMode(o.mode, country);
  return {
    input: {
      id: p ? p.id : city ? `city-${city.id}` : `country-${country}`,
      name: p ? p.name : `${place} (average recycler)`,
      country,
      tonnes: o.tonnes,
      km: o.km,
      mode,
      seaKm: mode === 'road+ferry' ? o.seaKm || defaultSeaKm(country) : 0,
      yieldOverride: p?.yieldOverride ?? null,
      kwhOverride: p?.kwhOverride ?? null,
      emptyReturn: o.emptyReturn,
    },
    label: p ? p.name : place,
    sub: p ? `${COUNTRY_NAMES[country]} · ${p.location || 'location unverified'}` : city ? `${COUNTRY_NAMES[country]} · average recycler · estimated distance` : 'Country average · default distance',
    lat: p?.lat ?? c.lat,
    lng: p?.lng ?? c.lng,
    verified: p?.locationVerified ?? Boolean(city),
  };
}

export function optionResult(o: PlanOption, partners: Partner[], params: Params): { r: PartnerResult; meta: ResolvedOption } {
  const meta = resolveOption(o, partners);
  return { r: partnerImpact(meta.input, params), meta };
}

/** A sensible default: the largest film recycler (Nordic Plast), by truck. */
export function defaultOption(partners: Partner[]): PlanOption {
  const p = [...partners].sort((a, b) => b.filmT - a.filmT)[0];
  return { material: 'LDPE', tonnes: 24, destKind: 'partner', partnerId: p?.id ?? null, country: p?.country ?? 'LV', mode: p?.mode ?? 'road', km: p?.km ?? 50, seaKm: p?.seaKm ?? 0, emptyReturn: false };
}

export function optionForPartner(base: PlanOption, p: Partner, mode: Mode = p.mode): PlanOption {
  return { ...base, destKind: 'partner', partnerId: p.id, country: p.country, km: p.km, mode: feasibleMode(mode, p.country), seaKm: p.seaKm || defaultSeaKm(p.country) };
}

export function optionForCity(base: PlanOption, city: City, factors: Factor[]): PlanOption {
  return {
    ...base, destKind: 'city', partnerId: null, cityId: city.id, country: city.country, km: cityKm(city, factors),
    mode: feasibleMode(base.mode, city.country), seaKm: city.seaKm ?? defaultSeaKm(city.country),
  };
}

/**
 * Ranks every known LDPE recycler and transport mode for this shipment by net kg CO2e per tonne.
 * Only partners that handled film in 2025 are suggested; by default only those with a verified
 * location, because unverified partners run on country-default distances and yields.
 */
export function recommend(base: PlanOption, partners: Partner[], params: Params, limit = 4, verifiedOnly = true) {
  return candidates(base, partners, params, verifiedOnly).sort((a, b) => a.r.netPerT - b.r.netPerT).slice(0, limit);
}

/** Every verified (or all) film recycler with each mode that can reach it, unranked. */
export function candidates(base: PlanOption, partners: Partner[], params: Params, verifiedOnly = true) {
  const out: { option: PlanOption; r: PartnerResult; meta: ResolvedOption }[] = [];
  for (const p of partners.filter((x) => x.filmT > 0 && (!verifiedOnly || x.locationVerified))) {
    // Rail is only realistic for longer hauls; ferry only where a sea leg exists.
    const modes: Mode[] = ferryAvailable(p.country) ? ['road+ferry'] : ['road', ...(p.km >= 200 ? (['rail'] as Mode[]) : [])];
    for (const m of modes) {
      const option = optionForPartner(base, p, m);
      out.push({ option, ...optionResult(option, partners, params) });
    }
  }
  return out;
}

export const optionKey = (o: PlanOption) => `${o.destKind}:${o.partnerId ?? o.cityId ?? o.country}:${o.mode}:${o.km}:${o.emptyReturn}`;
