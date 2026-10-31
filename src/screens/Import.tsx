import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Pencil, Save, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, ComposedChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { IconTile, Illustration, type IllustrationName } from '../components/Illustration';
import { InfoTip } from '../components/InfoTip';
import type { RouteDatum } from '../components/map/RouteLayer';
import { GeoMap } from '../components/map/RouteMap';
import { AnimatedNumber, Button, Card, CardTitle, EstimatedChip, Segmented, useSeen } from '../components/ui';
import { partnerImpact } from '../lib/calc';
import { num0, num1 } from '../lib/format';
import { parseRouteRows, sampleRows } from '../lib/importRoutes';
import { MODE_NAME, resolveOption } from '../lib/planner';
import { C, EASE } from '../lib/theme';
import type { ElecMethod, Scenario } from '../lib/types';
import { useApp } from '../store/useApp';
import { useParams } from '../store/useResults';

const signed = (n: number, f = num1) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${f(Math.abs(n))}`;

/* ------------------------------------------------------------------ */
/* Start: import a file or search manually                             */
/* ------------------------------------------------------------------ */

export function StartChoice() {
  const setEntry = useApp((s) => s.setEntry);
  const setStep = useApp((s) => s.setStep);
  const [open, setOpen] = useState(false);
  const choices: { art: IllustrationName; title: string; text: string; cta: string; go: () => void }[] = [
    { art: 'sheet', title: 'Import from a file', text: 'Upload an Excel or CSV list of shipments. Every row becomes a route with its emissions.', cta: 'Upload file', go: () => setOpen(true) },
    { art: 'route', title: 'Search routes manually', text: 'Answer a few questions about one shipment and compare routes step by step.', cta: 'Start search', go: () => { setStep(0); setEntry('manual'); } },
  ];
  return (
    <div className="mx-auto max-w-[920px] pt-6">
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.045em]">
        How do you want to start?
      </motion.h2>
      <p className="mt-2 text-[15px] text-muted">Bring many shipments at once, or plan one route yourself.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {choices.map((c, i) => (
          <motion.button
            key={c.art} onClick={c.go}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE, delay: 0.08 + i * 0.08 }}
            className="group rounded-[28px] bg-white p-7 text-left shadow-card transition-colors duration-200 hover:bg-lime-100"
          >
            <IconTile selected={false} size={124} radius={32}>
              <Illustration name={c.art} size={96} />
            </IconTile>
            <div className="mt-7 text-[22px] font-bold tracking-[-0.025em]">{c.title}</div>
            <p className="mt-1.5 max-w-[340px] text-[14px] leading-relaxed text-muted">{c.text}</p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-coal px-4 py-2 text-[13px] font-semibold text-white transition-colors group-hover:bg-olive">
              {c.cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </motion.button>
        ))}
      </div>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Upload window                                                       */
/* ------------------------------------------------------------------ */

const CASES: { value: Scenario; label: string }[] = [{ value: 'low', label: 'Low' }, { value: 'base', label: 'Base' }, { value: 'high', label: 'High' }];
const ELEC: { value: ElecMethod; label: string }[] = [{ value: 'location', label: 'Grid average' }, { value: 'residual', label: 'LV residual mix' }];

export function ImportModal({ onClose }: { onClose: () => void }) {
  const partners = useApp((s) => s.partners);
  const factors = useApp((s) => s.factors);
  const setImported = useApp((s) => s.setImported);
  const setEntry = useApp((s) => s.setEntry);
  const scenario = useApp((s) => s.scenario);
  const elec = useApp((s) => s.elec);
  const setScenario = useApp((s) => s.setScenario);
  const setElec = useApp((s) => s.setElec);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const accept = (raw: Record<string, unknown>[], fileName: string) => {
    const parsed = parseRouteRows(raw, partners, factors);
    if (!parsed.rows.length) {
      setError(raw.length ? `None of the ${raw.length} rows match the database. Check the column names and that destinations are known recyclers or cities.` : 'The file has no rows.');
      return;
    }
    setImported({ ...parsed, fileName });
    setEntry('import');
    onClose();
  };

  const read = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      accept(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' }), file.name);
    } catch {
      setError('This file could not be read. Use .xlsx, .xls or .csv.');
    } finally {
      setBusy(false);
    }
  };

  const template = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows(partners).slice(0, 6)), 'Shipments');
    XLSX.writeFile(wb, 'Carbonic_shipments_template.xlsx');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-coal/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        role="dialog" aria-modal="true" aria-label="Import shipments"
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] rounded-[28px] bg-white p-7 shadow-card"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-paper hover:text-coal" aria-label="Close"><X size={16} /></button>
        <h3 className="text-[22px] font-bold tracking-[-0.025em]">Import shipments</h3>
        <p className="mt-1 text-[13px] text-muted">One row per shipment. Columns: Destination, Tonnes, and optionally Mode, Material, Customer, Date, Empty return.</p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) read(f); }}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-colors duration-200 ${drag ? 'border-lime-700 bg-lime-100' : 'border-line bg-paper hover:bg-lime-100'}`}
        >
          <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
          {busy ? (
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-coal" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime"><Upload size={20} /></span>
          )}
          <span className="mt-3 text-[15px] font-semibold">{busy ? 'Reading file…' : 'Drop a file here or click to choose'}</span>
          <span className="mt-0.5 text-[12px] text-muted">.xlsx, .xls or .csv</span>
        </label>

        {error && <p className="mt-3 rounded-2xl bg-amber/10 px-4 py-2.5 text-[12px] text-amber">{error}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-muted">Uncertainty case</div>
            <Segmented size="sm" value={scenario} onChange={setScenario} options={CASES} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-muted">Electricity</div>
            <Segmented size="sm" value={elec} onChange={setElec} options={ELEC} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <Button variant="secondary" onClick={template}><Download size={13} /> Download template</Button>
          <Button variant="ghost" onClick={() => accept(sampleRows(partners), 'Sample shipments')}><FileSpreadsheet size={13} /> Try sample data</Button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Rows whose material, destination or mode is not in our database are left out rather than guessed. Only LDPE film has sourced factors today.
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Imported routes                                                     */
/* ------------------------------------------------------------------ */

function useImportedResults() {
  const imported = useApp((s) => s.imported);
  const partners = useApp((s) => s.partners);
  const { all, active } = useParams();
  return useMemo(() => {
    if (!imported) return null;
    const rows = imported.rows.map((row, i) => {
      const meta = resolveOption(row.option, partners);
      return { ...row, i, meta, r: partnerImpact(meta.input, active), low: partnerImpact(meta.input, all.low), high: partnerImpact(meta.input, all.high) };
    });
    const sum = (f: (x: (typeof rows)[number]) => number) => rows.reduce((s, x) => s + f(x), 0);
    return {
      file: imported, rows, active,
      tonnes: sum((x) => x.r.tonnes), caused: sum((x) => x.r.caused), avoided: sum((x) => x.r.avoided), net: sum((x) => x.r.net),
      low: sum((x) => x.low.net), high: sum((x) => x.high.net),
    };
  }, [imported, partners, all, active]);
}

export function ImportResults() {
  const data = useImportedResults();
  const setEntry = useApp((s) => s.setEntry);
  const setStep = useApp((s) => s.setStep);
  const saveRecords = useApp((s) => s.saveRecords);
  const [open, setOpen] = useState(false);
  if (!data) return <StartChoice />;
  const { rows, file } = data;

  const routes: RouteDatum[] = rows.map(({ r, meta, i }) => {
    const tkm = r.tonnes * r.km;
    return {
      id: `row-${i}`, name: meta.label, country: r.country, mode: r.mode, tonnes: r.tonnes, km: r.km, lat: meta.lat, lng: meta.lng,
      verified: meta.verified, causedPerT: r.causedPerT, transportKg: r.stages.transport, transportFactor: tkm > 0 ? r.stages.transport / tkm : data.active.roadKgPerTkm,
    };
  });

  const save = () => saveRecords(rows.map(({ r, meta, option, customer, date }) => ({
    createdAt: date ?? new Date().toISOString(), customer, a: option,
    snapshot: { label: meta.label, caused: r.caused, avoided: r.avoided, net: r.net, netPerT: r.netPerT, stages: { ...r.stages } },
  })));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setEntry('choose')}><ArrowLeft size={13} /> Start</Button>
        <Button variant="light" onClick={() => setOpen(true)}><Upload size={13} /> Import another file</Button>
        <Button variant="light" onClick={() => { setStep(0); setEntry('manual'); }}><Pencil size={13} /> Search manually</Button>
        <div className="ml-auto"><Button onClick={save}><Save size={13} /> Save all to record</Button></div>
      </div>

      <Card dark className="p-7">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-white/55">
          <FileSpreadsheet size={13} /> {file.fileName} · {rows.length} of {file.total} rows calculated
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="text-[13px] text-white/60">Net emissions of {rows.length} shipments</div>
            <div className="mt-1 flex items-baseline gap-2">
              <AnimatedNumber value={data.net / 1000} format={(n) => signed(n)} duration={1.3} className="text-[64px] font-extrabold leading-none tracking-[-0.05em] text-lime" />
              <span className="font-mono text-[13px] text-white/55">t CO2e</span>
            </div>
            <div className="mt-2 font-mono text-[11px] text-white/45">Range {signed(data.low / 1000)} to {signed(data.high / 1000)} t</div>
          </div>
          <div className="grid grid-cols-3 gap-3 self-end">
            {[
              ['Tonnes', num0(data.tonnes)],
              ['Caused', `+${num1(data.caused / 1000)}`],
              ['Avoided', `−${num1(data.avoided / 1000)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-white/[0.06] p-3.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">{k}</div>
                <div className="mt-1 text-[20px] font-bold tabular-nums tracking-[-0.03em]">{v}</div>
              </div>
            ))}
          </div>
        </div>
        {file.skipped > 0 && (
          <div className="mt-5 text-[12px] text-white/50">
            {file.skipped} {file.skipped === 1 ? 'row is' : 'rows are'} not shown because the material, destination or mode is not in our database.
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="p-5 xl:col-span-3">
          <CardTitle sub="Line colour = caused emissions per tonne, width = tonnes. Scroll to zoom, drag to move.">Imported routes</CardTitle>
          <GeoMap interactive routes={routes} className="h-[420px]" />
        </Card>
        <GaussCard rows={rows.map((x) => ({ label: `${x.meta.label} · ${num0(x.r.tonnes)} t`, v: x.r.netPerT, lo: x.low.netPerT, hi: x.high.netPerT }))} />
      </div>

      <Card className="p-6">
        <CardTitle sub="kg CO2e. Caused and avoided are shown separately, then netted.">Shipments</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-3 font-medium">Row</th><th className="pr-3 font-medium">Date</th><th className="pr-3 font-medium">Customer</th><th className="pr-3 font-medium">Destination</th>
                <th className="pr-3 font-medium">Mode</th><th className="pr-3 text-right font-medium">km</th><th className="pr-3 text-right font-medium">t</th>
                <th className="pr-3 text-right font-medium">Caused</th><th className="pr-3 text-right font-medium">Avoided</th><th className="pr-3 text-right font-medium">Net</th><th className="text-right font-medium">Net / t</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ row, date, customer, meta, r, option }) => (
                <tr key={row} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-[11px] text-muted">{row}</td>
                  <td className="pr-3 font-mono text-[11px]">{date ? date.slice(0, 10) : '—'}</td>
                  <td className="pr-3">{customer || '—'}</td>
                  <td className="max-w-[220px] truncate pr-3 font-semibold">{meta.label}{!meta.verified && <span className="ml-1.5 align-middle"><EstimatedChip label="Unverified" /></span>}</td>
                  <td className="pr-3">{MODE_NAME[r.mode]}{option.emptyReturn ? ' · empty return' : ''}</td>
                  <td className="pr-3 text-right tabular-nums">{num0(r.km)}</td>
                  <td className="pr-3 text-right tabular-nums">{num1(r.tonnes)}</td>
                  <td className="pr-3 text-right tabular-nums">+{num0(r.caused)}</td>
                  <td className="pr-3 text-right tabular-nums">−{num0(r.avoided)}</td>
                  <td className="pr-3 text-right font-semibold tabular-nums">{signed(r.net, num0)}</td>
                  <td className="text-right font-mono text-[12px] tabular-nums">{signed(r.netPerT, num0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Gaussian (normal) curve of net emissions per tonne                  */
/* ------------------------------------------------------------------ */

const pdf = (x: number, mu: number, s: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

/**
 * Normal curve fitted to the shipments' net kg CO2e per tonne (mean and standard deviation),
 * with every shipment as a dot on the curve. With fewer than three distinct values the spread
 * comes from the Low/High cases instead, read as a 95% interval.
 */
function GaussCard({ rows }: { rows: { label: string; v: number; lo: number; hi: number }[] }) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.4);
  const g = useMemo(() => {
    const n = rows.length;
    const mu = rows.reduce((s, x) => s + x.v, 0) / n;
    const sd = n >= 3 ? Math.sqrt(rows.reduce((s, x) => s + (x.v - mu) ** 2, 0) / (n - 1)) : 0;
    const fromData = sd > 0.5;
    const sigma = fromData ? sd : Math.max(1, rows.reduce((s, x) => s + Math.abs(x.hi - x.lo), 0) / n / 3.92);
    const lo = Math.min(mu - 3.2 * sigma, ...rows.map((x) => x.v)), hi = Math.max(mu + 3.2 * sigma, ...rows.map((x) => x.v));
    const curve = Array.from({ length: 121 }, (_, i) => { const x = lo + ((hi - lo) * i) / 120; return { x, y: pdf(x, mu, sigma) }; });
    const dots = rows.map((r) => ({ x: r.v, y: pdf(r.v, mu, sigma), label: r.label }));
    const within = rows.filter((r) => Math.abs(r.v - mu) <= sigma).length;
    return { mu, sigma, fromData, lo, hi, curve, dots, within, n };
  }, [rows]);

  return (
    <Card className="p-5 xl:col-span-2">
      <CardTitle
        sub="Net kg CO2e per tonne across the imported shipments"
        right={<InfoTip title="Normal distribution" note={g.fromData
          ? 'A normal (Gaussian) curve fitted to the shipments: mean and sample standard deviation of net emissions per tonne. Dots are the shipments. The shaded band is mean ± 1σ.'
          : 'Too few different shipments to fit a spread, so σ comes from the Low/High cases, read as a 95% interval (σ ≈ (High − Low) / 3.92).'} />}
      >
        Distribution
      </CardTitle>
      <div ref={ref} className="h-[300px]">
        {seen && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={g.curve} margin={{ top: 16, right: 12, bottom: 4, left: 12 }}>
              <defs>
                <linearGradient id="gauss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.lime} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={C.lime} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="x" type="number" domain={[g.lo, g.hi]} tickCount={6} tickFormatter={(v: number) => signed(v, num0)}
                tick={{ fontSize: 10, fill: C.muted, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: C.line }} tickLine={false}
              />
              <YAxis hide domain={[0, 'dataMax']} />
              <ReferenceArea x1={g.mu - g.sigma} x2={g.mu + g.sigma} fill={C.lime} fillOpacity={0.18} />
              <Area dataKey="y" type="monotone" stroke={C.coal} strokeWidth={2} fill="url(#gauss)" animationDuration={1200} animationEasing="ease-out" isAnimationActive />
              <ReferenceLine x={g.mu} stroke={C.coal} strokeDasharray="4 4" label={{ value: `μ ${signed(g.mu, num0)}`, position: 'top', fontSize: 10, fill: C.coal, fontFamily: 'JetBrains Mono' }} />
              <Scatter data={g.dots} dataKey="y" fill={C.coal} stroke={C.lime} strokeWidth={1.5} animationBegin={900} animationDuration={500} />
              <Tooltip
                cursor={false}
                content={({ payload }) => {
                  const p = payload?.find((x) => (x.payload as { label?: string }).label)?.payload as { label: string; x: number } | undefined;
                  return p ? <div className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] shadow-card"><div className="font-semibold">{p.label}</div><div className="font-mono text-[11px]">{signed(p.x, num0)} kg CO2e/t</div></div> : null;
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-xl bg-paper px-3 py-2"><div className="font-mono text-[10px] uppercase tracking-wider text-muted">Mean <span className="normal-case">μ</span></div><div className="text-[15px] font-bold tabular-nums">{signed(g.mu, num0)}</div></div>
        <div className="rounded-xl bg-paper px-3 py-2"><div className="font-mono text-[10px] uppercase tracking-wider text-muted">Std dev <span className="normal-case">σ</span></div><div className="text-[15px] font-bold tabular-nums">{num0(g.sigma)}</div></div>
        <div className="rounded-xl bg-lime px-3 py-2"><div className="font-mono text-[10px] uppercase tracking-wider">Within ±1<span className="normal-case">σ</span></div><div className="text-[15px] font-bold tabular-nums">{g.within} of {g.n}</div></div>
      </div>
    </Card>
  );
}
