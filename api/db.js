const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function supabase(method, table, body, query='') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, familyCode, data } = req.body || {};
  if (!familyCode) return res.status(400).json({ error: 'familyCode required' });

  try {
    switch(action) {

      // ── 거래 내역 불러오기
      case 'getTxns': {
        const rows = await supabase('GET', 'transactions', null,
          `?family_code=eq.${encodeURIComponent(familyCode)}&order=date.desc&limit=200`);
        return res.json(rows);
      }

      // ── 거래 내역 저장
      case 'addTxn': {
        const row = await supabase('POST', 'transactions', { ...data, family_code: familyCode });
        return res.json(row[0] || row);
      }

      // ── 거래 내역 삭제
      case 'deleteTxn': {
        await supabase('DELETE', 'transactions', null,
          `?id=eq.${data.id}&family_code=eq.${encodeURIComponent(familyCode)}`);
        return res.json({ ok: true });
      }

      // ── 거래 여러 개 삭제 (수입 업데이트용)
      case 'deleteTxns': {
        await supabase('DELETE', 'transactions', null,
          `?id=in.(${data.ids.join(',')})&family_code=eq.${encodeURIComponent(familyCode)}`);
        return res.json({ ok: true });
      }

      // ── 가족 멤버 불러오기
      case 'getMembers': {
        const rows = await supabase('GET', 'family_members', null,
          `?family_code=eq.${encodeURIComponent(familyCode)}&order=created_at.asc`);
        return res.json(rows);
      }

      // ── 가족 멤버 저장
      case 'addMember': {
        const row = await supabase('POST', 'family_members', { ...data, family_code: familyCode });
        return res.json(row[0] || row);
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
