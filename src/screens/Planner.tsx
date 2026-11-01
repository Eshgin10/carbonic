import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Calculator, Check, Factory, Pencil, Plus, RotateCcw, Save, Search, Ship, Sparkles, TrainFront, Truck, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { InfoTip } from '../components/InfoTip';
import { Logo } from '../components/Logo';
import { IconTile, Illustration, type IllustrationName } from '../components/Illustration';
import { MaterialIcon } from '../components/MaterialIcon';
import { ConfirmShipment } from './Confirm';
import { ImportResults, StartChoice } from './Import';
import type { RouteDatum } from '../components/map/RouteLayer';
import { GeoMap, type MapPoint } from '../components/map/RouteMap';
import { AnimatedNumber, Button, Card, CardTitle, EstimatedChip, GrowBar, RangeBar, Segmented } from '../components/ui';
import { STAGES, customerComparison, partnerImpact, portfolioImpact, type CustomerResult, type Params, type PartnerResult, type Stage } from '../lib/calc';
import { COUNTRY_NAMES, MATERIALS } from '../lib/enrich';
import { STAGE_LABEL, num0, num1, num2, pct } from '../lib/format';
import { CITIES, MODE_NAME, candidates, cityKm, defaultSeaKm, feasibleMode, ferryAvailable, optionForCity, optionForPartner, optionKey, optionResult, recommend, resolveOption, type PlanOption, type ResolvedOption } from '../lib/planner';
import { C, EASE, STAGE_COLORS } from '../lib/theme';
import type { ElecMethod, Mode, Scenario } from '../lib/types';
import { useApp } from '../store/useApp';
import { useParams } from '../store/useResults';

const t1 = (kg: number) => num1(kg / 1000);
const signedT = (kg: number) => `${kg < 0 ? '−' : kg > 0 ? '+' : ''}${num1(Math.abs(kg) / 1000)}`;
const signed0 = (n: number) => `${n < 0 ? '−' : ''}${num0(Math.abs(n))}`;

export function Planner() {
  const step = useApp((s) => s.step);
  const entry = useApp((s) => s.entry);
  return (
    <div className="pt-2 md:pt-6">
      {entry === 'choose' ? <StartChoice /> : entry === 'import' ? <ImportResults /> : step < RESULT_STEP ? <Wizard /> : <Results />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared hooks                                                        */
/* ------------------------------------------------------------------ */

function useOption(o: PlanOption | null) {
  const partners = useApp((s) => s.partners);
  const { all, active } = useParams();
  return useMemo(() => {
    if (!o) return null;
    const meta = resolveOption(o, partners);
    return {
      meta,
      r: partnerImpact(meta.input, active),
      low: partnerImpact(meta.input, all.low),
      high: partnerImpact(meta.input, all.high),
      params: active,
    };
  }, [o, partners, all, active]);
}

type OptionCalc = NonNullable<ReturnType<typeof useOption>>;

function toRoute(id: string, c: Pick<OptionCalc, 'r' | 'meta' | 'params'>, color?: string): RouteDatum {
  const tkm = c.r.tonnes * c.r.km;
  return {
    id, name: `${id.toUpperCase()} · ${c.meta.label}`, country: c.r.country, mode: c.r.mode, tonnes: c.r.tonnes, km: c.r.km,
    lat: c.meta.lat, lng: c.meta.lng, verified: c.meta.verified, causedPerT: c.r.causedPerT, transportKg: c.r.stages.transport,
    transportFactor: tkm > 0 ? c.r.stages.transport / tkm : c.params.roadKgPerTkm,
    color,
  };
}

function snapshotOf(c: OptionCalc) {
  return { label: c.meta.label, caused: c.r.caused, avoided: c.r.avoided, net: c.r.net, netPerT: c.r.netPerT, stages: { ...c.r.stages } };
}

/* ------------------------------------------------------------------ */
/* Wizard                                                              */
/* ------------------------------------------------------------------ */

const QUESTIONS = ['What are you sending?', 'Where should it go?', 'How will it travel?', 'How should we calculate it?'];
export const RESULT_STEP = QUESTIONS.length;

/**
 * One question at a time. Nothing about later steps (no timeline, no map, no preview) is shown.
 * The last question ends with an explicit Calculate button, a short "calculating" screen follows,
 * and then only the result is shown. Option B (compare) reuses the same flow without the settings
 * question, because the calculation settings apply to both options.
 */
function Wizard() {
  const step = useApp((s) => s.step);
  const setStep = useApp((s) => s.setStep);
  const setEntry = useApp((s) => s.setEntry);
  const which = useApp((s) => s.editing);
  const o = useApp((s) => s[which])!;
  const a = useApp((s) => s.a);
  const saveRecord = useApp((s) => s.saveRecord);
  const calcA = useOption(a)!;
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const lastStep = which === 'b' ? 2 : QUESTIONS.length - 1;
  const firstStep = which === 'b' ? 1 : 0;
  const last = step >= lastStep;
  const reduce = useReducedMotion();

  const calculate = () => {
    setCalculating(true);
    window.setTimeout(() => {
      saveRecord(snapshotOf(calcA));
      setStep(RESULT_STEP);
    }, reduce ? 150 : 1100);
  };

  if (calculating) return <Calculating o={o} />;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-[760px] flex-col justify-center py-6">
      <motion.div key={`${which}-${step}`} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }}>
        <div className="flex h-8 items-center gap-3">
          {(step > firstStep || which === 'a') && (
            <button onClick={() => (step > firstStep ? setStep(step - 1) : setEntry('choose'))} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-coal">
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {which === 'b' && <span className="rounded-full bg-lime px-3 py-1 text-[11px] font-bold">Option B · to compare</span>}
        </div>
        <h2 className="mt-2 text-[44px] font-bold leading-[1.02] tracking-[-0.045em] text-coal sm:text-[52px]">{QUESTIONS[step]}</h2>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE, delay: 0.15 }} className="mt-10">
          {step === 0 && <StepMaterial which={which} />}
          {step === 1 && <DestinationPicker which={which} />}
          {step === 2 && <StepTransport which={which} />}
          {step === 3 && <SettingsFields />}
        </motion.div>
        {last ? (
          <div className="mt-12 flex flex-wrap items-center gap-5 border-t border-line pt-8">
            <Button variant="lime" onClick={() => setConfirming(true)} disabled={o.tonnes <= 0} className="px-7 py-3.5 text-[16px] shadow-card">
              <Calculator size={18} /> Calculate
            </Button>
            <p className="max-w-xs text-[13px] leading-snug text-muted">That was the last question. Calculate to see the emissions for this shipment.</p>
          </div>
        ) : (
          <div className="mt-12">
            <Button onClick={() => setStep(step + 1)} disabled={o.tonnes <= 0} className="px-6 py-3 text-[15px]">
              Continue <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </motion.div>
      {confirming && (
        <ConfirmShipment
          o={o} which={which}
          onClose={() => setConfirming(false)}
          onEdit={(n) => { setConfirming(false); setStep(n); }}
          onConfirm={() => { setConfirming(false); calculate(); }}
        />
      )}
    </div>
  );
}

/** Brief hand-over screen between the last question and the result. */
function Calculating({ o }: { o: PlanOption }) {
  const partners = useApp((s) => s.partners);
  const meta = resolveOption(o, partners);
  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-[760px] flex-col items-center justify-center text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, ease: EASE }} className="relative h-24 w-24">
        <span className="absolute inset-0 rounded-full border-[6px] border-line" />
        <motion.span
          className="absolute inset-0 rounded-full border-[6px] border-transparent border-t-coal"
          animate={{ rotate: 360 }} transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
        />
        <span className="absolute inset-0 flex items-center justify-center"><Logo size={44} /></span>
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.1 }} className="mt-8 text-[36px] font-bold tracking-[-0.04em]">
        Calculating emissions
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 }} className="mt-2 text-[15px] text-muted">
        {num0(o.tonnes)} t {o.material === 'LDPE' ? 'LDPE film' : o.material} to {meta.label} by {MODE_NAME[meta.input.mode].toLowerCase()}
      </motion.p>
    </div>
  );
}

