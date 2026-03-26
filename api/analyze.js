export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `あなたは日本の家計簿アシスタントです。
このレシート画像を分析して、以下のJSON形式のみで回答してください。
前置き・説明・マークダウン記号は一切不要です。{ から始まる純粋なJSONのみ返してください。

{
  "store": "店名",
  "date": "日付（レシートに記載がなければ今日の日付をYYYY/MM/DD形式で）",
  "total": 合計金額の数値,
  "items": [
    {
      "name": "商品名",
      "qty": "数量（例: x2、なければ空文字）",
      "price": 金額の数値,
      "cat": "食料品か外食か日用品か交通か医療かエンタメか衣類か固定費かその他",
      "em": "絵文字1文字"
    }
  ]
}

カテゴリ判断:
食料品=食材・飲料・お菓子、外食=飲食店・コンビニ弁当・カフェ
日用品=洗剤・シャンプー・文具・雑貨、医療=薬・サプリ・医療用品
エンタメ=ゲーム・映画・書籍・音楽、衣類=服・靴・バッグ
固定費=光熱費・通信費・家賃・保険、その他=消費税・不明`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Claude API error ' + response.status + ': ' + errText });
    }

    const data = await response.json();
    const rawText = data.content && data.content.find(function(b){ return b.type === 'text'; });
    const text = rawText ? rawText.text : '';

    var parsed = null;

    // Strategy 1: strip markdown fences
    try {
      var clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch(e1) {}

    // Strategy 2: extract first { } block
    if (!parsed) {
      try {
        var match = text.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch(e2) {}
    }

    // Strategy 3: safe fallback
    if (!parsed) {
      parsed = {
        store: 'レシート',
        date: new Date().toLocaleDateString('ja-JP'),
        total: 0,
        items: [{
          name: '読み取り失敗 - 手動入力してください',
          qty: '',
          price: 0,
          cat: 'その他',
          em: '📄'
        }]
      };
    }

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
