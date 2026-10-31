# Carbonic

Carbonic is an internal tool for Latvijas Zaļais punkts (LZP) specialists. It shows customers and authorities, with sources for every number, how packaging emissions change when LDPE film is recycled through LZP partners.

The app opens on a finished result built from the bundled 2025 workbook. Every input is an optional what-if.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for src/lib/calc.ts
npm run build      # static site in dist/ (no backend)
```

## Sections

| Section | What it does |
|---|---|
| **Route planner** | A focused flow, one question per screen, with no step timeline and no preview: material and tonnes (LDPE film by default), then destination (a partner or a city), then transport (truck, rail or ferry, with an optional empty return trip), then calculation settings (uncertainty case and electricity method). When the flow is finished it leaves the screen and the result appears: caused, avoided and net CO2e, net per tonne, the stage breakdown, the route on the map and the most efficient options. Every choice, including the settings, can be changed afterwards in the panel on the left. **Compare** adds an option B. The **With LZP vs without** tab shows the customer reduction for the planned route. |
| **Record** | Every finished search (saved automatically, or with *Save to record*), filterable by past week or month. Open a record to reload it into the planner. Records are stored in the browser. |
| **Report** | A Government or Customer report for the past week or month, built from the saved searches. It is a live A4 preview with Download PDF and Export Excel. |

**Method** in the sidebar opens the formulas, the validation line, every factor and the limitations. Reports recalculate each saved search with the case and electricity method chosen in its own flow.

## Project layout

```
data/
  source/LZP_partners.xlsx   the workbook (input; not in the repository, ask LZP for it)
  partners.json              generated: Partners sheet
  assumptions.json           generated: Assumptions sheet
  byCountry.json, rawData.json   generated: used for validation
  extraFactors.json          curated: LCA report, literature and Climatiq factors, material list
  locations.json             curated: known partner coordinates, country centroids, default distances
  cities.json                curated: destination cities (distance = great-circle x road factor D7)