function StepMaterial({ which }: { which: 'a' | 'b' }) {
  const a = useApp((s) => s[which])!;
  const patch = useApp((s) => s.patchOption);
  const customerName = useApp((s) => s.customerName);
  const setCustomerName = useApp((s) => s.setCustomerName);
  return (
    <div className="space-y-9">
      <div className="grid grid-cols-3 gap-3">
        {MATERIALS.map((m) => {
          const active = m.status === 'active';
          const selected = a.material === m.id;
          return (
            <button
              key={m.id}
              disabled={!active}
              onClick={() => patch(which, { material: m.id })}
              className={`relative rounded-3xl p-5 text-left transition-all duration-200 ${selected ? 'bg-coal text-white' : active ? 'bg-white hover:bg-lime-100' : 'cursor-not-allowed bg-white/50 text-muted'}`}
            >
              <div className="mb-6">
                <IconTile selected={selected}>
                  <MaterialIcon material={m.id} tone={active ? 'light' : 'muted'} size={80} />
                </IconTile>
              </div>
              <div className="text-[16px] font-bold tracking-[-0.01em]">{m.name}</div>
              <div className={`text-[12px] ${selected ? 'text-white/60' : 'text-muted'}`}>{active ? 'Film and agro film' : m.id === 'Glass' ? 'Bottles and jars · coming soon' : 'Boxes and board · coming soon'}</div>
              {selected && <Check size={18} className="absolute right-5 top-5 text-lime" />}
            </button>
          );
        })}
      </div>
      <div>
        <TonnesPicker which={which} />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-muted" htmlFor="cust">For which customer? <span className="font-normal">Optional, used in reports</span></label>
        <input id="cust" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Rimi Latvia" className="mt-3 w-full max-w-sm rounded-3xl bg-white px-5 py-3 text-[15px] outline-none ring-coal focus:ring-2" />
      </div>
    </div>
  );
}

/** Typical payload of one articulated truck; used only to visualise the amount, not in the calculation. */
const TRUCK_T = 24;
const SIZES: { t: number; art: IllustrationName; label: string }[] = [
  { t: 10, art: 'bales', label: 'A few bales' },
  { t: 24, art: 'truck', label: 'One truckload' },
  { t: 100, art: 'convoy', label: 'Several trucks' },
  { t: 500, art: 'pile', label: 'Large stockpile' },
];

