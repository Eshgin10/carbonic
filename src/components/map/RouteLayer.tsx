import { useReducedMotion } from 'framer-motion';
import { Ship, TrainFront, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COUNTRY_NAMES } from '../../lib/enrich';
import { MODE_LABEL, num0, num1, num2 } from '../../lib/format';
import { C, intensityScale } from '../../lib/theme';
import type { CountryCode, Mode } from '../../lib/types';

export interface RouteDatum {
  id: string;
  name: string;
  country: CountryCode;
  mode: Mode;
  tonnes: number;
  km: number;
  lat: number;
  lng: number;
  verified: boolean;
  /** Caused kg CO2e per tonne input (route colour). */
  causedPerT: number;
  /** Transport kg CO2e for the tooltip formula. */
  transportKg: number;
  transportFactor: number;
  /** Fixed colour (e.g. option A / B); otherwise coloured by intensity. */
  color?: string;
  /** Fixed line width, overriding the tonnes-based width. */
  width?: number;
  /** Draw only the line: no moving dots, mode icon or end node (routes already tried while scanning). */
  quiet?: boolean;
}

export type Project = (lat: number, lng: number) => [number, number];

interface Props {
  routes: RouteDatum[];
  project: Project;
  width: number;
  height: number;
  origin: { lat: number; lng: number; name: string };
  maxTonnes?: number;
  maxIntensity?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
}

function curve(o: [number, number], p: [number, number]) {
  const [x1, y1] = o, [x2, y2] = p;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(0.22, 40 / len + 0.12);
  const cx = mx - dy * k, cy = my + dx * k;
  const mid: [number, number] = [0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2];
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, mid, len };
}

const ModeIcon = ({ mode, x, y }: { mode: Mode; x: number; y: number }) => {
  if (mode === 'road+ferry') {
    // Two vehicles: the truck drives on and off the ferry.
    return (
      <g pointerEvents="none">
        <rect x={x - 19} y={y - 9} width={38} height={18} rx={9} fill="white" stroke={C.line} />
        <Truck x={x - 15} y={y - 5.5} width={11} height={11} color={C.olive} strokeWidth={2} />
        <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.olive}>+</text>
        <Ship x={x + 4} y={y - 5.5} width={11} height={11} color={C.olive} strokeWidth={2} />
      </g>
    );
  }
  const Icon = mode === 'rail' ? TrainFront : Truck;
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={9} fill="white" stroke={C.line} />
      <Icon x={x - 5.5} y={y - 5.5} width={11} height={11} color={C.olive} strokeWidth={2} />
    </g>
  );
};

