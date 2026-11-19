import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const customerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The repository keeps its canonical engine at the root. A standalone source
// bundle can still keep the same engine in customer-app/planner-engine.
export function resolvePlannerDirectory() {
  const candidates = process.env.DONEEO_PLANNER_DIR
    ? [resolve(process.env.DONEEO_PLANNER_DIR)]
    : [resolve(customerRoot, '..'), resolve(customerRoot, 'planner-engine')];
  const directory = candidates.find(candidate =>
    existsSync(resolve(candidate, 'app/api/plan/route.ts')) &&
    existsSync(resolve(candidate, 'drizzle')));
  if (!directory) throw new Error('Doneeo planner not found. Keep customer-app inside the repository or set DONEEO_PLANNER_DIR to its root.');
  return directory;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(resolvePlannerDirectory());
}