function TonnesPicker({ which }: { which: 'a' | 'b' }) {
  const o = useApp((s) => s[which])!;
  const patch = useApp((s) => s.patchOption);
  const set = (t: number) => patch(which, { tonnes: Math.max(0, Math.round(t * 10) / 10) });
  const loads = o.tonnes / TRUCK_T;
  const shown = Math.min(Math.ceil(loads), 20);
  // Slider on a log scale so 1 t and 1,000 t are both easy to reach.
  const toSlider = (t: number) => Math.log10(Math.max(1, t)) / 3;
  const fromSlider = (v: number) => Math.round(10 ** (v * 3));
  return (
    <div>
      <label className="block text-[13px] font-semibold text-muted" htmlFor="tonnes">How many tonnes?</label>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SIZES.map((sz) => {
          const sel = o.tonnes === sz.t;
          return (
            <button key={sz.t} onClick={() => set(sz.t)} className={`rounded-3xl p-4 text-left transition-colors duration-200 ${sel ? 'bg-coal text-white' : 'bg-white hover:bg-lime-100'}`}>
              <IconTile selected={sel} size={72} radius={20}>
                <Illustration name={sz.art} size={58} />
              </IconTile>
              <div className="mt-3 text-[20px] font-bold tabular-nums tracking-[-0.03em]">{sz.t} t</div>
              <div className={`text-[11px] ${sel ? 'text-white/55' : 'text-muted'}`}>{sz.label}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-3xl bg-white p-5">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-baseline">
            <input
              id="tonnes" type="number" min={0} value={o.tonnes}
              onChange={(e) => set(+e.target.value)}
              className="w-32 bg-transparent text-[44px] font-bold tabular-nums tracking-[-0.045em] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="font-mono text-[13px] text-muted">t</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.001} value={toSlider(o.tonnes)} onChange={(e) => set(fromSlider(+e.target.value))}
            className="lzp-range min-w-[200px] flex-1" aria-label="Tonnes"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1">
          {Array.from({ length: shown }, (_, i) => {
            const fill = Math.min(1, loads - i);
            return (
              <motion.span key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE, delay: i * 0.02 }}>
                <span className="block" style={{ opacity: fill < 1 ? 0.45 : 1 }}><Illustration name="truck" size={30} tone={fill < 1 ? 'muted' : 'light'} /></span>
              </motion.span>
            );
          })}
          {Math.ceil(loads) > shown && <span className="ml-1 rounded-full bg-paper px-2.5 py-1 font-mono text-[11px] font-semibold">+{num0(Math.ceil(loads) - shown)}</span>}
          <span className="ml-auto flex items-center gap-1 text-[12px] text-muted">
            ≈ {num1(loads)} truckloads at {TRUCK_T} t
            <InfoTip title="Truckloads" note="For orientation only, assuming a 24 t payload per articulated truck. Baled film is bulky, so real loads may be volume-limited and lighter. The calculation uses tonne-km, not trucks." factorIds={['T1']} />
          </span>
        </div>
      </div>
    </div>
  );
}

function DestinationPicker({ which, compact = false }: { which: 'a' | 'b'; compact?: boolean }) {
  const o = useApp((s) => s[which])!;
  const setOption = useApp((s) => s.setOption);
  const partners = useApp((s) => s.partners);
  const factors = useApp((s) => s.factors);
  const { active } = useParams();
  const [q, setQ] = useState('');
  const match = (...t: string[]) => t.some((x) => x.toLowerCase().includes(q.toLowerCase()));
  const kind = o.destKind === 'partner' ? 'partner' : 'city';
  const list = partners
    .filter((p) => match(p.name, COUNTRY_NAMES[p.country], p.location))
    .map((p) => ({ p, r: partnerImpact({ ...p, tonnes: o.tonnes, emptyReturn: o.emptyReturn, mode: feasibleMode(o.mode, p.country) }, active) }))
    .sort((x, y) => (y.p.filmT > 0 ? 1 : 0) - (x.p.filmT > 0 ? 1 : 0) || x.r.netPerT - y.r.netPerT);
  const cities = CITIES.filter((c) => match(c.name, COUNTRY_NAMES[c.country]));
  const countries = [...new Set(cities.map((c) => c.country))];
  const tile = compact ? 'rounded-2xl px-3.5 py-2.5' : 'rounded-3xl px-5 py-3.5';
  const surface = compact ? 'bg-paper' : 'bg-white';
  // Keep the current choice visible inside the scrolling list.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = listRef.current, el = box?.querySelector<HTMLElement>('[data-selected="true"]');
    if (box && el) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
  }, [kind]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          size={compact ? 'sm' : 'md'}
          value={kind}
          onChange={(k) => setOption(which, k === 'city'
            ? optionForCity(o, CITIES.find((c) => c.country === o.country) ?? CITIES[0], factors)
            : optionForPartner(o, partners.find((p) => p.country === o.country && p.filmT > 0) ?? partners[0]))}
          options={[
            { value: 'partner', label: <span className="inline-flex items-center gap-1.5"><Factory size={12} /> Partner</span> },
            { value: 'city', label: <span className="inline-flex items-center gap-1.5"><Building2 size={12} /> City</span> },
          ]}
        />
        <div className={`flex min-w-[200px] flex-1 items-center gap-2 rounded-full px-4 ${compact ? 'bg-paper py-1.5' : 'bg-white py-2.5'}`}>
          <Search size={14} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === 'partner' ? 'Search partner, city or country' : 'Search city or country'} className="w-full bg-transparent text-[13px] outline-none" />
        </div>
      </div>
      <div ref={listRef} className={`relative mt-4 overflow-y-auto pr-1 ${compact ? 'max-h-[240px]' : 'max-h-[380px]'}`}>
      {kind === 'partner' ? (
        <ul className="space-y-1.5">
          {list.map(({ p, r }) => {
            const sel = o.partnerId === p.id;
            return (
              <li key={p.id}>
                <button
                  data-selected={sel}
                  onClick={() => setOption(which, optionForPartner(o, p))}
                  className={`flex w-full items-center gap-3 text-left transition-colors duration-150 ${tile} ${sel ? 'bg-coal text-white' : compact ? 'hover:bg-paper' : 'bg-white/60 hover:bg-white'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className={`truncate font-semibold ${compact ? 'text-[13px]' : 'text-[15px]'}`}>{p.name}</div>
                    <div className={`truncate text-[11px] ${sel ? 'text-white/55' : 'text-muted'}`}>
                      {p.location || COUNTRY_NAMES[p.country]} · {num0(p.km)} km{p.filmT === 0 ? ' · no film in 2025' : ''}
                    </div>
                  </div>
                  {!p.locationVerified && <EstimatedChip label="Unverified" />}
                  <span className={`whitespace-nowrap font-mono text-[12px] tabular-nums ${sel ? 'text-lime' : ''}`}>{signed0(r.netPerT)}<span className="opacity-60"> kg/t</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-4">
          {countries.map((country) => (
            <div key={country}>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{COUNTRY_NAMES[country]} · grid {active.grid[country]} kg/kWh</div>
              <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {cities.filter((c) => c.country === country).map((c) => {
                  const sel = o.destKind === 'city' && o.cityId === c.id;
                  return (
                    <button key={c.id} data-selected={sel} onClick={() => setOption(which, optionForCity(o, c, factors))} className={`text-left transition-colors ${tile} ${sel ? 'bg-coal text-white' : `${surface} hover:bg-lime-100`}`}>
                      <div className={`font-semibold ${compact ? 'text-[13px]' : 'text-[15px]'}`}>{c.name}</div>
                      <div className={`font-mono text-[11px] ${sel ? 'text-lime' : 'text-muted'}`}>~{num0(cityKm(c, factors))} km{c.seaKm ? ' · ferry' : ''}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted">City distances are estimates (straight line × 1.25 road factor) and can be edited. A city uses that country's grid and the default recycling yield.</p>
        </div>
      )}
      </div>
    </div>
  );
}

const CASES: { value: Scenario; label: string; text: string }[] = [
  { value: 'low', label: 'Low', text: 'Every uncertain factor at the bound that gives the lowest net emissions.' },
  { value: 'base', label: 'Base', text: 'Best-estimate values. Recommended for reports.' },
  { value: 'high', label: 'High', text: 'Every uncertain factor at the bound that gives the highest net emissions.' },
];
const ELEC: { value: ElecMethod; label: string; text: string }[] = [
  { value: 'location', label: 'Grid average', text: 'Location-based: the average grid intensity of each country.' },
  { value: 'residual', label: 'Latvian residual mix', text: 'Market-based 0.452 kg CO2e/kWh for Latvia, from the Nordic Plast LCA.' },
];

function ChoiceGroup<T extends string>({ label, value, options, onChange, info, compact = false }: {
  label: string; value: T; options: { value: T; label: string; text: string }[]; onChange: (v: T) => void; info?: ReactNode; compact?: boolean;
}) {
  if (compact) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}{info}</div>
        <Segmented size="sm" value={value} onChange={onChange} options={options.map((o) => ({ value: o.value, label: o.label, title: o.text }))} />
      </div>
    );
  }
  return (
    <div>
      <div className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-muted">{label}{info}</div>
      <div className={`grid gap-3 ${options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map((o) => {
          const sel = o.value === value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)} className={`rounded-3xl p-5 text-left transition-colors duration-200 ${sel ? 'bg-coal text-white' : 'bg-white hover:bg-lime-100'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-bold tracking-[-0.01em]">{o.label}</span>
                {sel && <Check size={16} className="text-lime" />}
              </div>
              <p className={`mt-2 text-[12px] leading-relaxed ${sel ? 'text-white/60' : 'text-muted'}`}>{o.text}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsFields({ compact = false }: { compact?: boolean }) {
  const scenario = useApp((s) => s.scenario);
  const setScenario = useApp((s) => s.setScenario);
  const elec = useApp((s) => s.elec);
  const setElec = useApp((s) => s.setElec);
  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      <ChoiceGroup
        compact={compact} label="Uncertainty case" value={scenario} options={CASES} onChange={setScenario}
        info={<InfoTip title="Uncertainty case" note="Low and High set every ranged factor (collection, sorting, transport, yield, electricity use, virgin LDPE, substitution) to the bound that lowers or raises net emissions." factorIds={['V3', 'P3', 'V1', 'P1']} />}
      />
      <ChoiceGroup compact={compact} label="Electricity" value={elec} options={ELEC} onChange={setElec} info={<InfoTip title="Electricity method" factorIds={['G1', 'G7']} />} />
    </div>
  );
}

const MODES: { mode: Mode; icon: typeof Truck; factor: 'roadKgPerTkm' | 'railKgPerTkm' | 'seaKgPerTkm'; fid: string }[] = [
  { mode: 'road', icon: Truck, factor: 'roadKgPerTkm', fid: 'T1' },
  { mode: 'road+ferry', icon: Ship, factor: 'seaKgPerTkm', fid: 'T3' },
  { mode: 'rail', icon: TrainFront, factor: 'railKgPerTkm', fid: 'T4' },
];

const MODE_ART: Record<Mode, IllustrationName> = { road: 'truck', rail: 'train', 'road+ferry': 'ferry' };
const TILE_NAME: Record<Mode, string> = { road: 'Truck', rail: 'Rail', 'road+ferry': 'Ferry' };

/**
 * Transport tiles. Across the sea (Finland) a truck cannot go alone, so the truck and ferry tiles
 * are selected together as one combined trip and rail is unavailable.
 */
function ModePicker({ which, compact = false }: { which: 'a' | 'b'; compact?: boolean }) {
  const o = useApp((s) => s[which])!;
  const patch = useApp((s) => s.patchOption);
  const partners = useApp((s) => s.partners);
  const { active } = useParams();
  const meta = resolveOption(o, partners);
  const country = meta.input.country;
  const sea = ferryAvailable(country);
  const current = feasibleMode(o.mode, country);
  const pick = (mode: Mode) => {
    const m = feasibleMode(mode, country);
    patch(which, { mode: m, seaKm: m === 'road+ferry' ? o.seaKm || defaultSeaKm(country) || 80 : o.seaKm });
  };
  return (
    <div>
      <div className={`relative grid grid-cols-3 ${compact ? 'gap-2' : 'gap-3'}`}>
        {MODES.map(({ mode, icon: Icon, factor }) => {
          const disabled = sea ? mode === 'rail' : mode === 'road+ferry';
          const sel = current === mode || (current === 'road+ferry' && mode === 'road');
          return (
            <button
              key={mode}
              disabled={disabled}
              title={disabled ? (sea ? 'No rail link across the sea' : 'No ferry link on this route') : undefined}
              onClick={() => pick(mode)}
              className={`text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? 'rounded-2xl p-2.5' : 'rounded-3xl p-5'} ${sel ? 'bg-coal text-white' : compact ? 'bg-paper hover:bg-line' : 'bg-white hover:bg-lime-100'}`}
            >
              {compact ? (
                <Icon size={16} className={sel ? 'text-lime' : ''} />
              ) : (
                <IconTile selected={sel} size={96} radius={26}>
                  <Illustration name={MODE_ART[mode]} tone={disabled ? 'muted' : 'light'} size={76} />
                </IconTile>
              )}
              <div className={`font-semibold ${compact ? 'mt-1.5 text-[12px]' : 'mt-5 text-[16px] font-bold tracking-[-0.01em]'}`}>{TILE_NAME[mode]}</div>
              {!compact && (
                <div className={`mt-0.5 font-mono text-[11px] ${sel ? 'text-white/55' : 'text-muted'}`}>
                  {mode === 'road+ferry' ? 'sea leg ' : sea && mode === 'road' ? 'road legs ' : ''}{active[factor]} kg/t·km
                </div>
              )}
              {!compact && disabled && <div className="mt-2 text-[11px]">{sea ? 'No rail link across the sea' : 'No ferry link on this route'}</div>}
              {!compact && !disabled && mode !== 'road' && <div className="mt-2"><EstimatedChip /></div>}
            </button>
          );
        })}
        {current === 'road+ferry' && (
          <motion.span
            key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.35, ease: EASE }}
            className={`pointer-events-none absolute top-1/2 z-10 -mt-4 flex -translate-x-1/2 items-center justify-center rounded-full bg-lime font-bold text-coal shadow-card ring-4 ring-paper ${compact ? 'h-6 w-6 text-[13px]' : 'h-8 w-8 text-[17px]'}`}
            style={{ left: compact ? 'calc((100% - 16px) / 3 + 4px)' : 'calc((100% - 24px) / 3 + 6px)' }}
            aria-hidden="true"
          >
            +
          </motion.span>
        )}
      </div>
      {sea && !compact && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-lime-100 px-4 py-3 text-[13px] leading-snug">
          <Ship size={15} className="mt-0.5 shrink-0" />
          <span>
            <b>{meta.label}</b> is across the Baltic Sea, so this trip uses two vehicles: a truck from Riga to Tallinn, the ferry to Helsinki
            ({num0(o.seaKm || defaultSeaKm(country))} km by sea) and the truck on to the recycler. Both legs are counted.
          </span>
        </p>
      )}
    </div>
  );
}

function Toggle({ on, onChange, label, info }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; info?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <button
        role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? 'bg-coal' : 'bg-line'}`}
      >
        <motion.span className={`absolute top-1 h-4 w-4 rounded-full ${on ? 'bg-lime' : 'bg-white'}`} animate={{ left: on ? 24 : 4 }} transition={{ duration: 0.25, ease: EASE }} />
      </button>
      <span className="text-[13px] font-semibold">{label}</span>
      {info}
    </div>
  );
}

function DistanceFields({ which }: { which: 'a' | 'b' }) {
  const o = useApp((s) => s[which])!;
  const patch = useApp((s) => s.patchOption);
  const field = 'w-full bg-transparent text-[22px] font-bold tracking-[-0.03em] tabular-nums outline-none';
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="rounded-3xl bg-white px-5 py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">Distance from Riga, km <span className="h-1.5 w-1.5 rounded-full bg-amber" title="Estimated road distance" /></span>
        <input type="number" min={0} value={o.km} onChange={(e) => patch(which, { km: Math.max(0, +e.target.value) })} className={field} />
      </label>
      {o.mode === 'road+ferry' && (
        <label className="rounded-3xl bg-white px-5 py-3">
          <span className="text-[11px] font-semibold text-muted">of which by sea, km</span>
          <input type="number" min={0} value={o.seaKm} onChange={(e) => patch(which, { seaKm: Math.max(0, +e.target.value) })} className={field} />
        </label>
      )}
    </div>
  );
}

function EmptyReturn({ which }: { which: 'a' | 'b' }) {
  const o = useApp((s) => s[which])!;
  const patch = useApp((s) => s.patchOption);
  return (
    <Toggle
      on={o.emptyReturn} onChange={(v) => patch(which, { emptyReturn: v })} label="Return trip empty"
      info={<InfoTip title="Empty return leg" formula="Transport × (1 + empty-return share)" note="Use for dedicated one-way shipments. Average road factors already include typical empty running." factorIds={['T6']} />}
    />
  );
}

function StepTransport({ which }: { which: 'a' | 'b' }) {
  return (
    <div className="space-y-6">
      <ModePicker which={which} />
      <DistanceFields which={which} />
      <EmptyReturn which={which} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Find the best route                                                 */
/* ------------------------------------------------------------------ */

type Candidate = ReturnType<typeof candidates>[number];
interface Scan { list: Candidate[]; i: number; best: number; done: boolean }

/**
 * Tries every verified recycler and feasible mode for option A one after another on the map,
 * keeping the lowest net per tonne, then makes the winner option A. The pacing is only for
 * visual understanding; the ranking itself is the same as "Most efficient ways".
 */
function useBestRoute() {
  const a = useApp((s) => s.a)!;
  const partners = useApp((s) => s.partners);
  const setOption = useApp((s) => s.setOption);
  const showToast = useApp((s) => s.showToast);
  const { active } = useParams();
  const reduce = useReducedMotion();
  const [scan, setScan] = useState<Scan | null>(null);

  const start = () => {
    // Sweep outwards from Riga, nearest first.
    const list = candidates(a, partners, active).sort((x, y) => x.r.km - y.r.km);
    if (!list.length) return showToast('No verified recycler to compare for this material');
    setScan({ list, i: 0, best: 0, done: false });
  };

  useEffect(() => {
    if (!scan) return;
    if (scan.done) {
      const t = setTimeout(() => {
        const best = scan.list[scan.best];
        const same = optionKey(best.option) === optionKey(a);
        setOption('a', best.option);
        setScan(null);
        showToast(same ? 'Your route is already the most efficient one' : `Best route: ${best.meta.label}, ${MODE_NAME[best.r.mode].toLowerCase()}`);
      }, reduce ? 0 : 1400);
      return () => clearTimeout(t);
    }
    const step = reduce ? 0 : Math.min(280, Math.max(120, 2800 / scan.list.length));
    const t = setTimeout(() => setScan((s) => {
      if (!s) return s;
      if (s.i >= s.list.length - 1) return { ...s, done: true };
      const i = s.i + 1;
      return { ...s, i, best: s.list[i].r.netPerT < s.list[s.best].r.netPerT ? i : s.best };
    }), step);
    return () => clearTimeout(t);
  }, [scan]); // eslint-disable-line react-hooks/exhaustive-deps

  const routes = scan && [
    ...scan.list.slice(0, scan.i).map((c, k) => ({ ...toRoute(`tried-${k}`, { ...c, params: active }, C.stone), width: 2, quiet: true })),
    ...(!scan.done && scan.i !== scan.best ? [{ ...toRoute('trying', { ...scan.list[scan.i], params: active }, C.lime700), width: 4 }] : []),
    { ...toRoute('best', { ...scan.list[scan.best], params: active }, C.coal), width: scan.done ? 7 : 4.5 },
  ];
  const fitTo = useMemo(() => scan?.list.map((c, k) => toRoute(`fit-${k}`, { ...c, params: active })), [scan?.list, active]); // eslint-disable-line react-hooks/exhaustive-deps
  return { scan, start, routes, fitTo };
}

function ScanPanel({ scan }: { scan: Scan }) {
  const cur = scan.list[scan.i];
  const best = scan.list[scan.best];
  return (
    <>
      {!scan.done && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 left-0 z-[450] w-1/3 bg-gradient-to-r from-transparent via-lime/25 to-transparent"
          initial={{ x: '-100%' }} animate={{ x: '300%' }} transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
        />
      )}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}
        className="pointer-events-none absolute left-3 top-3 z-[600] w-[290px] max-w-[calc(100%-24px)] rounded-2xl bg-white/95 p-4 shadow-card backdrop-blur"
      >
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          {scan.done ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-lime"><Check size={12} /></motion.span>
          ) : (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-coal" />
          )}
          {scan.done ? 'Best route found' : `Trying route ${scan.i + 1} of ${scan.list.length}`}
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-lime-600 transition-[width] duration-150" style={{ width: `${((scan.i + 1) / scan.list.length) * 100}%` }} />
        </div>
        {!scan.done && (
          <div className="mt-3 truncate text-[12px]">
            <span className="text-muted">Now: </span>{cur.meta.label} · {MODE_NAME[cur.r.mode]} · <span className="font-mono tabular-nums">{signed0(cur.r.netPerT)} kg/t</span>
          </div>
        )}
        <div className={`mt-2 rounded-xl px-3 py-2 transition-colors duration-300 ${scan.done ? 'bg-coal text-white' : 'bg-paper'}`}>
          <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{scan.done ? 'Most efficient' : 'Best so far'}</div>
          <div className="truncate text-[13px] font-semibold">{best.meta.label} · {MODE_NAME[best.r.mode]}</div>
          <div className="font-mono text-[11px] tabular-nums">{signed0(best.r.netPerT)} kg CO2e/t</div>
        </div>
      </motion.div>
    </>
  );
}

/** Result page: results only. Inputs are changed by going back into the flow. */
function Results() {
  const a = useApp((s) => s.a);
  const b = useApp((s) => s.b);
  const partners = useApp((s) => s.partners);
  const factors = useApp((s) => s.factors);
  const setStep = useApp((s) => s.setStep);
  const setEditing = useApp((s) => s.setEditing);
  const setOption = useApp((s) => s.setOption);
  const saveRecord = useApp((s) => s.saveRecord);
  const newSearch = useApp((s) => s.newSearch);
  const { active } = useParams();
  const A = useOption(a)!;
  const B = useOption(b);
  const routes = [toRoute('a', A, C.coal), ...(B ? [toRoute('b', B, C.lime700)] : [])];
  const best = useBestRoute();

  const points = useMemo<MapPoint[]>(() => [
    ...partners.filter((p) => p.filmT > 0).map((p) => ({ id: `p:${p.id}`, kind: 'partner' as const, lat: p.lat, lng: p.lng, label: p.name, sub: p.location || COUNTRY_NAMES[p.country], verified: p.locationVerified })),
    ...CITIES.map((c) => ({ id: `c:${c.id}`, kind: 'city' as const, lat: c.lat, lng: c.lng, label: c.name, sub: COUNTRY_NAMES[c.country], verified: true })),
  ], [partners]);

  const optionAt = (id: string, base: PlanOption): PlanOption => {
    if (id.startsWith('p:')) return optionForPartner(base, partners.find((p) => p.id === id.slice(2))!);
    return optionForCity(base, CITIES.find((c) => c.id === id.slice(2))!, factors);
  };

  const popover = (id: string, close: () => void) => {
    const opt = optionAt(id, a);
    const { r, meta } = optionResult(opt, partners, active);
    const diff = r.netPerT - A.r.netPerT;
    return (
      <div className="w-64">
        <div className="text-[14px] font-bold leading-tight">{meta.label}</div>
        <div className="text-[11px] text-muted">{meta.sub}</div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">Net per tonne</div>
            <div className="text-[22px] font-bold tabular-nums tracking-[-0.03em]">{signed0(r.netPerT)} <span className="font-mono text-[10px] font-normal text-muted">kg/t</span></div>
          </div>
          <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${diff < -0.5 ? 'bg-lime' : diff > 0.5 ? 'bg-paper' : 'bg-paper text-muted'}`}>
            {Math.abs(diff) < 0.5 ? 'same as A' : `${diff < 0 ? '−' : '+'}${num0(Math.abs(diff))} vs A`}
          </span>
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted">{MODE_NAME[r.mode]} · {num0(r.km)} km · net {signedT(r.net)} t</div>
        <div className="mt-3 flex gap-1.5">
          <button onClick={() => { setOption('a', opt); close(); }} className="flex-1 rounded-full bg-coal px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-olive">Send A here</button>
          <button onClick={() => { setOption('b', opt); close(); }} className="flex-1 rounded-full bg-lime px-3 py-1.5 text-[11px] font-semibold hover:bg-lime-600">Compare as B</button>
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: EASE }} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="light" onClick={() => { setEditing('a'); setStep(0); }}><Pencil size={13} /> Edit inputs</Button>
        {b ? (
          <>
            <Button variant="light" onClick={() => { setEditing('b'); setStep(1); }}><Pencil size={13} /> Edit option B</Button>
            <Button variant="ghost" onClick={() => setOption('b', null)}><X size={13} /> Remove B</Button>
          </>
        ) : (
          <Button variant="light" onClick={() => { setOption('b', { ...a }); setEditing('b'); setStep(1); }}><Plus size={13} /> Compare with another option</Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button onClick={() => saveRecord(snapshotOf(A))}><Save size={13} /> Save to record</Button>
          <Button variant="ghost" onClick={newSearch}><RotateCcw size={13} /> New search</Button>
        </div>
      </div>
      <div className={`grid gap-5 ${B ? 'md:grid-cols-2' : ''}`}>
        <ResultHero tag="A" calc={A} wide={!B} />
        {B && <ResultHero tag="B" calc={B} />}
      </div>
      {B && <DeltaCard A={A} B={B} />}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="overflow-hidden p-5 xl:col-span-2">
          <CardTitle
            sub="Scroll to zoom, drag to move. Click any recycler or city to try it as A or B."
            right={
              <Button variant="lime" onClick={best.start} disabled={!!best.scan} className="shrink-0">
                <Sparkles size={13} /> {best.scan ? 'Searching…' : 'Find the best route'}
              </Button>
            }
          >
            Route map
          </CardTitle>
          <div className="relative overflow-hidden rounded-2xl">
            <GeoMap
              interactive routes={best.routes ?? routes} fitTo={best.fitTo} points={points} renderPopover={popover} className="h-[480px]"
              maxTonnes={Math.max(a.tonnes, b?.tonnes ?? 0)}
            />
            {best.scan && <ScanPanel scan={best.scan} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-coal" /> Option A</span>
            {B && <span className="flex items-center gap-1.5"><span className="h-1 w-5 rounded-full bg-lime-700" /> Option B</span>}
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-coal bg-white" /> Recycler</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-2 border-muted/60 bg-white" /> Recycler, location unverified</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 bg-stone" /> City</span>
            <span>Dotted route = location unverified</span>
          </div>
        </Card>
        <StagesCard A={A} B={B} />
      </div>
      <Recommendations />
    </motion.div>
  );
}

function ResultHero({ tag, calc, wide = false }: { tag: 'A' | 'B'; calc: OptionCalc; wide?: boolean }) {
  const { r, low, high, meta, params } = calc;
  return (
    <Card dark={tag === 'A' ? true : 'lime'} pins className="overflow-hidden p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-mono text-[11px] uppercase tracking-[0.16em] ${tag === 'A' ? 'text-white/50' : 'text-coal/60'}`}>Option {tag}</div>
          <div className="mt-1.5 truncate text-[17px] font-bold tracking-[-0.02em]">{meta.label}</div>
          <div className={`truncate text-[12px] ${tag === 'A' ? 'text-white/55' : 'text-coal/60'}`}>
            {num0(r.tonnes)} t · {MODE_NAME[r.mode]} · {num0(r.km)} km{calc.meta.input.emptyReturn ? ' · empty return' : ''}
          </div>
        </div>
        {!meta.verified && <EstimatedChip label="Location unverified" />}
      </div>
      <div className={`mt-6 flex flex-wrap items-end ${wide ? 'gap-10' : 'gap-6'}`}>
        <div>
          <div className={`flex items-center gap-1 text-[12px] ${tag === 'A' ? 'text-white/55' : 'text-coal/60'}`}>
            Net emissions
            <InfoTip dark={tag === 'A'} title="Net emissions" formula="NET = CAUSED − AVOIDED" calc={`= ${t1(r.caused)} − ${t1(r.avoided)} = ${signedT(r.net)} t CO2e`} factorIds={['P4', 'P2', 'T1', 'P1', 'P3', 'V1', 'V3']} />
          </div>
          <AnimatedNumber value={r.net / 1000} format={(n) => `${n < 0 ? '−' : ''}${num1(Math.abs(n))}`} className={`font-bold leading-none tracking-[-0.05em] ${wide ? 'text-[76px]' : 'text-[56px]'} ${tag === 'A' ? 'text-lime' : 'text-coal'}`} />
          <div className={`mt-1 font-mono text-[11px] ${tag === 'A' ? 'text-white/50' : 'text-coal/60'}`}>t CO2e</div>
        </div>
        <div className={`border-l pl-6 ${tag === 'A' ? 'border-white/15' : 'border-coal/20'}`}>
          <div className={`flex items-center gap-1 text-[12px] ${tag === 'A' ? 'text-white/55' : 'text-coal/60'}`}>
            Per tonne
            <InfoTip dark={tag === 'A'} title="Emissions per tonne" formula="NET ÷ tonnes" calc={`= ${signedT(r.net)} t ÷ ${num0(r.tonnes)} t = ${signed0(r.netPerT)} kg CO2e/t`} note="Use this to compare options with different volumes fairly." />
          </div>
          <AnimatedNumber value={r.netPerT} format={(n) => signed0(n)} className={`font-bold leading-none tracking-[-0.04em] ${wide ? 'text-[44px]' : 'text-[34px]'}`} />
          <div className={`mt-1 font-mono text-[11px] ${tag === 'A' ? 'text-white/50' : 'text-coal/60'}`}>kg CO2e / t</div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${tag === 'A' ? 'bg-white/10' : 'bg-coal/10'}`}>Caused {t1(r.caused)} t</span>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${tag === 'A' ? 'bg-lime text-coal' : 'bg-coal text-lime'}`}>Avoided {t1(r.avoided)} t</span>
        <span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${tag === 'A' ? 'bg-white/10' : 'bg-coal/10'}`}>Pellets {num1(r.pellets)} t</span>
      </div>
      <div className="mt-6">
        <RangeBar dark={tag === 'A'} low={low.net / 1000} base={r.net / 1000} high={high.net / 1000} format={(n) => `${n < 0 ? '−' : ''}${num1(Math.abs(n))}`} />
      </div>
      <span className="sr-only">{params.scenario}</span>
    </Card>
  );
}

function DeltaCard({ A, B }: { A: OptionCalc; B: OptionCalc }) {
  const d = B.r.net - A.r.net;
  const dPerT = B.r.netPerT - A.r.netPerT;
  const better = dPerT < 0 ? 'B' : 'A';
  return (
    <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 p-6">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Difference B − A</div>
        <div className="mt-1 flex items-baseline gap-2">
          <AnimatedNumber value={d / 1000} format={(n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${num1(Math.abs(n))}`} className="text-[40px] font-bold leading-none tracking-[-0.04em]" />
          <span className="font-mono text-[12px] text-muted">t CO2e</span>
        </div>
      </div>
      <div>
        <div className="text-[12px] text-muted">Per tonne</div>
        <AnimatedNumber value={dPerT} format={(n) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${num0(Math.abs(n))}`} className="text-[26px] font-bold tracking-[-0.03em]" />
        <span className="ml-1 font-mono text-[11px] text-muted">kg/t</span>
      </div>
      <p className="max-w-sm flex-1 text-[15px] font-semibold leading-snug tracking-[-0.01em]">
        {Math.abs(dPerT) < 1 ? 'Both options are about the same per tonne.' : (
          <>Option {better} is <span className="rounded-md bg-lime px-1.5">{num0(Math.abs(dPerT))} kg CO2e/t lower</span> per tonne.</>
        )}
      </p>
    </Card>
  );
}

function stageFormula(s: Stage, r: PartnerResult, p: Params, emptyReturn: boolean) {
  switch (s) {
    case 'collection': return `${num1(r.tonnes)} t × ${p.collectionKgPerT} kg/t`;
    case 'sorting': return `${num1(r.tonnes)} t × ${p.sortingKwhPerT} kWh/t × ${p.grid.LV} kg/kWh`;
    case 'transport': return `${num1(r.tonnes)} t × ${num0(r.km)} km × ${num2(r.tkm ? r.stages.transport / r.tkm / (emptyReturn ? 1 + p.emptyReturnShare : 1) : 0)} kg/t·km${emptyReturn ? ` × ${1 + p.emptyReturnShare}` : ''}`;
    case 'recycling': return `${num1(r.tonnes)} t × ${r.yield.toFixed(2)} × ${num0(r.kwhPerTPellets)} kWh/t × ${r.grid} kg/kWh`;
  }
}

function StagesCard({ A, B }: { A: OptionCalc; B: OptionCalc | null }) {
  const rows: { key: Stage | 'avoided'; label: string }[] = [...STAGES.map((s) => ({ key: s, label: STAGE_LABEL[s] })), { key: 'avoided', label: 'Avoided' }];
  const val = (c: OptionCalc, k: Stage | 'avoided') => (k === 'avoided' ? c.r.avoided : c.r.stages[k]);
  const max = Math.max(...rows.flatMap((x) => [val(A, x.key), B ? val(B, x.key) : 0]), 1);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <CardTitle sub="t CO2e. Hover a bar for its formula." right={<InfoTip title="Stage formulas" factorIds={['P4', 'P2', 'G1', 'T1', 'T6', 'P1', 'P3', 'V1', 'V3']} />}>Stage breakdown</CardTitle>
      <div className="space-y-4">
        {rows.map((row, i) => (
          <div key={row.key}>
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-2 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.key === 'avoided' ? C.lime : STAGE_COLORS[row.key], outline: row.key === 'avoided' || row.key === 'collection' ? `1px solid ${C.olive}` : undefined }} />
                {row.label}
              </span>
              <span className="font-mono tabular-nums text-muted">
                <span className="text-coal">{row.key === 'avoided' ? '−' : ''}{t1(val(A, row.key))}</span>
                {B && <> · <span className="text-lime-700">{row.key === 'avoided' ? '−' : ''}{t1(val(B, row.key))}</span></>}
              </span>
            </div>
            {([['a', A], ...(B ? [['b', B]] : [])] as [string, OptionCalc][]).map(([id, c], j) => {
              const k = `${row.key}-${id}`;
              return (
                <div key={id} className="relative" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
                  <div className={j ? 'mt-1' : ''}>
                    <GrowBar
                      value={val(c, row.key) / max} delay={i * 0.08 + j * 0.05}
                      color={id === 'b' ? C.lime700 : row.key === 'avoided' ? C.lime : C.coal}
                      outline={row.key === 'avoided' && id === 'a' ? C.lime700 : undefined}
                    />
                  </div>
                  {hover === k && (
                    <div className="absolute bottom-4 left-0 z-20 w-max max-w-[300px] rounded-xl bg-coal px-3 py-2 font-mono text-[10.5px] leading-relaxed text-white shadow-card">
                      {id.toUpperCase()} · {row.label} = {row.key === 'avoided'
                        ? `${num1(c.r.pellets)} t pellets × ${c.params.substitution} × ${num0(c.params.virginKgPerT)} kg/t`
                        : stageFormula(row.key, c.r, c.params, !!c.meta.input.emptyReturn)}
                      <br />= {t1(val(c, row.key))} t CO2e
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Recommendations() {
  const a = useApp((s) => s.a);
  const b = useApp((s) => s.b);
  const partners = useApp((s) => s.partners);
  const setOption = useApp((s) => s.setOption);
  const { active } = useParams();
  const [all, setAll] = useState(false);
  const recs = useMemo(() => recommend(a, partners, active, 4, !all), [a, partners, active, all]);
  const currentKey = optionKey(a);
  return (
    <Card className="p-6">
      <CardTitle
        sub={`Every 2025 film recycler and feasible mode for ${num0(a.tonnes)} t, ranked by net emissions per tonne`}
        right={
          <div className="flex items-center gap-3">
            <Toggle on={all} onChange={setAll} label={<span className="text-[12px] font-semibold text-muted">Include unverified</span>} />
            <InfoTip title="How options are ranked" note="Each partner that handled LDPE film in 2025 is calculated with the same formulas. By default only partners with a verified location are ranked; unverified partners use country-default distances and the default yield (0.75), which can flatter them. Rail is only offered above 200 km; ferry only where a sea leg exists. Rail and ferry factors are estimates." factorIds={['T4', 'T3', 'P3', 'P3-NP']} />
          </div>
        }
      >
        <span className="inline-flex items-center gap-2"><Sparkles size={15} /> Most efficient ways</span>
      </CardTitle>
      <ol className="grid gap-3 md:grid-cols-2">
        {recs.map(({ option, r, meta }, i) => {
          const isA = optionKey(option) === currentKey;
          return (
            <motion.li
              key={optionKey(option)}
              initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.55, ease: EASE, delay: i * 0.09 }}
              className={`flex items-center gap-4 rounded-2xl p-4 ${i === 0 ? 'bg-coal text-white' : 'bg-paper'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[14px] font-bold ${i === 0 ? 'bg-lime text-coal' : 'bg-white'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">{meta.label}</span>
                  {!meta.verified && <EstimatedChip label="Unverified" />}
                  {meta.input.yieldOverride !== null && <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${i === 0 ? 'bg-white/10' : 'bg-white'}`}>measured</span>}
                </div>
                <div className={`text-[11px] ${i === 0 ? 'text-white/55' : 'text-muted'}`}>{MODE_NAME[r.mode]} · {num0(r.km)} km · {signed0(r.netPerT)} kg CO2e/t</div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  disabled={isA}
                  onClick={() => setOption('a', { ...option, emptyReturn: a.emptyReturn, material: a.material })}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${i === 0 ? 'bg-lime text-coal hover:bg-lime-600' : 'bg-coal text-white hover:bg-olive'}`}
                >
                  {isA ? 'In A' : 'Use as A'}
                </button>
                <button
                  onClick={() => setOption('b', { ...option, emptyReturn: a.emptyReturn, material: a.material })}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${i === 0 ? 'bg-white/10 hover:bg-white/20' : 'bg-white hover:bg-line'}`}
                >
                  {b && optionKey(b) === optionKey(option) ? 'In B' : 'As B'}
                </button>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* With LZP vs without                                                 */
/* ------------------------------------------------------------------ */

export const reductionSentence = (lo: number, hi: number) =>
  `Working with LZP reduces the emissions of your packaging by ${num1(Math.min(lo, hi) / 1000)}–${num1(Math.max(lo, hi) / 1000)} t CO2e per year.`;

/** Customer comparison using a given option (route) as the "with LZP" recycling path. */
export function customerRange(customer: { filmT: number; recycledShare: number; lzpShare: number }, meta: ResolvedOption, all: { low: Params; base: Params; high: Params }) {
  const run = (p: Params) => customerComparison(customer, p, portfolioImpact([{ ...meta.input, tonnes: Math.max(customer.filmT, 1) }], p));
  return { low: run(all.low), base: run(all.base), high: run(all.high) };
}

export function Slider({ label, value, onChange, format, info }: { label: string; value: number; onChange: (v: number) => void; format: (v: number) => string; info?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1 font-semibold text-muted">{label}{info}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums">{format(value)}</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(+e.target.value)} className="lzp-range w-full" />
    </label>
  );
}

export function EolTable({ r, staticMode = false }: { r: CustomerResult; staticMode?: boolean }) {
  const rows: { label: string; key: 'incineration' | 'landfill' | 'recyclingCaused' | 'recyclingAvoided'; color: string; sign: 1 | -1 }[] = [
    { label: 'Incineration', key: 'incineration', color: C.coal, sign: 1 },
    { label: 'Landfill', key: 'landfill', color: C.stone, sign: 1 },
    { label: 'Recycling, caused', key: 'recyclingCaused', color: C.olive, sign: 1 },
    { label: 'Recycling, avoided', key: 'recyclingAvoided', color: C.lime, sign: -1 },
  ];
  const max = Math.max(r.without.caused, r.with.caused, r.without.avoided, r.with.avoided, 1);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {([['Without LZP', r.without], ['With LZP', r.with]] as const).map(([title, e], col) => (
        <div key={title} className={`rounded-2xl p-5 ${col ? 'bg-lime-100' : 'bg-paper'}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-[15px] font-bold tracking-[-0.01em]">{title}</div>
            <div className="font-mono text-[11px] text-muted">{num1(e.recycledT)} t recycled · {num1(e.incineratedT)} t incinerated · {num1(e.landfilledT)} t landfill</div>
          </div>
          <div className="mt-4 space-y-2.5">
            {rows.map((row, i) => (
              <div key={row.key} className="grid grid-cols-[130px_1fr_64px] items-center gap-2 text-[12px]">
                <span className="text-muted">{row.label}</span>
                {staticMode ? (
                  <div className="h-2.5 rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ width: pct(e[row.key] / max), background: row.color }} />
                  </div>
                ) : (
                  <GrowBar value={e[row.key] / max} color={row.color} track="bg-white" delay={col * 0.15 + i * 0.08} outline={row.key === 'recyclingAvoided' ? C.olive : undefined} />
                )}
                <span className="text-right font-mono tabular-nums">{row.sign < 0 && e[row.key] > 0 ? '−' : ''}{t1(e[row.key])}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-coal/10 pt-3 text-[12px]">
            <span>Caused <span className="font-mono">{t1(e.caused)}</span> · Avoided <span className="font-mono">{t1(e.avoided)}</span></span>
            <span className="font-bold">Net <span className="font-mono">{e.net < 0 ? '−' : ''}{t1(Math.abs(e.net))}</span> <span className="font-mono text-[11px] font-normal text-muted">t CO2e</span></span>
          </div>
        </div>
      ))}
    </div>
  );
}