scripts/build-data.ts        workbook -> JSON
src/lib/calc.ts              ALL emission math (pure functions)
src/lib/calc.test.ts         unit tests
src/lib/parseWorkbook.ts     workbook parser used by the build script
src/lib/enrich.ts            merges factors, adds coordinates, distances and Nordic Plast overrides
src/lib/method.ts            formula, boundary and limitation text shared by the drawer and the report
src/lib/planner.ts           maps a planner option (partner or country, mode) to calc inputs; ranks options
src/store/                   app state (zustand): planner options, records, report settings
src/components/, src/screens/
```

## Updating the workbook

1. Save the new workbook as `data/source/LZP_partners.xlsx`. Keep the sheet names `Partners`, `Assumptions`, `By country` and `Raw data`.
2. Run `npm run data`, or `npm run data -- path/to/other.xlsx`.
3. The script prints totals and a validation check: Partners vs Raw data per recycler, and Partners vs By country in total. Fix any warnings it prints.
4. Run `npm test`, then `npm run build`.

### Workbook format

The parser finds the header row by its labels, so title rows above it and extra columns are fine.

- **Partners**: `Partner`, `Country` (Latvian or English name), `Total, t`, `Film, t`, and optionally `Share…`, `Location`, `What they do`, `Stated capacity…`, `Approx. road distance…`, `Research status`, `Sources`. A row named `TOTAL` is skipped.
- **Assumptions**: `ID`, `Parameter`, `Base value`, `Low`, `High`, `Unit`, `Source`, `Year`, `Confidence` (High/Medium/Low), `Status`, `Notes`. A row with text only in `ID` starts a new group. A `Status` containing "Assumption" or "Estimate" marks the factor as Estimated.

### Curated overrides

`data/extraFactors.json` is applied on top of the workbook. A row with the same `id` replaces the workbook row, and the old value is noted. That is how these values are set:

- **T1 low**: GLEC 0.058
- **P1**: Zeilerbauer cross-check note
- **P3 yield**: 0.75, range 0.66–0.85
- **V1 virgin LDPE**: 1.87, high 2.13
- **V3 substitution**: 0.8, range 0.5–1.0

Nordic Plast's primary data (`P1-NP` = 1,088 kWh/t, `P3-NP` = 0.66) is applied by name in `src/lib/enrich.ts`. To change one of these values, edit the JSON. To let the workbook win again, delete the matching row.

**Adding a material** (Cardboard, Glass): add sourced factor rows to `extraFactors.json` (see the `M4`/`M5` placeholders) and set the material's `status` to `active` in `materials`. The calculation currently models LDPE film only. A new material also needs its own yield, energy and virgin factors in `calc.ts`.

## Calculation (src/lib/calc.ts)

Per partner, then summed; tonnes = LDPE film tonnes.

```
Collection = t × collection factor (P4)
Sorting    = t × sorting kWh/t (P2) × grid(LV)
Transport  = t × km × mode factor (T1 truck, T4 rail, T3 ferry sea leg) × (1 + T6 if the return trip is empty)
Pellets    = t × yield (partner override, else P3)
Recycling  = pellets × kWh per t pellets (P1 / P1-NP) × grid(partner country)
CAUSED     = Collection + Sorting + Transport + Recycling
AVOIDED    = pellets × substitution (V3) × virgin LDPE (V1)
NET        = CAUSED − AVOIDED
```

- **Low / High**: every ranged factor is set to the bound that lowers or raises NET. Each factor has a `direction` field for this.
- **Customer comparison**: the non-recycled share goes to incineration (52.8% at 3 kg CO2e/kg) and landfill (47.2%, ≈ 0). The recycled share uses the portfolio's caused and avoided intensity per tonne.
- **Validation**: the Nordic Plast result per kg of pellets is compared with the Bureau Veritas LCA (~1.0 kg CO2e/kg) and Zeilerbauer 2024 (0.44–0.51).

## Map

The map uses Leaflet with CARTO light tiles, tinted green. On start the app fetches two different tiles and compares their bytes. If they are identical, CARTO is serving a placeholder, as it now does without an API key ("API KEY REQUIRED"). In that case, or if the tiles fail to load, the app draws a d3-geo outline map from Natural Earth (`world-atlas`). Routes, moving dots and tooltips work the same on both maps. To use real tiles, add a CARTO key to `TILE_URL` in `src/components/map/RouteMap.tsx`, or point it at another tile provider.

## Factors that are estimated or need verification

| ID | Factor | Status |
|---|---|---|
| P4 | Collection, 15 kg CO2e/t (5–40) | Estimated: no collection distances or fuel data |
| P2 | Sorting, 50 kWh/t (20–100) | Estimated: no measured sorting energy |
| T3 | Ro-ro ferry, 0.05 kg CO2e/t-km (0.02–0.10) | **Estimated, verify**: no sourced sea factor |
| T4 | Rail, 0.03 kg CO2e/t-km (0.015–0.05) | **Estimated, verify**: no sourced rail factor |
| T6 | Empty return, +60% of the loaded leg (40–80%) | **Estimated, verify** |
| E5 | Landfill of plastic ≈ 0 | **Estimated, verify** |
| V3 | Substitution ratio 0.8 (0.5–1.0) | Assumption (literature range) |
| D1–D6 | Distances from Riga | Estimates; Ukraine locations unknown |
| D7 | Road circuity 1.25 for city destinations | **Estimated, verify** |
| M4, M5 | Cardboard, glass | Placeholders without values: "Estimated, verify" |

Fetched and stored with source URLs (2026-10-31):

- **GLEC** articulated truck <40 t: 0.058 kg CO2e/t-km. TTW, Europe; Climatiq marks it deprecated.
- **Recycled PP flakes, EU**: 1.27 kg CO2e/kg, cradle-to-gate.
- **Recycled HIPS flakes, NL**: 1.02, gate-to-gate.
- **Recycled PP pellets, NL**: 0.466, gate-to-gate.
- **Zeilerbauer et al. 2024**: values checked against the paper (0.44, 1 kWh/kg, 15% reject, 1.87, 3 kg/kg, 70% break-even). 0.48 and 0.51 come from the paper's results figure and could not be read from the text.

All results are calculated estimates, not a certified LCA.
