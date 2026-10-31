import { describe, expect, it } from 'vitest';
import assumptions from '../../data/assumptions.json';
import rawPartners from '../../data/partners.json';
import {
  causedPerKgPellets, customerComparison, partnerImpact, pick, portfolioImpact, resolveParams, routeTkm,
  type Params, type PartnerInput,
} from './calc';
import { enrichPartners, mergeFactors } from './enrich';
import type { Factor, RawPartner } from './types';

const factors = mergeFactors(assumptions as Factor[]);
const partners = enrichPartners(rawPartners as RawPartner[], factors);
const toInput = (p: (typeof partners)[number]): PartnerInput => ({ ...p, tonnes: p.filmT });

const simple: Params = {
  scenario: 'base', elecMethod: 'location',
  collectionKgPerT: 10, sortingKwhPerT: 50, grid: { LV: 0.1, LT: 0.2, EE: 0.3, PL: 0.5, FI: 0.05, UA: 0.25 },
  roadKgPerTkm: 0.1, railKgPerTkm: 0.03, seaKgPerTkm: 0.05, emptyReturnShare: 0.6,
  yieldDefault: 0.8, kwhPerTPellets: 1000, virginKgPerT: 2000, substitution: 0.8,
  incinerationKgPerT: 3000, landfillKgPerT: 0, eolRecycledShare: 0.41, eolIncinerationShare: 0.528, eolLandfillShare: 0.472,
};

describe('partnerImpact', () => {
  it('applies each stage formula and keeps caused and avoided separate', () => {
    const r = partnerImpact({ id: 'x', name: 'X', country: 'PL', tonnes: 100, km: 500, mode: 'road' }, simple);
    expect(r.stages.collection).toBeCloseTo(100 * 10);
    expect(r.stages.sorting).toBeCloseTo(100 * 50 * 0.1);
    expect(r.stages.transport).toBeCloseTo(100 * 500 * 0.1);
    expect(r.pellets).toBeCloseTo(80);
    expect(r.stages.recycling).toBeCloseTo(80 * 1000 * 0.5);
    expect(r.caused).toBeCloseTo(1000 + 500 + 5000 + 40000);
    expect(r.avoided).toBeCloseTo(80 * 0.8 * 2000);
    expect(r.net).toBeCloseTo(r.caused - r.avoided);
  });

  it('uses partner overrides for yield and electricity', () => {
    const r = partnerImpact({ id: 'n', name: 'N', country: 'LV', tonnes: 10, km: 0, mode: 'road', yieldOverride: 0.66, kwhOverride: 1088 }, simple);
    expect(r.pellets).toBeCloseTo(6.6);
    expect(r.stages.recycling).toBeCloseTo(6.6 * 1088 * 0.1);
  });

  it('adds the empty return leg only when requested', () => {
    const base = { id: 'x', name: 'X', country: 'PL' as const, tonnes: 10, km: 100, mode: 'road' as const };
    expect(partnerImpact(base, simple).stages.transport).toBeCloseTo(100);
    expect(partnerImpact({ ...base, emptyReturn: true }, simple).stages.transport).toBeCloseTo(160);
  });

  it('splits road+ferry routes into road and sea tonne-km', () => {
    expect(routeTkm(10, 750, 'road+ferry', 80)).toEqual({ road: 6700, rail: 0, sea: 800 });
    expect(routeTkm(10, 750, 'rail')).toEqual({ road: 0, rail: 7500, sea: 0 });
  });
});

describe('scenarios', () => {
  it('low/high pick the bound that lowers/raises net emissions', () => {
    const yieldF = factors.find((f) => f.id === 'P3')!;
    expect(pick(yieldF, 'low')).toBe(0.85); // more pellets -> more avoided -> lower net
    expect(pick(yieldF, 'high')).toBe(0.66);
    const collection = factors.find((f) => f.id === 'P4')!;
    expect(pick(collection, 'low')).toBe(5);
    expect(pick(collection, 'high')).toBe(40);
  });

  it('orders portfolio net as low <= base <= high', () => {
    const inputs = partners.filter((p) => p.filmT > 0).map(toInput);
    const [low, base, high] = (['low', 'base', 'high'] as const).map((s) => portfolioImpact(inputs, resolveParams(factors, s, 'location')).net);
    expect(low).toBeLessThan(base);
    expect(base).toBeLessThan(high);
  });
});

describe('portfolio with bundled data', () => {
  const inputs = partners.filter((p) => p.filmT > 0).map(toInput);
  const r = portfolioImpact(inputs, resolveParams(factors, 'base', 'location'));

  it('processes the ~11,860 t of film in the workbook', () => {
    expect(r.tonnes).toBeGreaterThan(11800);
    expect(r.tonnes).toBeLessThan(11900);
  });

  it('sums stages to caused', () => {
    const sum = r.stages.collection + r.stages.sorting + r.stages.transport + r.stages.recycling;
    expect(sum).toBeCloseTo(r.caused, 6);
  });

  it('gives a Nordic Plast intensity in the plausible range of the LCA benchmark', () => {
    const np = r.partners.find((p) => /nordic/i.test(p.name))!;
    const residual = portfolioImpact([toInput(partners.find((p) => p.id === np.id)!)], resolveParams(factors, 'base', 'residual'));
    const perKg = causedPerKgPellets(residual.partners[0]);
    // Model covers fewer processes than the LCA (~1.0 kg/kg incl. distribution) but should be same order.
    expect(perKg).toBeGreaterThan(0.3);
    expect(perKg).toBeLessThan(1.2);
  });
});

describe('customerComparison', () => {
  it('reduces emissions when LZP recycles the non-recycled share', () => {
    const portfolio = portfolioImpact([{ id: 'a', name: 'A', country: 'LV', tonnes: 100, km: 50, mode: 'road' }], simple);
    const c = customerComparison({ filmT: 100, recycledShare: 0.41, lzpShare: 1 }, simple, portfolio);
    expect(c.without.incineratedT).toBeCloseTo(59 * 0.528);
    expect(c.without.incineration).toBeCloseTo(59 * 0.528 * 3000);
    expect(c.with.incineratedT).toBe(0);
    const netPerT = portfolio.net / portfolio.tonnes;
    expect(c.reduction).toBeCloseTo(59 * (0.528 * 3000 - netPerT));
    expect(c.reduction).toBeGreaterThan(0);
  });
});
