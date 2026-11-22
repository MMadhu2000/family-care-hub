// Stub of the Supabase client. The DB CHECK is emulated from
// supabase/migrations/20261121190000_initial_schema.sql line 246:
// check (end_date is null or start_date is null or end_date >= start_date)
export const state = {
  updates: [],
  prescription: {
    id: '11111111-1111-4111-8111-111111111111',
    family_id: '22222222-2222-4222-8222-222222222222',
    care_recipient_id: '33333333-3333-4333-8333-333333333333',
    start_date: '2025-06-10',
    end_date: '2025-06-20',
  },
};
function builder(table) {
  let op = 'select';
  let payload;
  const run = () => {
    if (table === 'family_members') return { data: { role: 'ADMIN' }, error: null };
    if (table === 'prescriptions' && op === 'select') return { data: state.prescription, error: null };
    if (table === 'prescriptions' && op === 'update') {
      state.updates.push(payload);
      const merged = { ...state.prescription, ...payload };
      if (merged.end_date && merged.start_date && merged.end_date < merged.start_date) {
        return { data: null, error: { code: '23514', message: 'new row for relation "prescriptions" violates check constraint "prescriptions_check"' } };
      }
      state.prescription = merged;
      return { data: merged, error: null };
    }
    return { data: null, error: { message: 'unsupported in stub' } };
  };
  const b = {
    select() { return b; },
    eq() { return b; },
    update(p) { op = 'update'; payload = p; return b; },
    async maybeSingle() { return run(); },
  };
  return b;
}
export async function createClient() {
  return { from: (t) => builder(t) };
}
