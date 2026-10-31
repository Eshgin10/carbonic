import { create } from 'zustand';
import bundledAssumptions from '../../data/assumptions.json';
import bundledPartners from '../../data/partners.json';
import { enrichPartners, mergeFactors } from '../lib/enrich';
import type { ImportParse } from '../lib/importRoutes';
import { defaultOption, type PlanOption } from '../lib/planner';
import type { ElecMethod, Factor, Partner, RawPartner, Scenario } from '../lib/types';

export type Screen = 'planner' | 'compare' | 'record' | 'report';
/** How the Route planner was entered: the start choice, the manual flow, or a file import. */
export type Entry = 'choose' | 'manual' | 'import';
export type ImportedFile = ImportParse & { fileName: string };

/** A saved search, shown on the Record page and summed in reports. */
export interface SearchRecord {
  id: string;
  createdAt: string;
  customer: string;
  a: PlanOption;
  b: PlanOption | null;
  scenario: Scenario;
  elec: ElecMethod;
  /** Snapshot of option A at save time (kg CO2e), so the record keeps what the user saw. */
  snapshot: { label: string; caused: number; avoided: number; net: number; netPerT: number; stages: Record<string, number> };
}

export interface CustomerState {
  filmT: number;
  recycledShare: number;
  lzpShare: number;
}

export interface ReportOptions {
  audience: 'customer' | 'authority';
  period: 'week' | 'month';
  customer: string;
  appendix: boolean;
}

interface AppState {
  screen: Screen;
  entry: Entry;
  imported: ImportedFile | null;
  scenario: Scenario;
  elec: ElecMethod;
  methodOpen: boolean;
  factors: Factor[];
  partners: Partner[];
  /** Flow question 0-3; 4 = results. */
  step: number;
  editing: 'a' | 'b';
  customerName: string;
  a: PlanOption;
  b: PlanOption | null;
  customer: CustomerState;
  records: SearchRecord[];
  report: ReportOptions;
  toast: string | null;

  setScreen: (s: Screen) => void;
  setEntry: (e: Entry) => void;
  setImported: (f: ImportedFile | null) => void;
  saveRecords: (list: Omit<SearchRecord, 'id' | 'scenario' | 'elec' | 'b'>[]) => void;
  setScenario: (s: Scenario) => void;
  setElec: (e: ElecMethod) => void;
  setMethodOpen: (o: boolean) => void;
  setStep: (n: number) => void;
  setEditing: (e: 'a' | 'b') => void;
  setCustomerName: (n: string) => void;
  patchOption: (which: 'a' | 'b', patch: Partial<PlanOption>) => void;
  setOption: (which: 'a' | 'b', o: PlanOption | null) => void;
  newSearch: () => void;
  saveRecord: (snapshot: SearchRecord['snapshot']) => void;
  deleteRecord: (id: string) => void;
  openRecord: (id: string) => void;
  setCustomer: (patch: Partial<CustomerState>) => void;
  setReport: (patch: Partial<ReportOptions>) => void;
  showToast: (msg: string | null) => void;
}

const STORAGE_KEY = 'lzp-climate-impact:v2';

function loadSaved(): { records?: SearchRecord[]; scenario?: Scenario; elec?: ElecMethod } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const factors = mergeFactors(bundledAssumptions as Factor[]);
const partners = enrichPartners(bundledPartners as RawPartner[], factors);
const saved = loadSaved();
const uid = () => Math.random().toString(36).slice(2, 10);

export const useApp = create<AppState>((set, get) => ({
  screen: 'planner',
  entry: 'choose',
  imported: null,
  scenario: saved?.scenario ?? 'base',
  elec: saved?.elec ?? 'location',
  methodOpen: false,
  factors,
  partners,
  step: 0,
  editing: 'a',
  customerName: '',
  a: defaultOption(partners),
  b: null,
  customer: { filmT: 24, recycledShare: 0.41, lzpShare: 1 },
  records: saved?.records ?? [],
  report: { audience: 'authority', period: 'month', customer: '', appendix: true },
  toast: null,

  setScreen: (screen) => set({ screen }),
  setEntry: (entry) => set({ entry }),
  setImported: (imported) => set({ imported }),
  setScenario: (scenario) => set({ scenario }),
  setElec: (elec) => set({ elec }),
  setMethodOpen: (methodOpen) => set({ methodOpen }),
  setStep: (step) => set({ step }),
  setEditing: (editing) => set({ editing }),
  setCustomerName: (customerName) => set({ customerName }),
  patchOption: (which, patch) => {
    const cur = get()[which];
    if (cur) set({ [which]: { ...cur, ...patch } } as Partial<AppState>);
  },
  setOption: (which, o) => set({ [which]: o, ...(which === 'b' && !o ? { editing: 'a' as const } : {}) } as Partial<AppState>),
  newSearch: () => set({ a: defaultOption(get().partners), b: null, step: 0, editing: 'a', customerName: '', entry: 'choose' }),
  saveRecords: (list) => {
    const s = get();
    const recs: SearchRecord[] = list.map((r) => ({ ...r, id: uid(), b: null, scenario: s.scenario, elec: s.elec }));
    set({ records: [...recs, ...s.records], toast: `${recs.length} shipments saved to Record` });
  },

  saveRecord: (snapshot) => {
    const s = get();
    const rec: SearchRecord = {
      id: uid(), createdAt: new Date().toISOString(), customer: s.customerName.trim(),
      a: s.a, b: s.b, scenario: s.scenario, elec: s.elec, snapshot,
    };
    set({ records: [rec, ...s.records], toast: 'Search saved to Record' });
  },
  deleteRecord: (id) => set({ records: get().records.filter((r) => r.id !== id) }),
  openRecord: (id) => {
    const r = get().records.find((x) => x.id === id);
    if (!r) return;
    set({ a: r.a, b: r.b, customerName: r.customer, step: 4, entry: 'manual', editing: 'a', screen: 'planner', scenario: r.scenario, elec: r.elec });
  },
  setCustomer: (patch) => set({ customer: { ...get().customer, ...patch } }),
  setReport: (patch) => set({ report: { ...get().report, ...patch } }),
  showToast: (toast) => set({ toast }),
}));

// Records persist per browser. Storage may be unavailable (private mode); the app still works.
useApp.subscribe((s) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ records: s.records, scenario: s.scenario, elec: s.elec }));
  } catch {
    /* ignore */
  }
});
