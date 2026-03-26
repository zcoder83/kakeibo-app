const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function sb(method, path, body, token) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token || SUPABASE_KEY}`,
      'Prefer': method === 'POST' && path.includes('/rest/') ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || data.error_description || text);
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, password, name, familyCode, token } = req.body || {};

  try {
    switch(action) {

      // ── 관리자 회원가입 (새 가족 생성)
      case 'signupAdmin': {
        const code = Math.random().toString(36).substring(2,8).toUpperCase();
        const authData = await sb('POST', '/auth/v1/signup', { email, password });
        const uid = authData.user?.id;
        if (!uid) throw new Error('Signup failed');
        // 프로필 생성
        await sb('POST', '/rest/v1/profiles',
          { id: uid, name, role: 'admin', family_code: code, color: '#c8490a' },
          authData.access_token
        );
        return res.json({ user: authData.user, token: authData.access_token, role: 'admin', familyCode: code, name });
      }

      // ── 멤버 회원가입 (기존 가족 참가)
      case 'signupMember': {
        // 가족코드 유효성 확인
        const check = await sb('GET', `/rest/v1/profiles?family_code=eq.${familyCode}&role=eq.admin&limit=1`);
        if (!Array.isArray(check) || !check.length) throw new Error('家族コードが見つかりません');
        const authData = await sb('POST', '/auth/v1/signup', { email, password });
        const uid = authData.user?.id;
        if (!uid) throw new Error('Signup failed');
        const colors = ['#1a5fa8','#2d7a4f','#7c3aed','#d97706','#db2777'];
        const color = colors[Math.floor(Math.random()*colors.length)];
        await sb('POST', '/rest/v1/profiles',
          { id: uid, name, role: 'member', family_code: familyCode, color },
          authData.access_token
        );
        return res.json({ user: authData.user, token: authData.access_token, role: 'member', familyCode, name });
      }

      // ── 로그인
      case 'signin': {
        const authData = await sb('POST', '/auth/v1/token?grant_type=password', { email, password });
        const uid = authData.user?.id;
        // 프로필 조회
        const profiles = await sb('GET', `/rest/v1/profiles?id=eq.${uid}`, null, authData.access_token);
        const profile = profiles[0];
        if (!profile) throw new Error('プロフィールが見つかりません');
        return res.json({
          user: authData.user,
          token: authData.access_token,
          role: profile.role,
          familyCode: profile.family_code,
          name: profile.name,
          color: profile.color,
          userId: uid,
        });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch(e) {
    return res.status(400).json({ error: e.message });
  }
}
