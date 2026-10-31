/**
 * All emission math for Carbonic. Pure functions only: no React, no I/O.
 *
 * Units: tonnes of material in, kg CO2e out. Divide by 1000 for t CO2e.
 *
 *   Collection = t_input x collection factor
 *   Sorting    = t_input x sorting kWh/t x grid(LV)
 *   Transport  = t_input x km x mode factor x (1 + empty-return share, if the vehicle returns empty)
 *   Pellets    = t_input x yield
 *   Recycling  = pellets x kWh per t pellets x grid(partner country)
 *   CAUSED     = Collection + Sorting + Transport + Recycling
 *   AVOIDED    = pellets x substitution ratio x virgin LDPE factor
 *   NET        = CAUSED - AVOIDED
 */
import type { CountryCode, ElecMethod, Factor, Mode, Scenario } from './types';

export const STAGES = ['collection', 'sorting', 'transport', 'recycling'] as const;
export type Stage = (typeof STAGES)[number];
export type StageValues = Record<Stage, number>;

export interface Params {
  scenario: Scenario;
  elecMethod: ElecMethod;
  collectionKgPerT: number;
  sortingKwhPerT: number;
  grid: Record<CountryCode, number>;
  roadKgPerTkm: number;
  railKgPerTkm: number;
  seaKgPerTkm: number;
  /** Extra transport for an empty return leg, as a share of the loaded leg. */
  emptyReturnShare: number;
  yieldDefault: number;
  kwhPerTPellets: number;
  virginKgPerT: number;
  substitution: number;
  incinerationKgPerT: number;
  landfillKgPerT: number;
  eolRecycledShare: number;
  eolIncinerationShare: number;
  eolLandfillShare: number;
}

export interface PartnerInput {
  id: string;
  name: string;
  country: CountryCode;
  tonnes: number;
  km: number;
  mode: Mode;
  seaKm?: number;
  yieldOverride?: number | null;
  kwhOverride?: number | null;
  /** Vehicle returns empty (dedicated shipment). */
  emptyReturn?: boolean;
}

export interface PartnerResult {
  id: string;
  name: string;
  country: CountryCode;
  mode: Mode;
  tonnes: number;
  km: number;
  pellets: number;
  yield: number;
  kwhPerTPellets: number;
  grid: number;
  tkm: number;
  stages: StageValues;
  caused: number;
  avoided: number;
  net: number;
  /** kg CO2e per tonne of input. */
  causedPerT: number;
  netPerT: number;
}

export interface PortfolioResult {
  partners: PartnerResult[];
  tonnes: number;
  pellets: number;
  stages: StageValues;
  caused: number;
  avoided: number;
  net: number;
  transportByMode: Record<Mode, number>;
  transportByCountry: Partial<Record<CountryCode, number>>;
}

/* ------------------------------------------------------------------ */
/* Parameters                                                          */
/* ------------------------------------------------------------------ */

/**
 * Picks the value of a factor for a scenario. "low" and "high" describe the NET result:
 * low = the bound of every factor that lowers net emissions, high = the bound that raises them.
 */
export function pick(f: Factor | undefined, scenario: Scenario): number {
  if (!f || f.base === null) return 0;
  if (scenario === 'base') return f.base;
  const up = f.direction ?? 1;
  const wantHigher = (scenario === 'high') === (up === 1);
  const v = wantHigher ? f.high : f.low;
  return v ?? f.base;
}

export function resolveParams(factors: Factor[], scenario: Scenario, elecMethod: ElecMethod): Params {
  const by = new Map(factors.map((f) => [f.id, f]));
  const v = (id: string) => pick(by.get(id), scenario);
  const lv = elecMethod === 'residual' ? v('G7') : v('G1');
  return {
    scenario,
    elecMethod,
    collectionKgPerT: v('P4'),
    sortingKwhPerT: v('P2'),
    grid: { LV: lv, LT: v('G2'), EE: v('G3'), PL: v('G4'), FI: v('G5'), UA: v('G6') },
    roadKgPerTkm: v('T1'),
    railKgPerTkm: v('T4'),
    seaKgPerTkm: v('T3'),
    emptyReturnShare: v('T6'),
    yieldDefault: v('P3'),
    kwhPerTPellets: v('P1'),
    virginKgPerT: v('V1'),
    substitution: v('V3'),
    incinerationKgPerT: v('E4'),
    landfillKgPerT: v('E5'),
    eolRecycledShare: v('E1'),
    eolIncinerationShare: v('E2'),
    eolLandfillShare: v('E3'),
  };
}

