/** Shared text for the Method drawer and the report, so both always say the same thing. */

export const FORMULAS: { label: string; formula: string; factors: string[] }[] = [
  { label: 'Collection', formula: 't_input × collection factor', factors: ['P4'] },
  { label: 'Sorting', formula: 't_input × sorting kWh/t × grid(LV)', factors: ['P2', 'G1', 'G7'] },
  { label: 'Transport', formula: 't_input × km × mode factor (truck / rail / ferry) × (1 + empty-return share, if on)', factors: ['T1', 'T3', 'T4', 'T6'] },
  { label: 'Pellets out', formula: 't_input × yield (partner override, else default)', factors: ['P3', 'P3-NP'] },
  { label: 'Recycling', formula: 'pellets × kWh per t pellets × grid(partner country)', factors: ['P1', 'P1-NP', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
  { label: 'CAUSED', formula: 'Collection + Sorting + Transport + Recycling', factors: [] },
  { label: 'AVOIDED', formula: 'pellets × substitution ratio × virgin LDPE factor', factors: ['V3', 'V1'] },
  { label: 'NET', formula: 'CAUSED − AVOIDED (both always reported separately)', factors: [] },
];

export const CUSTOMER_FORMULAS = [
  'Without LZP: recycled share × route intensity + non-recycled × (52.8% × incineration 3 kg CO2e/kg + 47.2% × landfill ≈ 0)',
  'With LZP: LZP share × intensity of the planned route (Option A; caused and avoided per tonne) + remainder disposed as above',
  'Reduction = NET without − NET with',
];

export const SYSTEM_BOUNDARY =
  'Gate-to-gate for LZP-managed packaging waste: from collection of post-consumer LDPE film in Latvia, through sorting and baling, transport to the recycling partner, and mechanical recycling to pellets. Avoided emissions are credited for virgin LDPE displaced by the recycled pellets (system expansion), reported separately from caused emissions. Downstream use of the pellets and the customers\' own packaging production are outside the boundary.';

export const STANDARDS =
  'Structured according to the principles of ISO 14040/44 (goal and scope, inventory, impact assessment, interpretation) and reported in the spirit of the GHG Protocol Scope 3 Standard (Category 5, waste generated in operations, and Category 12, end-of-life treatment of sold products), with avoided emissions disclosed separately and never netted silently.';

export const LIMITATIONS: { title: string; text: string }[] = [
  { title: 'Collection', text: 'Collection distances and fuel use are not available. Estimated at 15 kg CO2e/t (range 5–40).' },
  { title: 'Sorting energy', text: 'No measured sorting/baling energy. Estimated at 50 kWh/t (range 20–100).' },
  { title: 'Rail and sea factors', text: 'No sourced rail or ferry factors. Rounded placeholders are used (rail 0.03, ferry 0.05 kg CO2e/t-km) and marked "Estimated, verify".' },
  { title: 'Empty return', text: 'When "Return trip empty" is on, transport is increased by 60% (range 40–80%) of the loaded leg. This is a rounded placeholder ("Estimated, verify"); average road factors already include typical empty running.' },
  { title: 'Partner yields and energy', text: 'Real yields and electricity use are only known for Nordic Plast (Bureau Veritas LCA). All other partners use the literature default (yield 0.75, range 0.66–0.85; 900 kWh/t pellets, range 760–1,490).' },
  { title: 'Ukrainian partners', text: 'Locations of Metal Samara, Prestige Polymer and Folenskay are not verified. They are placed at the country centroid at an estimated 1,300 km.' },
  { title: 'Other locations and distances', text: 'Only five partner locations are confirmed. Other partners sit at their country centroid; distances are rough road estimates from Riga, not routed.' },
  { title: 'Landfill', text: 'Landfill emissions for plastic are assumed to be about 0 (inert). No energy-recovery credit is given for incineration.' },
  { title: 'Grid factors', text: 'Location-based grid factors come from Ember-derived secondary sources with different years (2023–2025). A residual-mix option is only available for Latvia.' },
  { title: 'Substitution', text: 'The substitution ratio (Base 0.8, range 0.5–1.0) is the most influential assumption for avoided emissions. 0.7 is reported as a break-even value in the literature.' },
  { title: 'Model scope', text: 'Water, additives, packaging of pellets, infrastructure and distribution are not modelled. The Nordic Plast LCA (~1.0 kg CO2e/kg incl. distribution) is therefore expected to be higher than the model.' },
];

export const DISCLAIMER =
  'This is a calculated estimate based on secondary data and stated assumptions. It is not a certified life cycle assessment (LCA) and has not been third-party verified.';
