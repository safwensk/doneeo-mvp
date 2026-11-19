import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { resolvePlannerDirectory } from './Resolve-Planner.mjs';

const plannerDirectory = resolvePlannerDirectory();
const require = createRequire(resolve(plannerDirectory, 'package.json'));
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = resolve(plannerDirectory, 'app/globals.css');
const source = await readFile(original, 'utf8');
const result = await postcss([tailwind({ base: resolve(root, 'frontend/src/github'), optimize: true })])
  .process(source, { from: original, to: resolve(root, 'frontend/public/workspace.css') });
// Global page tokens and the reset belong to the workspace's shadow host.
result.root.walkRules(rule => {
  rule.selector = rule.selector.replace(/:root\b|\bhtml\b|\bbody\b/g, ':host');
});
// @property registrations inside a shadow stylesheet do not supply the
// document-level initial values that Tailwind's utilities expect. Keep those
// generated defaults in the lowest layer so utility classes still override them.
const defaults = postcss.rule({ selector: ':host, *, ::before, ::after' });
result.root.walkAtRules('property', registration => {
  if (!registration.params.startsWith('--tw-')) return;
  const initial = registration.nodes?.find(node => node.type === 'decl' && node.prop === 'initial-value');
  if (initial) defaults.append(postcss.decl({ prop: registration.params, value: initial.value }));
});
if (defaults.nodes.length) {
  result.root.append(postcss.atRule({ name: 'layer', params: 'properties' }).append(defaults));
}
await writeFile(resolve(root, 'frontend/public/workspace.css'), result.root.toString());
console.log('Built the original GitHub workspace stylesheet.');