/* ------------------------------------------------------------------ */
/* Partner and portfolio                                               */
/* ------------------------------------------------------------------ */

/** tonne-km of each mode for one route. road+ferry: the sea leg is part of the total km. */
export function routeTkm(tonnes: number, km: number, mode: Mode, seaKm = 0) {
  if (mode === 'rail') return { road: 0, rail: tonnes * km, sea: 0 };
  if (mode === 'road+ferry') {
    const sea = Math.min(seaKm, km);
    return { road: tonnes * (km - sea), rail: 0, sea: tonnes * sea };
  }
  return { road: tonnes * km, rail: 0, sea: 0 };
}

export function transportKg(tonnes: number, km: number, mode: Mode, seaKm: number, p: Params, emptyReturn = false) {
  const t = routeTkm(tonnes, km, mode, seaKm);
  const loaded = t.road * p.roadKgPerTkm + t.rail * p.railKgPerTkm + t.sea * p.seaKgPerTkm;
  return loaded * (1 + (emptyReturn ? p.emptyReturnShare : 0));
}

export function partnerImpact(input: PartnerInput, p: Params): PartnerResult {
  const t = Math.max(0, input.tonnes);
  const yld = input.yieldOverride ?? p.yieldDefault;
  const kwh = input.kwhOverride ?? p.kwhPerTPellets;
  const grid = p.grid[input.country];
  const pellets = t * yld;
  const stages: StageValues = {
    collection: t * p.collectionKgPerT,
    sorting: t * p.sortingKwhPerT * p.grid.LV,
    transport: transportKg(t, input.km, input.mode, input.seaKm ?? 0, p, input.emptyReturn),
    recycling: pellets * kwh * grid,
  };
  const caused = stages.collection + stages.sorting + stages.transport + stages.recycling;
  const avoided = pellets * p.substitution * p.virginKgPerT;
  const net = caused - avoided;
  return {
    id: input.id,
    name: input.name,
    country: input.country,
    mode: input.mode,
    tonnes: t,
    km: input.km,
    pellets,
    yield: yld,
    kwhPerTPellets: kwh,
    grid,
    tkm: t * input.km,
    stages,
    caused,
    avoided,
    net,
    causedPerT: t > 0 ? caused / t : 0,
    netPerT: t > 0 ? net / t : 0,
  };
}

const zeroStages = (): StageValues => ({ collection: 0, sorting: 0, transport: 0, recycling: 0 });

export function portfolioImpact(inputs: PartnerInput[], p: Params): PortfolioResult {
  const partners = inputs.map((i) => partnerImpact(i, p));
  const stages = zeroStages();
  const transportByMode: Record<Mode, number> = { road: 0, rail: 0, 'road+ferry': 0 };
  const transportByCountry: Partial<Record<CountryCode, number>> = {};
  let tonnes = 0, pellets = 0, caused = 0, avoided = 0;
  for (const r of partners) {
    for (const s of STAGES) stages[s] += r.stages[s];
    transportByMode[r.mode] += r.stages.transport;
    transportByCountry[r.country] = (transportByCountry[r.country] ?? 0) + r.stages.transport;
    tonnes += r.tonnes;
    pellets += r.pellets;
    caused += r.caused;
    avoided += r.avoided;
  }
  return { partners, tonnes, pellets, stages, caused, avoided, net: caused - avoided, transportByMode, transportByCountry };
}

