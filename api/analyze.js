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
このレシート画像を分析して、以下のJSON形式で回答してください。
マークダウンや説明文は一切不要です。JSONのみ返してください。

{
  "store": "店名",
  "date": "日付（レシートに記載がなければ今日の日付）",
  "total": 合計金額（数値のみ）,
  "items": [
    {
      "name": "商品名",
      "qty": "数量（例: ×2）",
      "price": 金額（数値のみ）,
      "cat": "カテゴリ（食料品/外食/日用品/交通/医療/エンタメ/衣類/固定費/その他）",
      "em": "絵文字1文字"
    }
  ]
}

カテゴリの判断基準:
- 食料品: 食材・飲み物・お菓子など
- 外食: レストラン・カフェ・コンビニ弁当など
- 日用品: 洗剤・シャンプー・文具など
- 医療: 薬・サプリ・医療用品など
- エンタメ: ゲーム・映画・書籍など
- 衣類: 服・靴・アクセサリーなど
- 固定費: 光熱費・通信費・家賃など
- その他: 消費税・分類不明など`;

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
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: `Claude API error: ${err}` });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
