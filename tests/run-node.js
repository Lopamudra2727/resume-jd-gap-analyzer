#!/usr/bin/env node
/* Run with:  node tests/run-node.js   (or npm test) */
'use strict';
const GA = require('../js/analyzer.js');
const samples = require('../js/samples.js');
const { register } = require('./tests.js');
const bench = require('./benchmark.js');

const results = [];
register((name, fn) => {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e.message }); }
}, GA, samples);

for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} tests passed`);

const t = bench.timing(GA, samples);
const pct = (x) => (x * 100).toFixed(1) + '%';
for (const [title, cases] of [['Development set', bench.CASES], ['Held-out set', bench.HOLDOUT]]) {
  const b = bench.run(GA, cases);
  console.log(`\n${title} (${b.cases} sentences, ${b.labels} labels): ` +
    `precision ${pct(b.precision)}, recall ${pct(b.recall)}, F1 ${pct(b.f1)}`);
  for (const e of b.errors) console.log(`  - "${e.text}"  extra=${JSON.stringify(e.extra)} missed=${JSON.stringify(e.missed)}`);
}
console.log(`Average analysis time: ${t.avgMs.toFixed(2)} ms over ${t.runs} runs`);
console.log('Taxonomy:', GA.stats());

process.exit(failed ? 1 : 0);
