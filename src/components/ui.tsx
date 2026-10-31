import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Confidence } from '../lib/types';
import { EASE } from '../lib/theme';

export function Card({
  children, className = '', pins = false, dark = false, delay = 0, as = 'section',
}: { children: ReactNode; className?: string; pins?: boolean; dark?: boolean | 'lime'; delay?: number; as?: 'section' | 'div' }) {
  const reduce = useReducedMotion();
  const Comp = as === 'div' ? motion.div : motion.section;
  return (
    <Comp
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={`relative rounded-card ${dark === 'lime' ? 'bg-lime text-coal' : dark ? 'bg-coal text-white' : 'bg-white shadow-card'} ${className}`}
    >
      {pins && <Pins dark={dark === true} />}
      {children}
    </Comp>
  );
}

/** Small corner "pin" dots, as on mounted panels. */
export function Pins({ dark = false }: { dark?: boolean }) {
  const cls = `absolute h-[7px] w-[7px] rounded-full ${dark ? 'bg-white/15' : 'bg-line'}`;
  return (
    <>
      <span className={`${cls} left-3 top-3`} />
      <span className={`${cls} right-3 top-3`} />
      <span className={`${cls} left-3 bottom-3`} />
      <span className={`${cls} right-3 bottom-3`} />
    </>
  );
}

export function CardTitle({ children, right, sub }: { children: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Button({
  children, variant = 'primary', onClick, className = '', disabled, title, type = 'button',
}: {
  children: ReactNode; variant?: 'primary' | 'lime' | 'secondary' | 'ghost' | 'light'; onClick?: () => void; className?: string;
  disabled?: boolean; title?: string; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-coal text-white hover:bg-olive',
    lime: 'bg-lime text-coal hover:bg-lime-600',
    secondary: 'bg-paper text-coal hover:bg-line',
    ghost: 'text-coal hover:bg-paper',
    light: 'bg-white text-coal hover:bg-lime-100',
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'mint' | 'amber' | 'dark' | 'outline'; className?: string }) {
  const t = {
    neutral: 'bg-paper text-coal',
    mint: 'bg-lime text-coal',
    amber: 'bg-amber/10 text-amber',
    dark: 'bg-white/10 text-white',
    outline: 'border border-line text-muted',
  }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t} ${className}`}>{children}</span>;
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  const tone = level === 'High' ? 'bg-coal text-lime' : level === 'Medium' ? 'bg-lime-100 text-olive' : 'bg-amber/15 text-amber';
  return <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tone}`}>{level}</span>;
}

export function EstimatedChip({ label = 'Estimated' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
      <span className="h-1.5 w-1.5 rounded-full bg-amber" />
      {label}
    </span>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, size = 'md', dark = false,
}: { value: T; options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; dark?: boolean }) {
  return (
    <div className={`inline-flex rounded-full p-1 ${dark ? 'bg-white/10' : 'bg-paper'}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full ${size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-[12.5px]'} font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? (dark ? 'text-coal' : 'text-lime') : dark ? 'text-white/70 hover:text-white' : 'text-muted hover:text-coal'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join('')}`}
                className={`absolute inset-0 rounded-full ${dark ? 'bg-lime' : 'bg-coal'}`}
                transition={{ duration: 0.35, ease: EASE }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Count-up / morphing number. `format` receives the animated value. */
/**
 * True once the element has scrolled into view (and stays true). Used so the few numbers and
 * bars that deserve attention animate when the user reaches them, not while off-screen.
 */
export function useSeen<T extends Element>(amount = 0.5) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduce = useReducedMotion();
  return [ref, inView || Boolean(reduce)] as const;
}

/**
 * Number that counts up from zero the first time it scrolls into view, then morphs smoothly
 * on later changes. A short scale "landing" marks the end of the first count.
 */
export function AnimatedNumber({ value, format, duration = 0.9, className = '' }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [ref, seen] = useSeen<HTMLSpanElement>(0.6);
  const [display, setDisplay] = useState(reduce ? value : 0);
  const [landed, setLanded] = useState(false);
  const prev = useRef(reduce ? value : 0);
  const first = useRef(true);
  useEffect(() => {
    if (reduce) { setDisplay(value); prev.current = value; return; }
    if (!seen) return;
    const isFirst = first.current;
    first.current = false;
    const controls = animate(prev.current, value, {
      duration: isFirst ? Math.max(duration, 1.2) : duration,
      ease: EASE as unknown as [number, number, number, number],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => { if (isFirst) setLanded(true); },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration, reduce, seen]);
  return (
    <motion.span
      ref={ref}
      className={`inline-block tabular-nums ${className}`}
      style={{ transformOrigin: 'left bottom' }}
      animate={landed ? { scale: [1, 1.045, 1] } : undefined}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {format(display)}
    </motion.span>
  );
}

/**
 * Bar that fills to `value` (0-1) when scrolled into view, then sweeps a light sheen across once
 * to draw the eye. Later value changes resize it smoothly.
 */
export function GrowBar({ value, color, delay = 0, height = 'h-2.5', track = 'bg-paper', outline }: {
  value: number; color: string; delay?: number; height?: string; track?: string; outline?: string;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.8);
  const w = `${Math.max(0, Math.min(1, value)) * 100}%`;
  return (
    <div ref={ref} className={`${height} overflow-hidden rounded-full ${track}`}>
      <motion.div
        className="relative h-full overflow-hidden rounded-full"
        style={{ background: color, boxShadow: outline ? `inset 0 0 0 1px ${outline}` : undefined }}
        initial={{ width: 0 }}
        animate={{ width: seen ? w : 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: seen ? delay : 0 }}
      >
        {seen && (
          <motion.span
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
            initial={{ x: '-120%' }} animate={{ x: '260%' }}
            transition={{ duration: 0.9, ease: 'easeInOut', delay: delay + 0.75 }}
          />
        )}
      </motion.div>
    </div>
  );
}

export function Unit({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] tracking-tight text-muted ${className}`}>{children}</span>;
}

/** Horizontal Low-Base-High range bar. Values in the same unit. */
export function RangeBar({ low, base, high, format, dark = false, labels = ['Low', 'Base', 'High'] }: {
  low: number; base: number; high: number; format: (n: number) => string; dark?: boolean; labels?: [string, string, string];
}) {
  const min = Math.min(low, high, base);
  const max = Math.max(low, high, base);
  const span = max - min || 1;
  const pos = ((base - min) / span) * 100;
  const [ref, seen] = useSeen<HTMLDivElement>(0.8);
  return (
    <div ref={ref} className="w-full">
      <div className={`relative h-2 rounded-full ${dark ? 'bg-white/10' : 'bg-paper'}`}>
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${dark ? 'bg-lime/35' : 'bg-lime/60'}`}
          initial={{ width: 0 }} animate={{ width: seen ? '100%' : 0 }} transition={{ duration: 0.9, ease: EASE }}
        />
        <motion.div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${dark ? 'border-coal bg-lime' : 'border-white bg-coal'} shadow`}
          initial={{ left: '0%', scale: 0 }}
          animate={seen ? { left: `${pos}%`, scale: 1 } : { left: '0%', scale: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: seen ? 0.35 : 0 }}
        />
      </div>
      <div className={`mt-2 flex justify-between font-mono text-[11px] tabular-nums ${dark ? 'text-white/60' : 'text-muted'}`}>
        <span>{labels[0]} {format(Math.min(low, high))}</span>
        <span className={dark ? 'text-white' : 'text-coal'}>{labels[1]} {format(base)}</span>
        <span>{labels[2]} {format(Math.max(low, high))}</span>
      </div>
    </div>
  );
}
