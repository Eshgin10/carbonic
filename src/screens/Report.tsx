import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { useValidation } from '../components/MethodDrawer';
import { Logo } from '../components/Logo';
import { Button, Card, CardTitle, Segmented } from '../components/ui';
import { STAGES, partnerImpact, pick, type PartnerResult } from '../lib/calc';
import { COUNTRY_NAMES } from '../lib/enrich';
import { STAGE_LABEL, factorValue, num0, num1, num2 } from '../lib/format';
import { CUSTOMER_FORMULAS, DISCLAIMER, FORMULAS, LIMITATIONS, STANDARDS, SYSTEM_BOUNDARY } from '../lib/method';
import { MODE_NAME, resolveOption } from '../lib/planner';
import { C, STAGE_COLORS } from '../lib/theme';
import type { CountryCode, Factor, Mode, Scenario } from '../lib/types';
import { useApp, type SearchRecord } from '../store/useApp';
import { paramsFor } from '../store/useResults';
import { customerRange, reductionSentence } from './Planner';
import { inPeriod } from './Record';

const W = 794, H = 1123; // A4 at 96 dpi
const PAGES = 6;

interface Row { rec: SearchRecord; r: PartnerResult; label: string }

function useReportData() {
  const records = useApp((s) => s.records);
  const opt = useApp((s) => s.report);
  const partners = useApp((s) => s.partners);
  const customer = useApp((s) => s.customer);
  const factors = useApp((s) => s.factors);
  return useMemo(() => {
    const now = Date.now();
    // Each search is recalculated with the case and electricity method chosen in its own flow.
    const paramsOf = (rec: SearchRecord) => paramsFor(factors, rec.elec);
    const rows: Row[] = records
      .filter((r) => inPeriod(r, opt.period, now))
      .filter((r) => opt.audience === 'authority' || !opt.customer || r.customer === opt.customer)
      .map((rec) => {
        const meta = resolveOption(rec.a, partners);
        return { rec, r: partnerImpact(meta.input, paramsOf(rec)[rec.scenario]), label: meta.label };
      });
    const sum = (f: (x: Row) => number) => rows.reduce((a, x) => a + f(x), 0);
    const range = (k: 'low' | 'high') => rows.reduce((a, x) => a + partnerImpact(resolveOption(x.rec.a, partners).input, paramsOf(x.rec)[k]).net, 0);
    const reduction = (k: 'low' | 'base' | 'high' | null) =>
      rows.reduce((a, x) => a + customerRange({ ...customer, filmT: x.rec.a.tonnes }, resolveOption(x.rec.a, partners), paramsOf(x.rec))[k ?? x.rec.scenario].reduction, 0);
    const from = new Date(now - (opt.period === 'week' ? 7 : 30) * 86_400_000);
    const scenarios = [...new Set(rows.map((x) => x.rec.scenario))];
    const elecs = [...new Set(rows.map((x) => x.rec.elec))];
    const scenario: Scenario = scenarios.length === 1 ? scenarios[0] : 'base';
    return {
      rows, scenario,
      settings: {
        cases: scenarios.join(', ') || '—',
        elec: elecs.map((e) => (e === 'location' ? 'Location-based grid' : 'Latvian residual mix (0.452)')).join(', ') || '—',
      },
      tonnes: sum((x) => x.r.tonnes), caused: sum((x) => x.r.caused), avoided: sum((x) => x.r.avoided), net: sum((x) => x.r.net),
      stages: Object.fromEntries(STAGES.map((s) => [s, sum((x) => x.r.stages[s])])) as Record<string, number>,
      netLow: range('low'), netHigh: range('high'),
      reduction: { low: reduction('low'), base: reduction(null), high: reduction('high') },
      from, to: new Date(now),
      customers: [...new Set(records.filter((r) => inPeriod(r, opt.period, now) && r.customer).map((r) => r.customer))],
    };
  }, [records, opt, partners, customer, factors]);
}

