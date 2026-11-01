import { motion } from 'framer-motion';
import { ArrowRight, Car, Flame, Recycle, Sprout } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { InfoTip } from '../components/InfoTip';
import { AnimatedNumber, Card, CardTitle, EstimatedChip, RangeBar, useSeen } from '../components/ui';
import { num0, num1, pct } from '../lib/format';
import { MODE_NAME, resolveOption } from '../lib/planner';
import { C, EASE } from '../lib/theme';
import { useApp } from '../store/useApp';
import { useParams } from '../store/useResults';
import { EolTable, Slider, customerRange, reductionSentence } from './Planner';

const t1 = (kg: number) => num1(kg / 1000);
const signedT = (kg: number) => `${kg < 0 ? '−' : kg > 0 ? '+' : ''}${num1(Math.abs(kg) / 1000)}`;
const EARTH_KM = 40_075;

/**
 * "With LZP vs without": why recycling a customer's film through LZP is better than today's
 * EU-average end of life. Every figure comes from the same calculation as the Route planner;
 * the car comparison is only an illustration (factor Q1).
 */
export function WithLzp() {
  const customer = useApp((s) => s.customer);
  const setCustomer = useApp((s) => s.setCustomer);
  const customerName = useApp((s) => s.customerName);
  const setCustomerName = useApp((s) => s.setCustomerName);
  const a = useApp((s) => s.a);
  const partners = useApp((s) => s.partners);
  const factors = useApp((s) => s.factors);
  const { all, scenario, active } = useParams();
  const meta = resolveOption(a, partners);
  const c = useMemo(() => customerRange(customer, meta, all), [customer, meta, all]);
  const r = c[scenario];
  const carKgPerKm = factors.find((f) => f.id === 'Q1')?.base ?? 0.1066;

  const better = r.reduction > 0;
  const flips = r.without.net > 0 && r.with.net < 0;
  const who = customerName.trim() ? `${customerName.trim()}’s` : 'Your';
  const moreRecycled = r.with.recycledT - r.without.recycledT;
  const lessBurned = r.without.incineratedT - r.with.incineratedT;
  const lessLandfill = r.without.landfilledT - r.with.landfilledT;
  const virginReplaced = (r.with.avoided - r.without.avoided) / active.virginKgPerT;
  const carKm = r.reduction / carKgPerKm;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Inputs */}
      <Card className="col-span-12 p-7 lg:col-span-4">
        <CardTitle sub="Defaults use EU averages. LZP recycling follows the route in Option A of the planner.">Customer</CardTitle>
        <div className="space-y-6">
          <label className="block rounded-2xl bg-paper px-3.5 py-2">
            <span className="text-[11px] font-semibold text-muted">Customer name</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Not set" className="w-full bg-transparent text-[15px] font-semibold outline-none" />
          </label>
          <label className="block rounded-2xl bg-paper px-3.5 py-2">
            <span className="text-[11px] font-semibold text-muted">LDPE film packaging, t per year</span>
            <input type="number" min={0} value={customer.filmT} onChange={(e) => setCustomer({ filmT: Math.max(0, +e.target.value) })} className="w-full bg-transparent text-[22px] font-bold tabular-nums outline-none" />
          </label>
          <Slider label="Recycled today (without LZP)" value={customer.recycledShare} onChange={(v) => setCustomer({ recycledShare: v })} format={(v) => pct(v)} info={<InfoTip title="Default: EU average" note="41% of EU plastic packaging is recycled; the rest goes 52.8% to incineration and 47.2% to landfill." factorIds={['E1', 'E2', 'E3']} />} />
          <Slider label="Collected and recycled by LZP" value={customer.lzpShare} onChange={(v) => setCustomer({ lzpShare: v })} format={(v) => pct(v)} />
          <div className="rounded-2xl bg-paper p-3.5 text-[12px]">
            <div className="font-semibold">LZP recycling route</div>
            <div className="text-muted">{meta.label} · {MODE_NAME[meta.input.mode]} · {num0(meta.input.km)} km</div>
          </div>
        </div>
      </Card>

      {/* Hero: the difference */}
      <Card dark pins className="col-span-12 flex flex-col p-8 lg:col-span-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">Why LZP{customerName ? ` · ${customerName}` : ''}</p>
        <h2 className="mt-3 max-w-3xl text-[30px] font-bold leading-[1.12] tracking-[-0.035em] text-white sm:text-[36px]">
          {!better
            ? 'Move “Collected and recycled by LZP” above today’s share to see the difference.'
            : flips
              ? <>{who} packaging stops adding to climate change and starts <span className="text-lime">saving emissions</span>.</>
              : <>{who} packaging causes <span className="text-lime">{pct(r.reduction / Math.max(1, Math.abs(r.without.net)))} less</span> climate impact with LZP.</>}
        </h2>

        <div className="mt-7 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <NetTile label="Without LZP" sub="Today: EU-average end of life" kg={r.without.net} />
          <div className="flex items-center justify-center text-lime"><ArrowRight size={28} className="rotate-90 sm:rotate-0" /></div>
          <NetTile label="With LZP" sub={`${pct(Math.max(customer.lzpShare, customer.recycledShare))} recycled via ${meta.label}`} kg={r.with.net} lime />
        </div>

        <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <div className="text-[13px] text-white/60">Difference every year</div>
            <div className="mt-1 flex items-end gap-2">
              <AnimatedNumber value={Math.max(0, r.reduction) / 1000} format={(n) => num1(n)} duration={1.4} className="text-[72px] font-extrabold leading-[0.9] tracking-[-0.06em] text-lime" />
              <span className="mb-1.5 font-mono text-[13px] text-white/60">t CO2e less</span>
              <span className="mb-1.5"><InfoTip dark title="Reduction" formula="Reduction = NET without LZP − NET with LZP" calc={`= ${t1(r.without.net)} − (${t1(r.with.net)}) = ${t1(r.reduction)} t CO2e`} factorIds={['E1', 'E2', 'E3', 'E4', 'E5', 'V1', 'V3']} /></span>
            </div>
          </div>
          <div className="min-w-[260px] flex-1">
            <RangeBar dark low={c.low.reduction / 1000} base={c.base.reduction / 1000} high={c.high.reduction / 1000} format={(n) => num1(n)} />
          </div>
        </div>
        <p className="mt-4 text-[13px] text-white/55">{reductionSentence(c.low.reduction, c.high.reduction)}</p>
      </Card>

      {/* Proof points */}
      <div className="col-span-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Proof i={0} icon={<Recycle size={18} />} value={moreRecycled} unit="t" title="more film recycled" text="Collected by LZP and turned into pellets instead of being burned or buried." />
        <Proof i={1} icon={<Flame size={18} />} value={lessBurned} unit="t" title="less film burned" text={`Incinerating LDPE releases about ${num1(active.incinerationKgPerT / 1000)} t CO2e per tonne. That is the biggest emission LZP removes.`} info={<InfoTip title="Incineration" note="Burning plastic film releases its fossil carbon as CO2." factorIds={['E2', 'E4']} />} />
        <Proof i={2} icon={<Sprout size={18} />} value={virginReplaced} unit="t" title="new plastic not made" text={`Recycled pellets replace new LDPE from oil and gas, which costs ${num0(active.virginKgPerT)} kg CO2e per tonne to make.`} info={<InfoTip title="Replacing new plastic" formula="extra pellets × substitution ratio" factorIds={['V1', 'V3']} />} />
        <Proof
          i={3} icon={<Car size={18} />} value={carKm} unit="km" title="of car driving, equivalent" estimated
          text={carKm >= EARTH_KM ? `About ${num1(carKm / EARTH_KM)} times around the Earth in an average new car.` : 'Driven by an average new EU car. Shown only to make the number easier to picture.'}
          info={<InfoTip title="Car equivalent" formula="Reduction ÷ car CO2 per km" calc={`= ${num0(r.reduction)} kg ÷ ${carKgPerKm} kg/km = ${num0(carKm)} km`} factorIds={['Q1']} />}
        />
      </div>

      {/* Where the film ends up */}
      <Card className="col-span-12 p-6 lg:col-span-7">
        <CardTitle sub={`${num0(customer.filmT)} t of LDPE film a year`}>Where the film ends up</CardTitle>
        <FateBars rows={[
          { label: 'Without LZP', e: r.without },
          { label: 'With LZP', e: r.with },
        ]} />
        {better && lessBurned + lessLandfill > 0.05 && (
          <p className="mt-5 rounded-2xl bg-lime-100 px-4 py-3 text-[13px] font-semibold">
            LZP keeps {num1(lessBurned + lessLandfill)} t of film a year out of incinerators and landfill.
          </p>
        )}
      </Card>

      {/* Climate balance */}
      <Card className="col-span-12 p-6 lg:col-span-5">
        <CardTitle sub="Net t CO2e per year. Right of zero adds emissions, left of zero saves them.">Climate balance</CardTitle>
        <Balance rows={[{ label: 'Without LZP', kg: r.without.net }, { label: 'With LZP', kg: r.with.net }]} />
      </Card>

      {/* Full breakdown */}
      <Card className="col-span-12 p-6">
        <CardTitle sub="Caused and avoided are shown separately, then netted" right={<EstimatedChip label="Landfill ≈ 0 (estimated)" />}>Full breakdown</CardTitle>
        <EolTable r={r} />
      </Card>
    </div>
  );
}

