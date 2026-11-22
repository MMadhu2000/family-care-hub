import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const FRONTEND = process.cwd();
const SRC = path.join(FRONTEND, 'src');
const HERE = path.join(FRONTEND, '.codebenders', 'scratch', 'prescriptions-patch');
const MOCKS = {
  '@/lib/supabase/server': path.join(HERE, 'mock-supabase.mjs'),
  '@/lib/server/auth': path.join(HERE, 'mock-auth.mjs'),
};
export async function resolve(specifier, context, next) {
  if (MOCKS[specifier]) return { url: pathToFileURL(MOCKS[specifier]).href, shortCircuit: true };
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2));
    for (const c of [base + '.ts', path.join(base, 'index.ts')]) {
      if (existsSync(c) && statSync(c).isFile()) return { url: pathToFileURL(c).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}
