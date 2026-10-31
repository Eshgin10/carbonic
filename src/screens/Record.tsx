import { motion } from 'framer-motion';
import { ArrowUpRight, History, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedNumber, Button, Card, Segmented } from '../components/ui';
import { COUNTRY_NAMES } from '../lib/enrich';
import { num0, num1 } from '../lib/format';
import { MODE_NAME } from '../lib/planner';
import { EASE } from '../lib/theme';
import { useApp, type SearchRecord } from '../store/useApp';

export type Period = 'all' | 'week' | 'month';
const DAY = 86_400_000;

export function inPeriod(r: SearchRecord, period: Period, now = Date.now()) {
  if (period === 'all') return true;
  return now - new Date(r.createdAt).getTime() <= (period === 'week' ? 7 : 30) * DAY;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Record() {
  const records = useApp((s) => s.records);
  const openRecord = useApp((s) => s.openRecord);
  const deleteRecord = useApp((s) => s.deleteRecord);
  const setScreen = useApp((s) => s.setScreen);
  const [period, setPeriod] = useState<Period>('all');
  const [q, setQ] = useState('');

  const list = useMemo(
    () => records.filter((r) => inPeriod(r, period) && `${r.customer} ${r.snapshot.label}`.toLowerCase().includes(q.toLowerCase())),
    [records, period, q],
  );
  const tonnes = list.reduce((a, r) => a + r.a.tonnes, 0);
  const net = list.reduce((a, r) => a + r.snapshot.net, 0);

  if (!records.length) {
    return (
      <Card pins className="mx-auto flex max-w-xl flex-col items-center px-8 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lime"><History size={24} /></span>
        <h2 className="mt-6 text-[26px] font-bold tracking-[-0.03em]">No searches yet</h2>
        <p className="mt-2 max-w-sm text-[14px] text-muted">Every route you finish in the planner is saved here, so you can reopen it or include it in a report.</p>
        <Button variant="lime" className="mt-7" onClick={() => setScreen('planner')}>Plan a route <ArrowUpRight size={14} /></Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-3">
        <Stat label="Searches" value={list.length} format={num0} />
        <Stat label="Tonnes planned" value={tonnes} format={num0} unit="t" />
        <Stat label="Net emissions" value={net / 1000} format={(n) => `${n < 0 ? '−' : ''}${num1(Math.abs(n))}`} unit="t CO2e" dark />
      </div>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: 'all', label: 'All' }, { value: 'week', label: 'Past week' }, { value: 'month', label: 'Past month' }]} />
          <div className="ml-auto flex w-full items-center gap-2 rounded-full bg-paper px-3.5 py-1.5 sm:w-64">
            <Search size={13} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer or destination" className="w-full bg-transparent text-[13px] outline-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Customer</th>
                <th className="pb-3 font-normal">Route</th>
                <th className="pb-3 text-right font-normal">Tonnes</th>
                <th className="pb-3 text-right font-normal">Net t CO2e</th>
                <th className="pb-3 text-right font-normal">kg CO2e/t</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 12) * 0.03 }}
                  className="group border-t border-line"
                >
                  <td className="py-3 font-mono text-[12px] text-muted">{fmtDate(r.createdAt)}</td>
                  <td className="py-3 font-semibold">{r.customer || <span className="font-normal text-muted">—</span>}</td>
                  <td className="py-3">
                    <div className="font-semibold">{r.snapshot.label}</div>
                    <div className="text-[11px] text-muted">
                      {r.a.material} · {MODE_NAME[r.a.mode]} · {num0(r.a.km)} km · {COUNTRY_NAMES[r.a.country]}{r.a.emptyReturn ? ' · empty return' : ''} · {r.scenario} case{r.elec === 'residual' ? ' · LV residual' : ''}
                      {r.b && <span className="ml-1.5 rounded-full bg-lime px-1.5 py-px text-[10px] font-semibold text-coal">+ option B</span>}
                    </div>
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums">{num1(r.a.tonnes)}</td>
                  <td className="py-3 text-right font-mono font-semibold tabular-nums">{r.snapshot.net < 0 ? '−' : ''}{num1(Math.abs(r.snapshot.net) / 1000)}</td>
                  <td className="py-3 text-right font-mono tabular-nums">{r.snapshot.netPerT < 0 ? '−' : ''}{num0(Math.abs(r.snapshot.netPerT))}</td>
                  <td className="py-3 pl-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openRecord(r.id)} className="rounded-full bg-coal px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-olive">Open</button>
                      <button onClick={() => { if (confirm('Delete this search from the record?')) deleteRecord(r.id); }} className="rounded-full p-1.5 text-muted transition-colors hover:bg-paper hover:text-coal" aria-label="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="py-10 text-center text-[13px] text-muted">No searches match this filter.</p>}
        </div>
        <p className="mt-4 text-[11px] text-muted">Values are as calculated when saved. Records are stored in this browser.</p>
      </Card>
    </div>
  );
}

function Stat({ label, value, format, unit, dark = false }: { label: string; value: number; format: (n: number) => string; unit?: string; dark?: boolean }) {
  return (
    <Card dark={dark} className="p-6">
      <div className={`font-mono text-[11px] uppercase tracking-[0.14em] ${dark ? 'text-white/50' : 'text-muted'}`}>{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <AnimatedNumber value={value} format={format} className={`text-[40px] font-bold leading-none tracking-[-0.045em] ${dark ? 'text-lime' : ''}`} />
        {unit && <span className={`font-mono text-[12px] ${dark ? 'text-white/50' : 'text-muted'}`}>{unit}</span>}
      </div>
    </Card>
  );
}
