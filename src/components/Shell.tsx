import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, FileDown, History, Route, Scale } from 'lucide-react';
import { useEffect } from 'react';
import { EASE } from '../lib/theme';
import { useApp, type Screen } from '../store/useApp';
import { Logo } from './Logo';

export const NAV: { id: Screen; label: string; title: string; icon: typeof Route }[] = [
  { id: 'planner', label: 'Planner', title: 'Route planner', icon: Route },
  { id: 'compare', label: 'With LZP', title: 'With LZP vs without', icon: Scale },
  { id: 'record', label: 'Record', title: 'Record', icon: History },
  { id: 'report', label: 'Report', title: 'Report', icon: FileDown },
];

export function Sidebar() {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const setMethodOpen = useApp((s) => s.setMethodOpen);
  const records = useApp((s) => s.records.length);
  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center bg-coal py-5 text-white md:flex">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime">
        <Logo size={34} />
      </div>
      <nav className="mt-10 flex flex-col items-center gap-2">
        {NAV.map(({ id, label, title, icon: Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              onClick={() => setScreen(id)}
              title={title}
              className={`group relative flex w-[60px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold transition-colors duration-150 ${active ? 'text-coal' : 'text-white/50 hover:text-white'}`}
            >
              {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-2xl bg-lime" transition={{ duration: 0.35, ease: EASE }} />}
              <Icon size={19} strokeWidth={1.8} className="relative" />
              <span className="relative">{label}</span>
              {id === 'record' && records > 0 && !active && (
                <span className="absolute right-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lime" />
              )}
            </button>
          );
        })}
      </nav>
      <button
        onClick={() => setMethodOpen(true)}
        title="Method & sources"
        className="mt-auto flex w-[60px] flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold text-white/50 transition-colors hover:text-white"
      >
        <BookOpen size={18} strokeWidth={1.8} />
        Method
      </button>
    </aside>
  );
}

/** Page titles; the planner has none so its flow starts at the top of the screen. */
const TITLES: Record<Screen, { title: string; sub: string } | null> = {
  planner: null,
  compare: { title: 'With LZP vs without', sub: 'A customer’s packaging emissions with LZP recycling compared with today' },
  record: { title: 'Record', sub: 'Every search you saved, newest first' },
  report: { title: 'Report', sub: 'Weekly or monthly reports for authorities and customers' },
};

export function TopBar() {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const setMethodOpen = useApp((s) => s.setMethodOpen);
  const t = TITLES[screen];
  return (
    <header className={`sticky top-0 z-[1000] bg-paper/85 backdrop-blur-md ${t ? '' : 'md:hidden'}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 lg:px-8">
        <div className="flex items-center gap-3 md:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime"><Logo size={26} /></span>
          <select className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold" value={screen} onChange={(e) => setScreen(e.target.value as Screen)} aria-label="Section">
            {NAV.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>
        <div className="mr-auto min-w-0">
          {t && (
            <>
              <h1 className="text-[26px] font-bold leading-none tracking-[-0.035em] text-coal">{t.title}</h1>
              <p className="mt-1.5 truncate text-[13px] text-muted">{t.sub}</p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMethodOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-coal transition-colors hover:bg-lime md:hidden" aria-label="Method & sources">
            <BookOpen size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Toast() {
  const toast = useApp((s) => s.toast);
  const show = useApp((s) => s.showToast);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => show(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast, show]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.3, ease: EASE }}
          className="fixed bottom-6 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-coal px-5 py-2.5 text-[13px] font-semibold text-white shadow-card"
        >
          <span className="h-2 w-2 rounded-full bg-lime" />
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
