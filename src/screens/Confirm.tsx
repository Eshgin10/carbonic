import { motion } from 'framer-motion';
import { Calculator, MousePointerClick, Pencil, X } from 'lucide-react';
import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import type { Hotspot } from '../components/ShipmentScene';
import { MATERIALS } from '../lib/enrich';
import { num0 } from '../lib/format';
import { MODE_NAME, resolveOption, type PlanOption } from '../lib/planner';
import { EASE } from '../lib/theme';
import { useApp } from '../store/useApp';

// three.js is large, so the scene loads only when this window opens.
const ShipmentScene = lazy(() => import('../components/ShipmentScene').then((m) => ({ default: m.ShipmentScene })));

/** Flow question that changes each part of the scene. */
const STEP_OF: Record<Hotspot, number> = { cargo: 0, destination: 1, vehicle: 2, route: 2 };
const CASE_NAME = { low: 'Low case', base: 'Base case', high: 'High case' } as const;
const ELEC_NAME = { location: 'Grid average electricity', residual: 'LV residual mix electricity' } as const;

/**
 * Shown when Calculate is pressed: the shipment as a 3D scene plus a summary. Clicking anything
 * (in the scene or the list) jumps back to that question; Calculate again confirms.
 */
export function ConfirmShipment({ o, which, onEdit, onConfirm, onClose }: {
  o: PlanOption; which: 'a' | 'b'; onEdit: (step: number) => void; onConfirm: () => void; onClose: () => void;
}) {
  const partners = useApp((s) => s.partners);
  const scenario = useApp((s) => s.scenario);
  const elec = useApp((s) => s.elec);
  const meta = resolveOption(o, partners);
  const material = MATERIALS.find((m) => m.id === o.material)?.name ?? o.material;
  const mode = meta.input.mode;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const rows: { label: string; value: ReactNode; step?: number }[] = [
    { label: 'Load', value: `${num0(o.tonnes)} t ${material}`, step: 0 },
    { label: 'From (A)', value: 'Riga · LZP depot' },
    { label: 'To (B)', value: <>{meta.label}<span className="block text-[11px] font-normal text-muted">{meta.sub}</span></>, step: 1 },
    { label: 'Transport', value: `${MODE_NAME[mode]} · ${num0(o.km)} km${mode === 'road+ferry' ? ` (${num0(meta.input.seaKm ?? 0)} km by sea)` : ''}`, step: 2 },
    { label: 'Trip back', value: o.emptyReturn ? 'Returns empty' : 'Not counted (backhaul)', step: 2 },
    ...(which === 'a' ? [{ label: 'Calculation', value: `${CASE_NAME[scenario]} · ${ELEC_NAME[elec]}`, step: 3 }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-coal/45 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <motion.div
        role="dialog" aria-modal="true" aria-label="Check your shipment"
        initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="grid max-h-[94vh] w-full max-w-[1240px] overflow-hidden rounded-[28px] bg-white shadow-card lg:h-[min(760px,92vh)] lg:grid-cols-[1fr_340px]"
      >
        <div className="relative h-[52vh] bg-[#EEF1EF] lg:h-auto">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-coal" /></div>}>
            <ShipmentScene
              className="h-full w-full"
              tonnes={o.tonnes} material={material} mode={mode} km={o.km} seaKm={meta.input.seaKm ?? 0} emptyReturn={o.emptyReturn}
              destination={meta.label} onPick={(h) => onEdit(STEP_OF[h])}
            />
          </Suspense>
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold shadow-card backdrop-blur">
            <MousePointerClick size={13} /> Click the load, vehicle, route or plant to change it · drag to rotate
          </div>
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 font-mono text-[10px] text-muted shadow-card">Illustration · not to scale</div>
        </div>

        <div className="flex flex-col overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              {which === 'b' && <span className="mb-2 inline-block rounded-full bg-lime px-2.5 py-0.5 text-[11px] font-bold">Option B</span>}
              <h3 className="text-[24px] font-bold leading-tight tracking-[-0.03em]">Check your shipment</h3>
              <p className="mt-1 text-[13px] text-muted">Is this right? Change anything, or calculate.</p>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-paper hover:text-coal" aria-label="Close"><X size={16} /></button>
          </div>

          <ul className="mt-5 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.label}>
                {r.step === undefined ? (
                  <div className="flex items-start gap-3 py-3">
                    <span className="w-[86px] shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">{r.label}</span>
                    <span className="text-[13px] font-semibold">{r.value}</span>
                  </div>
                ) : (
                  <button onClick={() => onEdit(r.step!)} className="group flex w-full items-start gap-3 rounded-xl py-3 text-left transition-colors hover:bg-lime-100">
                    <span className="w-[86px] shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">{r.label}</span>
                    <span className="flex-1 text-[13px] font-semibold">{r.value}</span>
                    <Pencil size={13} className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-6">
            <button
              onClick={onConfirm}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-3.5 text-[16px] font-bold text-coal shadow-card transition-colors hover:bg-lime-600"
            >
              <Calculator size={18} /> Calculate
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">Confirms these inputs and shows the emissions.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
