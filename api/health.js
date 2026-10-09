/**
 * Vercel Serverless Function: /api/health
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.geminiapikey);
  const hasRelay = Boolean(process.env.OPENAI_API_KEY || process.env.API_KEY);

  return res.status(200).json({
    status: 'ok',
    environment: 'vercel-serverless',
    timestamp: new Date().toISOString(),
    keys: {
      geminiConfigured: hasGemini,
      relayConfigured: hasRelay
    }
  });
}