function NetTile({ label, sub, kg, lime = false }: { label: string; sub: string; kg: number; lime?: boolean }) {
  const saves = kg < 0;
  return (
    <div className={`rounded-3xl p-5 ${lime ? 'bg-lime text-coal' : 'bg-white/[0.07] text-white'}`}>
      <div className="text-[13px] font-bold">{label}</div>
      <div className={`text-[11px] ${lime ? 'text-coal/60' : 'text-white/45'}`}>{sub}</div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <AnimatedNumber value={kg / 1000} format={(n) => signedT(n * 1000)} className="text-[36px] font-extrabold leading-none tracking-[-0.045em]" />
        <span className={`font-mono text-[11px] ${lime ? 'text-coal/60' : 'text-white/50'}`}>t CO2e / yr</span>
      </div>
      <div className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${saves ? (lime ? 'bg-coal text-lime' : 'bg-lime text-coal') : lime ? 'bg-coal/10' : 'bg-white/10 text-white/70'}`}>
        {saves ? 'Saves emissions' : kg > 0 ? 'Adds emissions' : 'Neutral'}
      </div>
    </div>
  );
}

function Proof({ i, icon, value, unit, title, text, info, estimated = false }: {
  i: number; icon: ReactNode; value: number; unit: string; title: string; text: string; info?: ReactNode; estimated?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.55, ease: EASE, delay: i * 0.08 }}
      className={`flex flex-col rounded-card p-6 shadow-card ${i === 0 ? 'bg-lime' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${i === 0 ? 'bg-coal text-lime' : 'bg-lime text-coal'}`}>{icon}</span>
        <span className="flex items-center gap-1.5">{estimated && <EstimatedChip />}{info}</span>
      </div>
      <div className="mt-5 flex items-baseline gap-1.5">
        <AnimatedNumber value={Math.max(0, value)} format={(n) => (unit === 'km' ? num0(n) : num1(n))} className="text-[40px] font-extrabold leading-none tracking-[-0.045em]" />
        <span className="font-mono text-[12px] text-muted">{unit}</span>
      </div>
      <div className="mt-1 text-[15px] font-bold tracking-[-0.01em]">{title}</div>
      <p className={`mt-2 text-[12px] leading-relaxed ${i === 0 ? 'text-coal/70' : 'text-muted'}`}>{text}</p>
    </motion.div>
  );
}

/** 100% stacked bars: recycled, incinerated and landfilled tonnes. */
function FateBars({ rows }: { rows: { label: string; e: { recycledT: number; incineratedT: number; landfilledT: number } }[] }) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);
  const parts = [
    { key: 'recycledT', label: 'Recycled', color: C.lime, text: 'text-coal' },
    { key: 'incineratedT', label: 'Incinerated', color: C.coal, text: 'text-white' },
    { key: 'landfilledT', label: 'Landfill', color: C.stone, text: 'text-coal' },
  ] as const;
  return (
    <div ref={ref} className="space-y-5">
      {rows.map(({ label, e }, row) => {
        const total = Math.max(1e-9, e.recycledT + e.incineratedT + e.landfilledT);
        return (
          <div key={label}>
            <div className="mb-2 text-[13px] font-semibold">{label}</div>
            <div className="flex h-12 overflow-hidden rounded-2xl bg-paper">
              {parts.map((p, k) => {
                const share = e[p.key] / total;
                if (share <= 0) return null;
                return (
                  <motion.div
                    key={p.key}
                    initial={{ width: 0 }} animate={{ width: seen ? `${share * 100}%` : 0 }}
                    transition={{ duration: 0.9, ease: EASE, delay: row * 0.25 + k * 0.12 }}
                    className={`flex items-center overflow-hidden whitespace-nowrap text-[12px] font-semibold ${p.text}`}
                    style={{ background: p.color }}
                    title={`${p.label}: ${num1(e[p.key])} t`}
                  >
                    {share > 0.14 && <span className="px-3">{p.label} {pct(share)}</span>}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
        {parts.map((p) => <span key={p.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>)}
      </div>
    </div>
  );
}

/** Diverging bars around zero: emitting to the right, saving to the left. */
function Balance({ rows }: { rows: { label: string; kg: number }[] }) {
  const [ref, seen] = useSeen<HTMLDivElement>(0.5);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.kg)));
  return (
    <div ref={ref}>
      <div className="mb-3 grid grid-cols-2 font-mono text-[10px] uppercase tracking-wider text-muted">
        <span>← Saves</span><span className="text-right">Adds →</span>
      </div>
      <div className="relative space-y-6 py-1">
        <span className="absolute inset-y-0 left-1/2 w-px bg-coal/30" />
        {rows.map(({ label, kg }, i) => {
          const w = (Math.abs(kg) / max) * 50;
          const saves = kg < 0;
          return (
            <div key={label}>
              <div className={`mb-1.5 flex text-[12px] font-semibold ${saves ? 'justify-start' : 'justify-end'}`}>
                <span>{label} <span className="font-mono font-normal">{signedT(kg)} t</span></span>
              </div>
              <div className="relative h-9">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: seen ? `${w}%` : 0 }}
                  transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.3 }}
                  className={`absolute top-0 h-full ${saves ? 'right-1/2 rounded-l-xl bg-lime ring-1 ring-inset ring-olive/30' : 'left-1/2 rounded-r-xl bg-coal'}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
