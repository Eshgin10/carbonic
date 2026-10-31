import { scaleLinear } from 'd3-scale';

/** Caleo style guide palette. */
export const C = {
  lime: '#DCFF00',
  lime600: '#B8D600',
  lime700: '#8FA600',
  olive: '#292C0A',
  stone: '#AFB8B4',
  coal: '#131313',
  paper: '#E7EBE9',
  line: '#D6DBD8',
  muted: '#5E6662',
  amber: '#C8902B',
};

/** Chart semantics: caused = coal, avoided = lime, net = olive. */
export const SERIES = { caused: C.coal, avoided: C.lime, net: C.olive };

export const STAGE_COLORS: Record<string, string> = {
  collection: C.lime,
  sorting: C.lime600,
  transport: C.lime700,
  recycling: C.olive,
};

export const MODE_COLORS: Record<string, string> = { road: C.coal, 'road+ferry': C.lime700, rail: C.lime600 };

/** Route colour by caused intensity (kg CO2e per tonne): lime -> olive -> coal. */
export function intensityScale(max: number) {
  const m = Math.max(max, 1);
  return scaleLinear<string>()
    .domain([0, m * 0.5, m])
    .range([C.lime600, C.olive, C.coal])
    .clamp(true);
}

export const EASE = [0.22, 1, 0.36, 1] as const;
