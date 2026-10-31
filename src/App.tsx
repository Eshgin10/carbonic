import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { MethodDrawer } from './components/MethodDrawer';
import { Sidebar, Toast, TopBar } from './components/Shell';
import { EASE } from './lib/theme';
import { CustomerView, Planner } from './screens/Planner';
import { Record } from './screens/Record';
import { Report } from './screens/Report';
import { useApp } from './store/useApp';

const SCREENS = { planner: Planner, compare: CustomerView, record: Record, report: Report };

export default function App() {
  const screen = useApp((s) => s.screen);
  const Screen = SCREENS[screen];
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);
  return (
    <div className="flex min-h-screen bg-paper font-sans text-coal">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="mx-auto max-w-[1480px] px-4 pb-10 pt-2 sm:px-5 lg:px-8">
          <motion.div key={screen} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <Screen />
          </motion.div>
        </main>
      </div>
      <MethodDrawer />
      <Toast />
    </div>
  );
}
