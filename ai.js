// Vercel serverless function: proxies the app's AI requests to Groq.
// Set GROQ_API_KEY in Vercel > Project > Settings > Environment Variables.
// Optional: GROQ_MODEL (default llama-3.3-70b-versatile).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Only accept calls from this site
  const origin = req.headers.origin || '';
  if (origin && !origin.endsWith(req.headers.host)) return res.status(403).json({ error: 'forbidden' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI not configured' });

  const { prompt, json } = req.body || {};
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) {
    return res.status(400).json({ error: 'bad request' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 350,
        messages: [{ role: 'user', content: prompt }],
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream error' });
    const d = await r.json();
    const text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
    if (json) {
      try { return res.status(200).json({ data: JSON.parse(text) }); }
      catch (e) { return res.status(502).json({ error: 'bad json' }); }
    }
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'failed' });
  }
};
