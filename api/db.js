const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_KEY;

async function sb(method, table, body, query='', useService=false) {
  const key = useService ? SERVICE_KEY : SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${key}`,
      'Prefer': (method === 'POST' || method === 'PATCH') ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`${method} ${table}: ${e}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, familyCode, token, data } = req.body || {};
  if (!familyCode) return res.status(400).json({ error: 'familyCode required' });

  try {
    switch(action) {
      case 'getTxns': {
        const rows = await sb('GET', 'transactions', null,
          `?family_code=eq.${familyCode}&order=date.desc,created_at.desc&limit=300`);
        return res.json(rows);
      }
      case 'getTxnsByMember': {
        const rows = await sb('GET', 'transactions', null,
          `?family_code=eq.${familyCode}&who=eq.${data.userId}&order=date.desc,created_at.desc&limit=200`);
        return res.json(rows);
      }
      case 'addTxn': {
        const row = await sb('POST', 'transactions', { ...data, family_code: familyCode });
        return res.json(Array.isArray(row) ? row[0] : row);
      }
      case 'deleteTxn': {
        await sb('DELETE', 'transactions', null,
          `?id=eq.${data.id}&family_code=eq.${familyCode}`, true);
        return res.json({ ok: true });
      }
      case 'deleteTxns': {
        await sb('DELETE', 'transactions', null,
          `?id=in.(${data.ids.join(',')})&family_code=eq.${familyCode}`, true);
        return res.json({ ok: true });
      }
      // toggleExclude: service key 사용 (관리자가 타인 항목도 수정 가능)
      case 'toggleExclude': {
        const rows = await sb('PATCH', 'transactions',
          { excluded: data.excluded },
          `?id=eq.${data.id}&family_code=eq.${familyCode}`,
          true  // service key로 RLS 우회
        );
        return res.json({ ok: true, row: Array.isArray(rows) ? rows[0] : rows });
      }
      case 'getMembers': {
        const rows = await sb('GET', 'profiles', null,
          `?family_code=eq.${familyCode}&order=created_at.asc`);
        return res.json(rows);
      }
      case 'getFixedExpenses': {
        const rows = await sb('GET', 'fixed_expenses', null,
          `?family_code=eq.${familyCode}&order=created_at.asc`);
        return res.json(rows);
      }
      case 'addFixedExpense': {
        const row = await sb('POST', 'fixed_expenses', { ...data, family_code: familyCode });
        return res.json(Array.isArray(row) ? row[0] : row);
      }
      case 'updateFixedExpense': {
        const row = await sb('PATCH', 'fixed_expenses',
          { name: data.name, amount: data.amount, cat: data.cat },
          `?id=eq.${data.id}&family_code=eq.${familyCode}`,
          true
        );
        return res.json(Array.isArray(row) ? row[0] : row);
      }
      case 'deleteFixedExpense': {
        await sb('DELETE', 'fixed_expenses', null,
          `?id=eq.${data.id}&family_code=eq.${familyCode}`, true);
        return res.json({ ok: true });
      }
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
