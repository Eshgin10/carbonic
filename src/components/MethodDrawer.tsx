import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { useMemo } from 'react';
import { causedPerKgPellets, partnerImpact, pick, resolveParams } from '../lib/calc';
import { factorValue, num2 } from '../lib/format';
import { CUSTOMER_FORMULAS, FORMULAS, LIMITATIONS, STANDARDS, SYSTEM_BOUNDARY } from '../lib/method';
import { EASE } from '../lib/theme';
import type { Factor } from '../lib/types';
import { useApp } from '../store/useApp';
import { ConfidenceBadge, EstimatedChip } from './ui';

/** Nordic Plast model result vs the LCA report and literature. */
export function useValidation() {
  const partners = useApp((s) => s.partners);
  const factors = useApp((s) => s.factors);
  const scenario = useApp((s) => s.scenario);
  const elec = useApp((s) => s.elec);
  return useMemo(() => {
    const np = partners.find((p) => /nordic plast/i.test(p.name));
    if (!np) return null;
    const input = { ...np, tonnes: np.filmT || 1 };
    const current = causedPerKgPellets(partnerImpact(input, resolveParams(factors, scenario, elec)));
    const residual = causedPerKgPellets(partnerImpact(input, resolveParams(factors, 'base', 'residual')));
    const bench = (factors.find((f) => f.id === 'B1')?.base ?? 1000) / 1000;
    const v2 = factors.find((f) => f.id === 'V2');
    return { current, residual, bench, litLow: (v2?.low ?? 440) / 1000, litHigh: (v2?.high ?? 510) / 1000 };
  }, [partners, factors, scenario, elec]);
}

export function ValidationLine({ compact = false }: { compact?: boolean }) {
  const v = useValidation();
  if (!v) return null;
  return (
    <div className={`rounded-2xl border border-line bg-paper ${compact ? 'p-3' : 'p-4'} text-[12px] leading-relaxed`}>
      <div className="font-medium text-ink">Validation · Nordic Plast, caused per kg pellets</div>
      <div className="mt-2 grid grid-cols-3 gap-2 font-mono tabular-nums">
        <div><div className="text-[10px] uppercase text-muted">Model (residual mix)</div><div className="text-[15px]">{num2(v.residual)}</div></div>
        <div><div className="text-[10px] uppercase text-muted">LCA report</div><div className="text-[15px]">~{num2(v.bench)}</div></div>
        <div><div className="text-[10px] uppercase text-muted">Literature</div><div className="text-[15px]">{num2(v.litLow)}–{num2(v.litHigh)}</div></div>
      </div>
      <p className="mt-2 text-muted">
        kg CO2e/kg. With the current settings the model gives {num2(v.current)}. The model is {v.residual < v.litLow ? 'below' : v.residual > v.litHigh ? 'above' : 'within'} the
        literature range and {Math.round((1 - v.residual / v.bench) * 100)}% below the LCA report, which also covers water, additives, heat and distribution. Treat model results as a
        conservative lower bound for caused emissions.
      </p>
    </div>
  );
}

export function FactorRows({ factors }: { factors: Factor[] }) {
  const scenario = useApp((s) => s.scenario);
  const groups = [...new Set(factors.map((f) => f.group))];
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">{g}</div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
            {factors.filter((f) => f.group === g).map((f) => (
              <li key={f.id} className="px-3.5 py-2.5 text-[12px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="mr-1.5 font-mono text-[10px] text-muted">{f.id}</span>
                    <span className="font-medium">{f.parameter}</span>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] tabular-nums">
                    {factorValue(pick(f, scenario))}
                    {(f.low !== null || f.high !== null) && <span className="text-muted"> ({factorValue(f.low ?? f.base)}–{factorValue(f.high ?? f.base)})</span>}
                    <div className="text-[10px] text-muted">{f.unit}</div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ConfidenceBadge level={f.confidence} />
                  {f.estimated && <EstimatedChip label={/verify/i.test(f.status) ? 'Estimated, verify' : 'Estimated'} />}
                  <span className="text-[11px] text-muted">{f.year ?? 'no year'} · {f.status}</span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-muted">
                  {f.source}
                  {f.url && (
                    <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-forest-700 hover:underline">
                      source <ExternalLink size={10} />
                    </a>
                  )}
                  {f.notes && <div className="mt-0.5 italic">{f.notes}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function MethodDrawer() {
  const open = useApp((s) => s.methodOpen);
  const setOpen = useApp((s) => s.setMethodOpen);
  const factors = useApp((s) => s.factors);
  const elec = useApp((s) => s.elec);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[1500] bg-ink/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            role="dialog" aria-label="Method and sources"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.45, ease: EASE }}
            className="fixed inset-y-0 right-0 z-[1600] w-full max-w-[560px] overflow-y-auto bg-paper shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/90 px-6 py-4 backdrop-blur">
              <div>
                <div className="text-[20px] font-light tracking-tight">Method & sources</div>
                <div className="text-[12px] text-muted">Every number in the tool comes from these formulas and factors.</div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-[#ECEEEA]" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="space-y-7 px-6 py-6">
              <section>
                <h4 className="mb-2 text-[13px] font-medium">Formulas (per partner, then summed)</h4>
                <ul className="space-y-1.5">
                  {FORMULAS.map((f) => (
                    <li key={f.label} className="grid grid-cols-[96px_1fr] gap-3 text-[12px]">
                      <span className={`font-mono text-[11px] ${/^[A-Z]+$/.test(f.label) ? 'font-semibold text-ink' : 'text-muted'}`}>{f.label}</span>
                      <span className="font-mono text-[11px]">{f.formula}</span>
                    </li>
                  ))}
                </ul>
                <h4 className="mb-2 mt-5 text-[13px] font-medium">Customer “with LZP vs without”</h4>
                <ul className="list-disc space-y-1 pl-4 font-mono text-[11px]">{CUSTOMER_FORMULAS.map((f) => <li key={f}>{f}</li>)}</ul>
              </section>
              <section className="space-y-2 text-[12px] leading-relaxed text-muted">
                <h4 className="text-[13px] font-medium text-ink">System boundary and standards</h4>
                <p>{SYSTEM_BOUNDARY}</p>
                <p>{STANDARDS}</p>
                <p>
                  <span className="text-ink">Uncertainty.</span> Low and High set every ranged factor to the bound that lowers or raises the NET result. Factors without a range stay at Base.
                </p>
                <p>
                  <span className="text-ink">Electricity ({elec === 'location' ? 'location-based, active' : 'Latvian residual mix, active'}).</span> Location-based uses country grid averages (G1–G6).
                  The residual-mix option replaces only the Latvian factor with 0.452 kg CO2e/kWh from the Nordic Plast LCA.
                </p>
              </section>
              <ValidationLine />
              <section>
                <h4 className="mb-3 text-[13px] font-medium">Factors</h4>
                <FactorRows factors={factors} />
              </section>
              <section>
                <h4 className="mb-2 text-[13px] font-medium">Not available — estimated</h4>
                <ul className="space-y-2 text-[12px] leading-relaxed text-muted">
                  {LIMITATIONS.map((l) => <li key={l.title}><span className="text-ink">{l.title}.</span> {l.text}</li>)}
                </ul>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