type Data = ReturnType<typeof useReportData>;

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function Report() {
  const opt = useApp((s) => s.report);
  const set = useApp((s) => s.setReport);
  const factors = useApp((s) => s.factors);
  const data = useReportData();
  const pagesRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.width - 8) / W)));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const who = opt.audience === 'authority' ? 'authority' : (opt.customer || 'all_customers').replace(/[^\w]+/g, '_');
  const fileBase = `Carbonic_report_${opt.period === 'week' ? 'week' : 'month'}_${who}_${data.to.toISOString().slice(0, 10)}`;
  const empty = data.rows.length === 0;

  const downloadPdf = async () => {
    if (!pagesRef.current) return;
    setBusy(true);
    const prev = scale;
    setScale(1);
    await new Promise((r) => setTimeout(r, 150));
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pages = [...pagesRef.current.querySelectorAll<HTMLElement>('[data-page]')];
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      }
      pdf.save(`${fileBase}.pdf`);
    } finally {
      setScale(prev);
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 space-y-5 xl:col-span-3">
        <Card className="p-6">
          <CardTitle sub="Built from the searches saved in Record">Report</CardTitle>
          <div className="space-y-5 text-[12px]">
            <div>
              <div className="mb-2 font-semibold text-muted">For</div>
              <Segmented value={opt.audience} onChange={(audience) => set({ audience })} options={[{ value: 'authority', label: 'Government' }, { value: 'customer', label: 'Customer' }]} />
            </div>
            <div>
              <div className="mb-2 font-semibold text-muted">Period</div>
              <Segmented value={opt.period} onChange={(period) => set({ period })} options={[{ value: 'week', label: 'Past week' }, { value: 'month', label: 'Past month' }]} />
              <div className="mt-2 font-mono text-[11px] text-muted">{day(data.from)} – {day(data.to)}</div>
            </div>
            {opt.audience === 'customer' && (
              <label className="block rounded-2xl bg-paper px-3.5 py-2">
                <span className="text-[11px] font-semibold text-muted">Customer</span>
                <select value={opt.customer} onChange={(e) => set({ customer: e.target.value })} className="w-full bg-transparent text-[14px] font-semibold outline-none">
                  <option value="">All customers</option>
                  {data.customers.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
        </Card>
        <Card dark className="space-y-2 p-6">
          <div className="mb-3 text-[13px] text-white/60">{data.rows.length} search{data.rows.length === 1 ? '' : 'es'} · {num0(data.tonnes)} t</div>
          <Button variant="lime" className="w-full justify-center" onClick={downloadPdf} disabled={busy || empty}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
          </Button>
          <Button variant="light" className="w-full justify-center" onClick={() => exportExcel(data, factors, fileBase)} disabled={empty}><FileSpreadsheet size={14} /> Export Excel</Button>
          <p className="pt-2 text-[11px] leading-relaxed text-white/50">Each search uses the uncertainty case and electricity method chosen in its flow.</p>
        </Card>
      </div>

      <div ref={wrapRef} className="col-span-12 xl:col-span-9">
        {empty ? (
          <Card className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
            <div className="text-[22px] font-bold tracking-[-0.03em]">No searches in this period</div>
            <p className="mt-2 max-w-sm text-[13px] text-muted">Plan and save routes in the Route planner; they appear here and in Record.</p>
          </Card>
        ) : (
          <div style={{ height: busy ? undefined : PAGES * (H + 24) * scale }} className="overflow-hidden">
            <div ref={pagesRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: W }} className="space-y-6">
              <ReportPages data={data} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function Page({ n, children, label }: { n: number; children: ReactNode; label: string }) {
  return (
    <div data-page style={{ width: W, height: H }} className="relative overflow-hidden bg-white font-sans text-coal shadow-card">
      <div className="px-14 pb-16 pt-14">{children}</div>
      <div className="absolute inset-x-14 bottom-8 flex items-center justify-between border-t border-line pt-2.5 font-mono text-[9px] text-muted">
        <span className="flex items-center gap-2"><Logo size={13} /> Carbonic · {label} · calculated estimate, not a certified LCA</span>
        <span>{n} / {PAGES}</span>
      </div>
    </div>
  );
}

const H2 = ({ children, k }: { children: ReactNode; k?: string }) => (
  <div className="mb-5">
    {k && <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{k}</div>}
    <h2 className="mt-1 text-[26px] font-bold tracking-[-0.035em]">{children}</h2>
  </div>
);
const P = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-[1.65] text-[#2E3431]">{children}</p>;
const signed = (kg: number) => `${kg < 0 ? '−' : ''}${num1(Math.abs(kg) / 1000)}`;

function ReportPages({ data }: { data: Data }) {
  const opt = useApp((s) => s.report);
  const factors = useApp((s) => s.factors);
  const validation = useValidation();
  const isCustomer = opt.audience === 'customer';
  const name = opt.customer || 'All customers';
  const label = `${day(data.from)} – ${day(data.to)}`;
  const factorsUsed = factors.filter((f) => f.base !== null);
  const half = Math.ceil(factorsUsed.length / 2);
  const perT = data.tonnes ? data.net / data.tonnes : 0;

  const byKey = <K extends string>(key: (x: Row) => K) => {
    const m = new Map<K, { t: number; net: number; transport: number }>();
    for (const x of data.rows) {
      const e = m.get(key(x)) ?? { t: 0, net: 0, transport: 0 };
      e.t += x.r.tonnes; e.net += x.r.net; e.transport += x.r.stages.transport;
      m.set(key(x), e);
    }
    return [...m.entries()].sort((a, b) => b[1].t - a[1].t);
  };

  return (
    <>
      {/* 1. Cover */}
      <Page n={1} label={label}>
        <div className="-mx-14 -mt-14 mb-12 bg-coal px-14 pb-14 pt-14 text-white">
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime"><Logo size={38} /></span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">{isCustomer ? 'Customer report' : 'Report to the authority'}</span>
          </div>
          <h1 className="mt-14 max-w-[600px] text-[44px] font-bold leading-[1.02] tracking-[-0.045em]">
            {isCustomer ? <>Climate impact of {name === 'All customers' ? 'customer' : `${name}'s`} packaging recycled with LZP</> : <>Packaging recycling routes planned by LZP: greenhouse gas impact</>}
          </h1>
          <div className="mt-8 inline-flex rounded-full bg-lime px-4 py-1.5 text-[12px] font-semibold text-coal">{opt.period === 'week' ? 'Past week' : 'Past month'} · {label}</div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {isCustomer
            ? <Stat label="Reduction with LZP" value={num1(data.reduction.base / 1000)} unit="t CO2e" big />
            : <Stat label="Net emissions" value={signed(data.net)} unit="t CO2e" big />}
          <Stat label="Material planned" value={num0(data.tonnes)} unit="t LDPE film" />
          <Stat label="Net per tonne" value={`${perT < 0 ? '−' : ''}${num0(Math.abs(perT))}`} unit="kg CO2e / t" />
        </div>
        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[11px]">
          <Row k="Prepared by" v="Latvijas Zaļais punkts (LZP)" />
          <Row k="Searches included" v={`${data.rows.length}`} />
          <Row k="Uncertainty case" v={data.settings.cases} />
          <Row k="Electricity" v={data.settings.elec} />
          <Row k="Standards" v="ISO 14040/44 principles · GHG Protocol Scope 3" />
          <Row k="Status" v="Calculated estimate" />
        </dl>
        <div className="absolute inset-x-14 bottom-16 rounded-2xl bg-paper px-4 py-3 text-[10px] leading-relaxed text-muted">{DISCLAIMER}</div>
      </Page>

      {/* 2. Headline + method */}
      <Page n={2} label={label}>
        <H2 k="Headline result">{isCustomer ? 'What working with LZP changes' : 'Caused, avoided and net emissions'}</H2>
        {isCustomer && (
          <div className="mb-5 rounded-2xl bg-coal p-7 text-white">
            <div className="text-[48px] font-bold leading-none tracking-[-0.05em] text-lime">{num1(data.reduction.base / 1000)} <span className="font-mono text-[13px] font-normal text-white/60">t CO2e</span></div>
            <p className="mt-4 text-[15px] font-semibold">{reductionSentence(data.reduction.low, data.reduction.high).replace(' per year', ' for the shipments in this period')}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Caused" value={num1(data.caused / 1000)} unit="t CO2e" box />
          <Stat label="Avoided" value={num1(data.avoided / 1000)} unit="t CO2e" box lime />
          <Stat label="Net" value={signed(data.net)} unit={`t CO2e · range ${signed(Math.min(data.netLow, data.netHigh))} to ${signed(Math.max(data.netLow, data.netHigh))}`} box />
        </div>
        <div className="mt-9"><H2 k="Method">Method and system boundary</H2></div>
        <div className="space-y-2.5">
          <P>{SYSTEM_BOUNDARY}</P>
          <P>{STANDARDS}</P>
        </div>
        <table className="mt-5 w-full text-[10.5px]">
          <tbody>
            {FORMULAS.map((f) => (
              <tr key={f.label} className="border-b border-line">
                <td className={`w-28 py-1.5 font-mono ${/^[A-Z]+$/.test(f.label) ? 'font-semibold' : 'text-muted'}`}>{f.label}</td>
                <td className="py-1.5 font-mono">{f.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isCustomer && <ul className="mt-4 list-disc space-y-1 pl-4 font-mono text-[9.5px] text-muted">{CUSTOMER_FORMULAS.map((f) => <li key={f}>{f}</li>)}</ul>}
        {validation && !isCustomer && (
          <div className="mt-5 rounded-2xl bg-paper px-4 py-3 text-[10.5px] leading-relaxed">
            <span className="font-semibold">Validation.</span> Modelled Nordic Plast caused emissions: {num2(validation.residual)} kg CO2e/kg pellets (residual mix), against ~{num2(validation.bench)} in the Bureau Veritas LCA (which also covers distribution and other processes) and {num2(validation.litLow)}–{num2(validation.litHigh)} in Zeilerbauer et al. 2024.
          </div>
        )}
      </Page>

      {/* 3. Shipments */}
      <Page n={3} label={label}>
        <H2 k="Results">Planned shipments in the period</H2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="mb-2 text-[11px] font-semibold">Caused emissions by stage, t CO2e</div>
            <BarChart width={320} height={170} data={STAGES.map((s) => ({ name: STAGE_LABEL[s], v: data.stages[s] / 1000 }))} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} width={36} />
              <Bar dataKey="v" isAnimationActive={false} radius={[6, 6, 6, 6]} maxBarSize={44} stroke={C.olive} strokeWidth={0.5}>
                {STAGES.map((s) => <Cell key={s} fill={STAGE_COLORS[s]} />)}
              </Bar>
            </BarChart>
          </div>
          <div className="space-y-4">
            <Mini title="By country" rows={byKey((x) => x.r.country).map(([c, e]) => [COUNTRY_NAMES[c as CountryCode], e])} />
            <Mini title="By transport" rows={byKey((x) => x.r.mode).map(([m, e]) => [MODE_NAME[m as Mode], e])} />
          </div>
        </div>
        <table className="mt-7 w-full text-[9.5px]">
          <thead>
            <tr className="border-b border-coal text-left text-muted">
              <th className="py-1 font-normal">Date</th>{!isCustomer && <th className="font-normal">Customer</th>}<th className="font-normal">Destination</th><th className="font-normal">Mode</th>
              <th className="text-right font-normal">km</th><th className="text-right font-normal">t</th><th className="text-right font-normal">Caused</th><th className="text-right font-normal">Avoided</th><th className="text-right font-normal">Net</th><th className="text-right font-normal">kg/t</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.slice(0, 22).map(({ rec, r, label: l }) => (
              <tr key={rec.id} className="border-b border-line">
                <td className="py-[3px] font-mono">{rec.createdAt.slice(0, 10)}</td>{!isCustomer && <td>{rec.customer || '—'}</td>}<td className="max-w-[170px] truncate">{l}</td><td>{MODE_NAME[r.mode]}{rec.a.emptyReturn ? ' (empty ret.)' : ''}</td>
                <td className="text-right font-mono">{num0(r.km)}</td><td className="text-right font-mono">{num1(r.tonnes)}</td><td className="text-right font-mono">{num1(r.caused / 1000)}</td>
                <td className="text-right font-mono">{num1(r.avoided / 1000)}</td><td className="text-right font-mono font-semibold">{signed(r.net)}</td><td className="text-right font-mono">{num0(r.netPerT)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length > 22 && <p className="mt-2 text-[9.5px] text-muted">Showing 22 of {data.rows.length} searches. The Excel export lists all of them.</p>}
      </Page>

      {/* 4-5. Factors */}
      {[factorsUsed.slice(0, half), factorsUsed.slice(half)].map((chunk, i) => (
        <Page key={i} n={4 + i} label={label}>
          <H2 k="Data">{i === 0 ? 'Emission factors and parameters' : 'Emission factors and parameters (cont.)'}</H2>
          <FactorTable factors={chunk} scenario={data.scenario} />
        </Page>
      ))}

      {/* 6. Limitations */}
      <Page n={6} label={label}>
        <H2 k="Interpretation">Assumptions and limitations</H2>
        <P>These inputs were not available and are estimated. Each is flagged “Estimated” in the factor table and covered by the Low/High range.</P>
        <ul className="mt-4 space-y-2">
          {LIMITATIONS.map((l) => (
            <li key={l.title} className="grid grid-cols-[150px_1fr] gap-4 border-b border-line pb-2 text-[10.5px] leading-relaxed">
              <span className="font-semibold">{l.title}</span><span className="text-[#2E3431]">{l.text}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 rounded-2xl bg-coal px-5 py-4 text-[11px] leading-relaxed text-white">
          <span className="font-semibold text-lime">Disclaimer.</span> {DISCLAIMER} Results are for planned routes saved in the tool. Caused and avoided emissions are reported separately; the net figure is for information and is not an offset claim.
        </div>
      </Page>
    </>
  );
}

function Stat({ label, value, unit, big = false, box = false, lime = false }: { label: string; value: string; unit: string; big?: boolean; box?: boolean; lime?: boolean }) {
  return (
    <div className={box ? `rounded-2xl p-4 ${lime ? 'bg-lime' : 'bg-paper'}` : ''}>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 font-bold tabular-nums tracking-[-0.045em] ${big ? 'text-[46px] leading-none' : 'text-[30px]'}`}>{value}</div>
      <div className="mt-1 font-mono text-[9.5px] text-muted">{unit}</div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 border-b border-line pb-1.5"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
);

function Mini({ title, rows }: { title: string; rows: [string, { t: number; net: number; transport: number }][] }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold">{title}</div>
      <table className="w-full text-[9.5px]">
        <thead><tr className="text-left text-muted"><th className="font-normal" /><th className="text-right font-normal">t</th><th className="text-right font-normal">Transport t CO2e</th><th className="text-right font-normal">Net t CO2e</th></tr></thead>
        <tbody>
          {rows.map(([k, e]) => (
            <tr key={k} className="border-t border-line"><td className="py-[2px]">{k}</td><td className="text-right font-mono">{num1(e.t)}</td><td className="text-right font-mono">{num2(e.transport / 1000)}</td><td className="text-right font-mono">{signed(e.net)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorTable({ factors, scenario }: { factors: Factor[]; scenario: Data['scenario'] }) {
  return (
    <table className="w-full table-fixed text-[9px] leading-snug">
      <thead>
        <tr className="border-b border-coal text-left text-muted">
          <th className="w-10 py-1 font-normal">ID</th><th className="w-[150px] font-normal">Parameter</th><th className="w-[92px] text-right font-normal">Value (range)</th>
          <th className="w-[70px] pl-2 font-normal">Unit</th><th className="pl-2 font-normal">Source</th><th className="w-9 font-normal">Year</th><th className="w-[58px] font-normal">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {factors.map((f) => (
          <tr key={f.id} className="border-b border-line align-top">
            <td className="py-[3px] font-mono">{f.id}</td>
            <td>{f.parameter}</td>
            <td className="text-right font-mono">{factorValue(pick(f, scenario))}{(f.low !== null || f.high !== null) && <div className="text-muted">({factorValue(f.low ?? f.base)}–{factorValue(f.high ?? f.base)})</div>}</td>
            <td className="pl-2 text-muted">{f.unit}</td>
            <td className="pl-2 text-muted">{f.source.length > 150 ? `${f.source.slice(0, 147)}…` : f.source}</td>
            <td className="font-mono">{f.year ?? '—'}</td>
            <td>{f.confidence}{f.estimated && <div className="text-amber">Estimated</div>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------------ */
/* Excel export                                                        */
/* ------------------------------------------------------------------ */

function exportExcel(data: Data, factors: Factor[], fileBase: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { Item: 'Period', Value: `${data.from.toISOString().slice(0, 10)} to ${data.to.toISOString().slice(0, 10)}` },
    { Item: 'Searches', Value: data.rows.length },
    { Item: 'Tonnes', Value: +data.tonnes.toFixed(2) },
    { Item: 'Caused t CO2e', Value: +(data.caused / 1000).toFixed(3) },
    { Item: 'Avoided t CO2e', Value: +(data.avoided / 1000).toFixed(3) },
    { Item: 'Net t CO2e', Value: +(data.net / 1000).toFixed(3) },
    { Item: 'Net low / high t CO2e', Value: `${(data.netLow / 1000).toFixed(2)} / ${(data.netHigh / 1000).toFixed(2)}` },
    { Item: 'Settings', Value: `case ${data.settings.cases}; electricity ${data.settings.elec}` },
  ]), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rows.map(({ rec, r, label }) => ({
    Date: rec.createdAt.slice(0, 10), Customer: rec.customer, Material: rec.a.material, Destination: label, Country: COUNTRY_NAMES[r.country],
    Mode: MODE_NAME[r.mode], 'Empty return': rec.a.emptyReturn ? 'yes' : 'no', km: r.km, Tonnes: r.tonnes, Yield: +r.yield.toFixed(3),
    ...Object.fromEntries(STAGES.map((s) => [`${STAGE_LABEL[s]} t CO2e`, +(r.stages[s] / 1000).toFixed(4)])),
    'Caused t CO2e': +(r.caused / 1000).toFixed(4), 'Avoided t CO2e': +(r.avoided / 1000).toFixed(4), 'Net t CO2e': +(r.net / 1000).toFixed(4), 'Net kg CO2e/t': Math.round(r.netPerT),
  }))), 'Shipments');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(factors.map((f) => ({
    ID: f.id, Group: f.group, Parameter: f.parameter, Base: f.base, Low: f.low, High: f.high, Unit: f.unit, Source: f.source, URL: f.url ?? '', Year: f.year,
    Confidence: f.confidence, Status: f.status, Estimated: f.estimated ? 'yes' : 'no', Notes: f.notes ?? '',
  }))), 'Factors');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...LIMITATIONS.map((l) => ({ Topic: l.title, Note: l.text })), { Topic: 'Disclaimer', Note: DISCLAIMER }]), 'Limitations');
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
