/**
 * Converts the LZP workbook into the JSON files the app bundles.
 *   npm run data                     -> reads data/source/LZP_partners.xlsx
 *   npm run data -- path/to/file.xlsx
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { parseWorkbook, validateWorkbook } from '../src/lib/parseWorkbook';

const input = resolve(process.argv[2] ?? 'data/source/LZP_partners.xlsx');
const wb = XLSX.read(readFileSync(input), { type: 'buffer' });
const parsed = parseWorkbook(wb);

if (!parsed.partners.length) throw new Error(`No partners parsed from ${input}`);

const write = (name: string, data: unknown) => {
  writeFileSync(resolve('data', name), JSON.stringify(data, null, 2) + '\n');
  console.log(`  data/${name}`);
};

console.log(`Reading ${input}`);
write('partners.json', parsed.partners);
write('assumptions.json', parsed.assumptions);
write('byCountry.json', parsed.byCountry);
write('rawData.json', parsed.rawData);

const total = parsed.partners.reduce((a, p) => a + p.totalT, 0);
const film = parsed.partners.reduce((a, p) => a + p.filmT, 0);
console.log(`${parsed.partners.length} partners, ${total.toFixed(1)} t total, ${film.toFixed(1)} t film, ${parsed.assumptions.length} assumptions`);

const issues = validateWorkbook(parsed);
if (issues.length) {
  console.warn('Validation warnings:');
  for (const i of issues) console.warn(`  - ${i}`);
} else {
  console.log('Validation: Partners, By country and Raw data agree.');
}
