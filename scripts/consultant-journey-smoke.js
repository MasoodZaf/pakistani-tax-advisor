// End-to-end smoke test of the tax-consultant journey on STAGING.
//
// Runs against the live HTTP API exactly as the browser would, so it exercises
// auth, role gates, consultant-client isolation, bulk import and impersonation
// rather than calling controllers directly.
const ExcelJS = require('exceljs');

const BASE = process.env.BASE || 'http://localhost:3001';
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};

const call = async (path, { method = 'GET', token, body, raw } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, {
    method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? await r.json().catch(() => null) : await r.buffer?.().catch(() => null);
  return { status: r.status, data, res: r };
};

(async () => {
  console.log('\n=== 1. AUTHENTICATION ===');
  const login = await call('/api/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  ok('consultant can log in', login.status === 200, `got ${login.status}`);
  const token = login.data?.token || login.data?.data?.token;
  ok('login returns a JWT', !!token);
  if (!token) { console.log('\nABORT: no token'); process.exit(1); }

  const role = login.data?.user?.role || login.data?.data?.user?.role;
  ok('role is tax_consultant', role === 'tax_consultant', `got ${role}`);

  console.log('\n=== 2. ROLE GATES ===');
  const tmpl = await call('/api/admin/users/bulk-template', { token });
  ok('can download bulk template (elevated)', tmpl.status === 200, `got ${tmpl.status}`);

  const superOnly = await call('/api/admin/system-settings', { token });
  ok('super-admin-only surface is not wide open', [401, 403, 404].includes(superOnly.status), `got ${superOnly.status}`);

  console.log('\n=== 3. BULK CLIENT IMPORT ===');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Users');
  ws.addRow(['Name', 'Email', 'Phone', 'CNIC', 'User Type']);
  const stamp = Date.now();
  ws.addRow([`QA Client One ${stamp}`, `qa.client1.${stamp}@meratax.test`, '03001234567', '1'+String(stamp).slice(-10)+'11', 'individual']);
  ws.addRow([`QA Client Two ${stamp}`, `qa.client2.${stamp}@meratax.test`, '03001234568', '1'+String(stamp).slice(-10)+'22', 'individual']);
  ws.addRow(['', '', '', '', '']);                                   // blank row -> skipped silently
  ws.addRow([`QA Bad Email ${stamp}`, 'not-an-email', '', '', '']);  // invalid -> error row
  ws.addRow([`QA Client One ${stamp}`, `qa.client1.${stamp}@meratax.test`, '', '', '']); // dup -> skipped
  const buf = await wb.xlsx.writeBuffer();

  const fd = new FormData();
  fd.append('file', new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), 'clients.xlsx');
  const imp = await fetch(BASE + '/api/admin/users/bulk-import', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const impData = await imp.json().catch(() => null);
  ok('bulk import accepted', imp.status === 200, `got ${imp.status} ${JSON.stringify(impData)?.slice(0,120)}`);
  const s = impData?.summary || {};
  ok('2 clients created', s.created === 2, `created=${s.created}`);
  ok('duplicate row skipped', s.skipped >= 1, `skipped=${s.skipped}`);
  ok('invalid email rejected', s.failed >= 1, `failed=${s.failed}`);
  ok('temp passwords returned for distribution',
    (impData?.results || []).some((r) => r.status === 'created' && r.tempPassword));
  // Re-import the SAME sheet: every row must now be skipped with a reason,
  // and the CNIC clash must name the CNIC rather than say "Could not create user".
  const fd1b = new FormData();
  fd1b.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'clients.xlsx');
  const re = await fetch(BASE + '/api/admin/users/bulk-import', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd1b });
  const reData = await re.json().catch(() => null);
  ok('re-import creates nothing', (reData?.summary?.created || 0) === 0, JSON.stringify(reData?.summary));
  ok('re-import explains every rejection (no generic error)',
    (reData?.results || []).filter((r) => r.status !== 'created')
      .every((r) => r.message && !/could not create user/i.test(r.message)),
    JSON.stringify((reData?.results || []).map((r) => r.message)));

  console.log('\n=== 4. NON-XLSX UPLOAD IS REJECTED (the fix from earlier) ===');
  const fd2 = new FormData();
  fd2.append('file', new Blob(['not a spreadsheet'], { type: 'text/plain' }), 'evil.txt');
  const bad = await fetch(BASE + '/api/admin/users/bulk-import', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd2,
  });
  ok('.txt upload refused', bad.status >= 400, `got ${bad.status}`);

  console.log('\n=== 5. CONSULTANT-CLIENT ISOLATION ===');
  const users = await call('/api/admin/users', { token });
  ok('client list loads', users.status === 200, `got ${users.status}`);
  const list = users.data?.users || users.data?.data || users.data || [];
  const arr = Array.isArray(list) ? list : [];
  const mine = arr.filter((u) => String(u.email || '').includes('qa.client'));
  ok('imported clients are visible to their consultant', mine.length >= 2, `saw ${mine.length}`);
  const foreign = arr.filter((u) => String(u.email || '').includes('mas.zaf@gmail.com'));
  ok('independent/other users are NOT visible', foreign.length === 0, `leaked ${foreign.length}`);

  console.log('\n=== 6. IMPERSONATION INTO A CLIENT ===');
  const target = mine[0];
  if (!target) { ok('impersonation (no client to target)', false); }
  else {
    const imperson = await call(`/api/admin/impersonate/${target.id}`, { method: 'POST', token });
    ok('can impersonate an assigned client', imperson.status === 200, `got ${imperson.status}`);
    const itok = imperson.data?.data?.impersonationToken;
    ok('impersonation returns a token', !!itok);
    if (itok) {
      const forms = ['current-return', 'adjustable-tax', 'final-min-income', 'reductions', 'credits', 'deductions', 'capital-gains'];
      for (const f of forms) {
        const r = await call(`/api/tax-forms/${f}`, { token: itok });
        ok(`  form reachable as client: ${f}`, r.status === 200, `got ${r.status}`);
      }
      const end = await call('/api/admin/end-impersonation', { method: 'POST', token: itok });
      ok('can end impersonation', [200, 204].includes(end.status), `got ${end.status}`);
    }
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
