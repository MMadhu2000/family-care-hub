const FAMILY = "00000000-0000-4000-8000-000000000001";
const seen = [];
function rows(prefix, n, extra) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-${i + 1}`, family_id: FAMILY, title: `${prefix} ${i + 1}`,
    status: "PENDING", priority: "LOW", assigned_to: null, due_at: null, ...extra,
  }));
}
globalThis.fetch = async (input) => {
  const url = String(input);
  seen.push(url);
  const json = (data) => new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (url.startsWith("/api/family-members")) return json({ members: [] });
  if (url.startsWith("/api/tasks")) {
    if (url.includes("page=2")) return json({ items: rows("t2", 50), page: 2, pageSize: 100, total: 150, totalPages: 2 });
    return json({ items: rows("t1", 100), page: 1, pageSize: 100, total: 150, totalPages: 2 });
  }
  return json({ items: [] });
};
const { fetchTasks, fetchDashboardData } = await import("../../frontend/src/lib/dashboard/queries.ts");
const tasks = await fetchTasks(FAMILY);
console.log("fetchTasks count:", tasks.length);
const dash = await fetchDashboardData(FAMILY);
console.log("fetchDashboardData pendingTasks:", dash.summary.pendingTasks, "tasks.length:", dash.tasks.length);
console.log("requested URLs:");
for (const u of seen) console.log("  " + u);
