import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
register('./hooks.mjs', import.meta.url);
const route = await import(pathToFileURL(path.resolve('src/app/api/prescriptions/[id]/route.ts')).href);
const stub = await import('./mock-supabase.mjs');
const ID = '11111111-1111-4111-8111-111111111111';
const cases = [
  ['A reported: stored 2025-06-10..2025-06-20, PATCH {"end_date":"2025-06-01"}', { end_date: '2025-06-01' }],
  ['B control: PATCH {"start_date":"2025-06-25"} (end stored 2025-06-20)', { start_date: '2025-06-25' }],
  ['C control: PATCH both dates inverted', { start_date: '2025-06-10', end_date: '2025-06-01' }],
];
for (const [label, body] of cases) {
  stub.state.prescription = { ...stub.state.prescription, start_date: '2025-06-10', end_date: '2025-06-20' };
  stub.state.updates.length = 0;
  const req = new Request(`http://localhost/api/prescriptions/${ID}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const res = await route.PATCH(req, { params: Promise.resolve({ id: ID }) });
  console.log(label);
  console.log('  status:', res.status);
  console.log('  body:  ', await res.text());
  console.log('  db update calls:', JSON.stringify(stub.state.updates));
}
