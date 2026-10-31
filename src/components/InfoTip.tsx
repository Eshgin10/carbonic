import { AnimatePresence, motion } from 'framer-motion';
import { Info, ExternalLink } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pick } from '../lib/calc';
import { factorValue } from '../lib/format';
import { EASE } from '../lib/theme';
import { useApp } from '../store/useApp';
import { ConfidenceBadge, EstimatedChip } from './ui';

/**
 * The (i) next to every key number: formula, the numbers that went in, and each factor's
 * source, year and confidence.
 */
export function InfoTip({
  title, formula, calc, factorIds = [], note, dark = false, children,
}: { title: string; formula?: string; calc?: string; factorIds?: string[]; note?: ReactNode; dark?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const factors = useApp((s) => s.factors);
  const scenario = useApp((s) => s.scenario);
  const list = factorIds.map((id) => factors.find((f) => f.id === id)).filter(Boolean) as typeof factors;

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const w = 360;
    const left = Math.min(Math.max(12, r.left - w / 2), window.innerWidth - w - 12);
    const below = r.bottom + 8;
    const h = pop.current?.offsetHeight ?? 300;
    const top = below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 8) : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', () => setOpen(false), { once: true, capture: true });
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`Source and method: ${title}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${dark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-[#ECEEEA] hover:text-ink'}`}
      >
        {children ?? <Info size={13} strokeWidth={1.8} />}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={pop}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: EASE }}
              style={{ top: pos.top, left: pos.left, width: 360 }}
              className="fixed z-[2000] max-h-[70vh] overflow-auto rounded-2xl border border-line bg-white p-4 text-left text-ink shadow-card"
            >
              <div className="text-[13px] font-medium">{title}</div>
              {formula && <div className="mt-2 rounded-lg bg-paper px-2.5 py-1.5 font-mono text-[11px] leading-relaxed">{formula}</div>}
              {calc && <div className="mt-1.5 font-mono text-[11px] leading-relaxed text-muted">{calc}</div>}
              {note && <div className="mt-2 text-[12px] leading-relaxed text-muted">{note}</div>}
              {list.length > 0 && (
                <ul className="mt-3 space-y-2.5 border-t border-line pt-3">
                  {list.map((f) => (
                    <li key={f.id} className="text-[12px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-muted">{f.id}</span>
                        <span className="font-medium">{f.parameter}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums">
                        {factorValue(pick(f, scenario))} {f.unit}
                        {(f.low !== null || f.high !== null) && (
                          <span className="text-muted"> · range {factorValue(f.low ?? f.base)}–{factorValue(f.high ?? f.base)}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ConfidenceBadge level={f.confidence} />
                        {f.estimated && <EstimatedChip />}
                        <span className="text-[11px] text-muted">{f.year ?? 'no year'}</span>
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-muted">
                        {f.source}
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-forest-700 underline-offset-2 hover:underline">
                            link <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