/** Low / Base / High results for the same inputs. */
export function portfolioRange(inputs: PartnerInput[], factors: Factor[], elec: ElecMethod) {
  return {
    low: portfolioImpact(inputs, resolveParams(factors, 'low', elec)),
    base: portfolioImpact(inputs, resolveParams(factors, 'base', elec)),
    high: portfolioImpact(inputs, resolveParams(factors, 'high', elec)),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Caused emissions per kg of pellets for one partner (kg CO2e / kg), for comparison with LCA results. */
export function causedPerKgPellets(r: PartnerResult): number {
  return r.pellets > 0 ? r.caused / r.pellets / 1000 : 0;
}

/* ------------------------------------------------------------------ */
/* Customer: with LZP vs without                                       */
/* ------------------------------------------------------------------ */

export interface CustomerInput {
  /** Customer's film packaging, tonnes per year. */
  filmT: number;
  /** Share recycled today without LZP (0-1). */
  recycledShare: number;
  /** Share LZP would collect and recycle (0-1). */
  lzpShare: number;
}

export interface EndOfLife {
  recycledT: number;
  incineratedT: number;
  landfilledT: number;
  /** kg CO2e, each reported separately. */
  recyclingCaused: number;
  recyclingAvoided: number;
  incineration: number;
  landfill: number;
  caused: number;
  avoided: number;
  net: number;
}

export interface CustomerResult {
  without: EndOfLife;
  with: EndOfLife;
  /** without.net - with.net, kg CO2e. Positive = LZP lowers emissions. */
  reduction: number;
}

/**
 * Splits a customer's film into recycled and disposed, then applies the portfolio's average
 * caused and avoided intensity (kg CO2e per tonne input) to the recycled part. The disposed part
 * follows the EU split: incineration (E2 x E4) and landfill (E3 x E5).
 */
export function endOfLife(filmT: number, recycledShare: number, p: Params, causedPerT: number, avoidedPerT: number): EndOfLife {
  const share = Math.min(1, Math.max(0, recycledShare));
  const recycledT = filmT * share;
  const disposedT = filmT - recycledT;
  const incineratedT = disposedT * p.eolIncinerationShare;
  const landfilledT = disposedT * p.eolLandfillShare;
  const recyclingCaused = recycledT * causedPerT;
  const recyclingAvoided = recycledT * avoidedPerT;
  const incineration = incineratedT * p.incinerationKgPerT;
  const landfill = landfilledT * p.landfillKgPerT;
  const caused = recyclingCaused + incineration + landfill;
  return {
    recycledT, incineratedT, landfilledT,
    recyclingCaused, recyclingAvoided, incineration, landfill,
    caused, avoided: recyclingAvoided, net: caused - recyclingAvoided,
  };
}

export function customerComparison(input: CustomerInput, p: Params, portfolio: PortfolioResult): CustomerResult {
  const causedPerT = portfolio.tonnes > 0 ? portfolio.caused / portfolio.tonnes : 0;
  const avoidedPerT = portfolio.tonnes > 0 ? portfolio.avoided / portfolio.tonnes : 0;
  const without = endOfLife(input.filmT, input.recycledShare, p, causedPerT, avoidedPerT);
  // LZP never recycles less than is already recycled today.
  const withLzp = endOfLife(input.filmT, Math.max(input.lzpShare, input.recycledShare), p, causedPerT, avoidedPerT);
  return { without, with: withLzp, reduction: without.net - withLzp.net };
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

export interface Insight { id: string; text: string; value: number }

const share = (part: number, total: number) => (total > 0 ? part / total : 0);

/** Computed hotspot sentences. Country names are passed in so this file stays data-free. */
export function hotspotInsights(r: PortfolioResult, countryName: (c: CountryCode) => string): Insight[] {
  const out: Insight[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const countries = Object.entries(r.transportByCountry) as [CountryCode, number][];
  const totalTransport = r.stages.transport;
  if (countries.length && totalTransport > 0) {
    const [c, v] = countries.sort((a, b) => b[1] - a[1])[0];
    const tonnesShare = share(r.partners.filter((x) => x.country === c).reduce((a, x) => a + x.tonnes, 0), r.tonnes);
    out.push({
      id: 'transport-country',
      value: share(v, totalTransport),
      text: `Transport to ${countryName(c)} causes ${pct(share(v, totalTransport))} of transport emissions while carrying ${pct(tonnesShare)} of the tonnes.`,
    });
  }

  const stage = [...STAGES].sort((a, b) => r.stages[b] - r.stages[a])[0];
  out.push({
    id: 'top-stage',
    value: share(r.stages[stage], r.caused),
    text: `${stage[0].toUpperCase() + stage.slice(1)} is the largest source of caused emissions at ${pct(share(r.stages[stage], r.caused))}; ${stage === 'recycling' ? 'the grid of the recycling country matters most' : 'this is where reductions pay off first'}.`,
  });

  const avgCausedPerT = share(r.caused, r.tonnes);
  const meaningful = r.partners.filter((x) => x.tonnes >= 50);
  if (meaningful.length && avgCausedPerT > 0) {
    const worst = [...meaningful].sort((a, b) => b.causedPerT - a.causedPerT)[0];
    out.push({
      id: 'worst-partner',
      value: worst.causedPerT / avgCausedPerT,
      text: `${worst.name} has the highest caused intensity (${Math.round(worst.causedPerT)} kg CO2e/t), ${(worst.causedPerT / avgCausedPerT).toFixed(1)}x the portfolio average.`,
    });
  }
  return out;
}
