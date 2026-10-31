import { useMemo } from 'react';
import { portfolioImpact, resolveParams, type PartnerInput } from '../lib/calc';
import type { ElecMethod, Factor } from '../lib/types';
import { useApp } from './useApp';

export function paramsFor(factors: Factor[], elec: ElecMethod) {
  return { low: resolveParams(factors, 'low', elec), base: resolveParams(factors, 'base', elec), high: resolveParams(factors, 'high', elec) };
}

/** Low/Base/High parameters for the current Electricity setting, plus the active case. */
export function useParams() {
  const factors = useApp((s) => s.factors);
  const scenario = useApp((s) => s.scenario);
  const elec = useApp((s) => s.elec);
  return useMemo(() => {
    const all = paramsFor(factors, elec);
    return { all, active: all[scenario], scenario, elec };
  }, [factors, scenario, elec]);
}

/** Runs the same inputs through Low, Base and High. */
export function runRange(inputs: PartnerInput[], all: ReturnType<typeof paramsFor>) {
  return { low: portfolioImpact(inputs, all.low), base: portfolioImpact(inputs, all.base), high: portfolioImpact(inputs, all.high) };
}