export function RouteLayer({ routes, project, width, height, origin, maxTonnes, maxIntensity, selectedId, onSelect, compact }: Props) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const maxT = maxTonnes ?? Math.max(1, ...routes.map((r) => r.tonnes));
  const color = useMemo(() => intensityScale(maxIntensity ?? Math.max(1, ...routes.map((r) => r.causedPerT))), [routes, maxIntensity]);
  const o = project(origin.lat, origin.lng);
  const maxLen = Math.max(1, ...routes.map((r) => r.km));

  const drawn = routes
    .filter((r) => r.tonnes > 0)
    .sort((a, b) => b.tonnes - a.tonnes)
    .map((r) => {
      const p = project(r.lat, r.lng);
      const g = curve(o, p);
      const w = r.width ?? (compact ? 1 : 1.6) + (compact ? 6 : 11) * Math.sqrt(r.tonnes / maxT);
      return { r, p, ...g, w, stroke: r.color ?? color(r.causedPerT) };
    });
  const hovered = hover ? drawn.find((d) => d.r.id === hover.id) : null;

  return (
    <>
      <svg width={width} height={height} className="pointer-events-none absolute inset-0 z-[400]" aria-label="Routes from Riga to recycling partners">
        {drawn.map(({ r, d, w, stroke }) => {
          const active = selectedId === r.id || hover?.id === r.id;
          const dim = (selectedId || hover) && !active;
          return (
            <g key={r.id} opacity={dim ? 0.35 : 1} style={{ transition: 'opacity 200ms cubic-bezier(.22,1,.36,1)' }}>
              <path
                d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round"
                strokeDasharray={r.verified ? undefined : `0.1 ${Math.max(5, w * 1.8)}`}
                opacity={r.verified ? 0.85 : 0.75}
              />
              {/* Fat invisible hit area. */}
              <path
                d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, w + 8)} className="pointer-events-auto cursor-pointer"
                onMouseMove={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({ id: r.id, x: e.clientX - box.left, y: e.clientY - box.top });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(r.id)}
              />
              {!reduce && !compact && !r.quiet &&
                [0, 0.5].map((off) => {
                  const dur = 6 + 4 * (r.km / maxLen);
                  return (
                    <circle key={off} r={Math.max(1.8, Math.min(3.2, w / 3))} fill="white" stroke={stroke} strokeWidth={1} pointerEvents="none">
                      <animateMotion dur={`${dur}s`} begin={`${-off * dur}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  );
                })}
            </g>
          );
        })}
        {!compact &&
          drawn.filter((x) => !x.r.quiet && (x.r.tonnes / maxT > 0.08 || x.r.mode !== 'road')).map(({ r, mid }) => <ModeIcon key={`m-${r.id}`} mode={r.mode} x={mid[0]} y={mid[1]} />)}
        {drawn.filter((x) => !x.r.quiet).map(({ r, p, stroke }) => (
          <circle
            key={`n-${r.id}`} cx={p[0]} cy={p[1]} r={compact ? 3 : 4.5} fill="white" stroke={stroke} strokeWidth={2}
            strokeDasharray={r.verified ? undefined : '2 2'} className="pointer-events-auto cursor-pointer"
            onClick={() => onSelect?.(r.id)}
            onMouseEnter={() => setHover({ id: r.id, x: p[0], y: p[1] })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <g pointerEvents="none">
          <circle cx={o[0]} cy={o[1]} r={compact ? 6 : 9} fill={C.coal} />
          <circle cx={o[0]} cy={o[1]} r={compact ? 2.5 : 3.5} fill={C.lime} />
          {!compact && (
            <text x={o[0] + 13} y={o[1] - 10} className="fill-ink font-mono text-[11px] font-medium">Riga · LZP</text>
          )}
        </g>
      </svg>
      {hovered && !compact && (
        <div
          className="pointer-events-none absolute z-[500] w-64 rounded-xl border border-line bg-white/95 p-3 text-[12px] shadow-card backdrop-blur"
          style={{ left: Math.min(hover!.x + 14, width - 270), top: Math.max(8, Math.min(hover!.y + 14, height - 170)) }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium leading-tight">{hovered.r.name}</div>
            {!hovered.r.verified && <span className="whitespace-nowrap rounded-full bg-amber/10 px-2 py-0.5 text-[10px] text-amber">Verify with LZP</span>}
          </div>
          <div className="mt-0.5 text-muted">{COUNTRY_NAMES[hovered.r.country]} · {MODE_LABEL[hovered.r.mode]}{!hovered.r.verified && ' · location unverified'}</div>
          <div className="mt-2 rounded-lg bg-paper px-2 py-1.5 font-mono text-[10.5px] leading-relaxed">
            Transport = t × km × factor
            <br />= {num0(hovered.r.tonnes)} × {num0(hovered.r.km)} × {num2(hovered.r.transportFactor)} kg
            <br />= {num1(hovered.r.transportKg / 1000)} t CO2e
          </div>
          <div className="mt-1.5 font-mono text-[11px] tabular-nums">Caused intensity {num0(hovered.r.causedPerT)} kg CO2e/t</div>
        </div>
      )}
    </>
  );
}

export function MapLegend({ maxIntensity }: { maxIntensity: number }) {
  const color = intensityScale(maxIntensity);
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => color(t * maxIntensity));
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted">
      <div className="flex items-center gap-2">
        <span>Caused intensity</span>
        <span className="h-1.5 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
        <span className="font-mono">0–{num0(maxIntensity)} kg CO2e/t</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-[2px] w-5 bg-forest-700" /><span className="inline-block h-[6px] w-5 rounded-full bg-forest-700" />
        <span>width = tonnes</span>
      </div>
      <div className="flex items-center gap-2">
        <svg width="26" height="6"><line x1="2" y1="3" x2="24" y2="3" stroke={C.olive} strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 6" /></svg>
        <span>location unverified</span>
      </div>
    </div>
  );
}
