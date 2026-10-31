export type CountryCode = 'LV' | 'LT' | 'EE' | 'PL' | 'FI' | 'UA';
export type Mode = 'road' | 'rail' | 'road+ferry';
export type Confidence = 'High' | 'Medium' | 'Low';
export type Scenario = 'low' | 'base' | 'high';
export type ElecMethod = 'location' | 'residual';

/** One emission factor or model parameter, always with provenance. */
export interface Factor {
  id: string;
  group: string;
  parameter: string;
  base: number | null;
  low: number | null;
  high: number | null;
  unit: string;
  source: string;
  url?: string;
  year: number | null;
  confidence: Confidence;
  status: string;
  /** True when no primary/literature source exists and the value is our approximation. */
  estimated: boolean;
  notes?: string;
  /** +1 if a higher value raises NET emissions, -1 if it lowers them. Used to build Low/High cases. */
  direction?: 1 | -1;
  /** Where the row came from: the workbook "Assumptions" sheet, or the curated extra list. */
  origin: 'workbook' | 'lca-report' | 'literature' | 'climatiq' | 'estimate';
  material?: string;
}

/** A partner row as it appears in the workbook (Partners sheet). */
export interface RawPartner {
  name: string;
  countryRaw: string;
  country: CountryCode | null;
  totalT: number;
  filmT: number;
  share: number;
  location: string;
  process: string;
  capacityT: number | null;
  distanceKm: number | null;
  researchStatus: string;
  sources: string;
}

/** A partner enriched with map location and editable model inputs. */
export interface Partner extends RawPartner {
  id: string;
  country: CountryCode;
  lat: number;
  lng: number;
  locationVerified: boolean;
  /** Distance used by the model (workbook value, else country default D1-D6). */
  km: number;
  distanceEstimated: boolean;
  mode: Mode;
  /** Sea leg for road+ferry routes. */
  seaKm: number;
  yieldOverride: number | null;
  kwhOverride: number | null;
  /** Partner-specific override notes (e.g. Nordic Plast LCA). */
  overrideSource?: string;
}

export interface CountrySummary {
  countryRaw: string;
  country: CountryCode | null;
  totalT: number;
  filmT: number;
  share: number;
  partners: number;
}

export interface RawDataRow {
  polymer: string;
  intermediary: string;
  recycler: string;
  countryRaw: string;
  quantityT: number;
  recyclerNormalized: string;
  film: boolean;
}

export interface Material {
  id: string;
  name: string;
  status: 'active' | 'coming-soon' | 'reference';
  note: string;
}
