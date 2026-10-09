/**
 * Vercel Serverless Function: /api/models
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.geminiapikey);
  const relayApiKey = (process.env.OPENAI_API_KEY || process.env.API_KEY || '').trim();
  const relayBaseUrl = (process.env.OPENAI_BASE_URL || 'http://dc-aiapi-666.ecxhy.com:33228/v1').replace(/\/+$/, '');

  let models = ['gemini-3.8-flash'];
  if (relayApiKey) {
    try {
      const resp = await fetch(`${relayBaseUrl}/models`, {
        headers: { Authorization: `Bearer ${relayApiKey}` },
        signal: AbortSignal.timeout(4000)
      });
      if (resp.ok) {
        const data = await resp.json();
        const list = (data.data || []).map(m => m.id);
        if (list.length > 0) models = list;
      }
    } catch (e) {}
  }

  return res.status(200).json({
    success: true,
    activeModel: hasGemini ? 'gemini-3.8-flash' : (models[0] || 'local-fallback'),
    models
  });
}
