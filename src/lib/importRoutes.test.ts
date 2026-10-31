import { describe, expect, it } from 'vitest';
import assumptions from '../../data/assumptions.json';
import rawPartners from '../../data/partners.json';
import { enrichPartners, mergeFactors } from './enrich';
import { parseRouteRows, sampleRows } from './importRoutes';
import type { Factor, RawPartner } from './types';

const factors = mergeFactors(assumptions as Factor[]);
const partners = enrichPartners(rawPartners as RawPartner[], factors);

describe('parseRouteRows', () => {
  it('keeps rows that match the database and skips the rest', () => {
    const p = partners.find((x) => x.filmT > 0)!;
    const res = parseRouteRows([
      { Destination: p.name, Tonnes: 24, Mode: 'Truck' },
      { destination: 'helsinki', 'Weight (t)': '12,5', transport: 'truck + ferry' },
      { Destination: 'Riga', Tonnes: 10, Material: 'Glass' },
      { Destination: 'Nowhere Recycling', Tonnes: 10 },
      { Destination: 'Kaunas', Tonnes: 0 },
      { Destination: 'Kaunas', Tonnes: 5, Mode: 'balloon' },
    ], partners, factors);
    expect(res.total).toBe(6);
    expect(res.skipped).toBe(4);
    expect(res.rows[0].option.partnerId).toBe(p.id);
    expect(res.rows[1].option).toMatchObject({ destKind: 'city', cityId: expect.any(String), mode: 'road+ferry', tonnes: 12.5 });
  });

  it('the sample sheet has exactly two rows the database cannot answer', () => {
    const rows = sampleRows(partners);
    expect(parseRouteRows(rows, partners, factors).skipped).toBe(2);
  });
});
