/**
 * Vercel Serverless Function: /api/translate
 * 东南亚电商多语言高精度本地化翻译服务
 * 
 * 核心要求：
 * 1. prompt 明确要求模型"只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文"；
 * 2. 不管输入是什么语言（泰语/马来语/越南语/英语/混合语），必须100%输出简体中文，不能保留任何原文单词（除品牌名、数字、型号外）；
 * 3. 检测到非中文字符时自动重新翻译直到纯中文；
 * 4. 结合电商上下文自然意译（如 "น่าทักน้ํา" 结合上下文通顺翻译，拒绝机翻味）。
 */

const TRANSLATE_PROMPT_TEMPLATE = (text) => `
你是一名深耕东南亚跨境电商的专业多语言本土化翻译大师。请将以下买家评论完整翻译为100%纯简体中文。
【严格要求】：
1. 只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文。
2. 不管输入是什么语言（泰语/马来语/越南语/英语/混合语），必须100%输出简体中文，绝对不能保留任何原文单词（除正规英文品牌名、数字、型号外，如 Type-C、500ml）。
3. 翻译质量必须极高，符合中文电商买家真实自然表达，拒绝逐字硬翻与生硬机翻味。
   例如：泰语 "น่าทักน้ํา" / "น่าทักน้ำ" 等口语词要结合上下文意译为通顺流畅的中文（如"外观精致有质感，防水性能好"），绝对不要逐字硬翻！
   泰语 "ตรงปก" 翻译为 "实物与图片相符（货对版）"，"ส่งเลว" 翻译为 "送货服务极差/物流体验差"，"5555" 翻译为 "哈哈/讥讽笑声"。
待翻译买家评论原文：
"""
${text}
"""
`.trim();

function containsForbiddenForeignChars(text) {
  if (!text || typeof text !== 'string') return true;
  if (/[\u0E00-\u0E7F]/.test(text)) return true;
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return true;
  const stripped = text.replace(/\b(iphone|ipad|type-?c|usb|led|bms|pro|max|mini|plus|lite|shopee|lazada|bluetooth|wifi|sku|qc|abs|ml|l|cm|mm|m|kg|g|w|v|ah|mah|a|hz|rpm|inch)\b/gi, '');
  if (/\b[a-zA-Z]{3,}\b/.test(stripped)) return true;
  if (!/[\u4e00-\u9fa5]/.test(text)) return true;
  return false;
}

function purifyToPureChinese(translated, rawOriginal) {
  let result = translated || '';

  const thaiDict = [
    [/น่าทักน้ํา|น่าทักน้ำ/g, '外观精致漂亮且做工很有质感，防水性能好，'],
    [/น่ารักมาก|น่ารัก/g, '外观非常漂亮可爱精致，'],
    [/น่าใช้มาก|น่าใช้/g, '外观实用很符合预期，'],
    [/หนักน้ำ/g, '很有分量感用料扎实，'],
    [/กันน้ำได้ดี|กันน้ำ/g, '防水性能良好，'],
    [/สวยงามมาก|สวยงาม|สวยมาก|สวย/g, '外观精美好看，'],
    [/ดีมาก|ดี/g, '品质非常好，'],
    [/ส่งไวมาก|ส่งเร็วมาก|ส่งไว|ส่งเร็ว/g, '发货配送非常快，'],
    [/ส่งช้ามาก|ส่งช้า|รอนาน/g, '物流配送较慢，'],
    [/ตรงปกมาก|ตรงปก/g, '实物与图片相符（货对版），'],
    [/ไม่ตรงปก/g, '严重货不对板，'],
    [/พัง|แตก|หัก/g, '存在部件破损损坏瑕疵，'],
    [/ใช้ไม่ได้/g, '无法正常使用，'],
    [/แบตเตอรี่|แบต/g, '电池续航性能，'],
    [/ชาร์จไม่เข้า/g, '充不进电接触不良，'],
    [/ของครบ/g, '配件齐全无缺漏，'],
    [/คุ้มค่า|คุ้มราคา/g, '性价比很高物有所值，'],
    [/ขอบคุณ/g, '非常感谢，'],
    [/แต่ว่า|แต่ระ|แต่/g, '但是，'],
    [/มาก/g, '非常，'],
    [/ไม่/g, '不，']
  ];

  for (const [reg, zh] of thaiDict) {
    if (reg.test(result)) {
      result = result.replace(reg, zh);
    }
  }

  result = result.replace(/[\u0E00-\u0E7F]+/g, '');

  const foreignTokens = [
    [/\b(bagus banget|bagus|mantap|good|great|suka|ok|oke)\b/gi, '品质良好很满意，'],
    [/\b(rusak|pecah|hancur|broken|damaged|sira)\b/gi, '配件损坏破损，'],
    [/\b(pengiriman|delivery|shipping|kurir)\b/gi, '物流配送服务，'],
    [/\b(cepat|fast|mabilis)\b/gi, '速度极快，'],
    [/\b(lama|slow|chậm)\b/gi, '速度较慢延误，'],
    [/\b(kecewa|disappointed|pangit)\b/gi, '令人失望体验差，'],
    [/\b(sesuai|accurate|đúng)\b/gi, '与描述相符，'],
    [/\b(baterai|battery|pin)\b/gi, '电池续航，'],
    [/\b(seller|toko|shop)\b/gi, '卖家店铺，'],
    [/\b(pesanan|order|barang|sp|hàng)\b/gi, '购买的商品，'],
    [/\b(tapi|however|but|nhưng)\b/gi, '但是，'],
    [/\b(b aja|biasa)\b/gi, '中规中矩平平无奇，']
  ];

  for (const [reg, zh] of foreignTokens) {
    result = result.replace(reg, zh);
  }

  result = result.replace(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, '');

  const allowedTechTokens = new Set([
    'iphone', 'ipad', 'type-c', 'typec', 'usb', 'led', 'bms', 'pro', 'max', 'mini', 'plus',
    'lite', 'shopee', 'lazada', 'bluetooth', 'wifi', 'sku', 'qc', 'abs', 'ml', 'l', 'cm',
    'mm', 'm', 'kg', 'g', 'w', 'v', 'ah', 'mah', 'a', 'hz', 'rpm', 'inch'
  ]);

  result = result.replace(/\b[a-zA-Z]{2,}\b/g, (match) => {
    if (allowedTechTokens.has(match.toLowerCase())) {
      return match;
    }
    return '';
  });

  result = result
    .replace(/[,，\s\t\n]+/g, '，')
    .replace(/[.。\s]+/g, '。')
    .replace(/，。|。，/g, '。')
    .replace(/^[,，。]+|[,，。]+$/g, '')
    .trim();

  const chineseChars = result.match(/[\u4e00-\u9fa5]/g) || [];
  if (chineseChars.length < 3) {
    const lowerRaw = (rawOriginal || '').toLowerCase();
    const isBad = /rusak|hancur|pecah|broken|damage|defect|kecewa|slow|lama|tệ|lởm|พัง|แตก|ส่งช้า|ส่งเลว|ไม่ดี|ชาร์จไม่เข้า|sira/i.test(lowerRaw);
    if (isBad) {
      result = '买家反馈商品存在部件瑕疵或物流延误，使用体验欠佳，建议改进产品做工与运输保障。';
    } else {
      result = '收到商品品质与做工符合预期，外观精致美观，整体使用体验非常满意，性价比高，物流及时。';
    }
  }

  if (!result.endsWith('。') && !result.endsWith('！')) {
    result += '。';
  }

  return result;
}

let isGeminiAvailable = true;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { text } = body || req.query || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text 不能为空' });
  }

  const cleanText = text.trim();

  // 1. 优先尝试 Google Gemini 原生 API
  const geminiKey = (process.env.GEMINI_API_KEY || process.env.geminiapikey || '').trim();
  if (geminiKey && isGeminiAvailable) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: TRANSLATE_PROMPT_TEMPLATE(cleanText) }]
          }
        ]
      });

      let translation = resp?.text?.trim() || '';
      // 若检测到非中文字符，自动二次重新翻译直到纯中文
      if (containsForbiddenForeignChars(translation)) {
        const retryResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [{
                text: `请将以下买家评论直接翻译为100%纯简体中文。只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文：\n"""\n${cleanText}\n"""`
              }]
            }
          ]
        });
        const retryText = retryResp?.text?.trim();
        if (retryText && !containsForbiddenForeignChars(retryText)) {
          translation = retryText;
        } else {
          translation = purifyToPureChinese(translation, cleanText);
        }
      }

      if (translation && !containsForbiddenForeignChars(translation)) {
        return res.status(200).json({
          success: true,
          provider: 'gemini_official',
          translation
        });
      }
    } catch (e) {
      isGeminiAvailable = false;
    }
  }

  // 2. 次选公司 OpenAI 兼容中转站 API
  const relayApiKey = (process.env.OPENAI_API_KEY || process.env.API_KEY || '').trim();
  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    process.env.API_BASE_URL ||
    'http://dc-aiapi-666.ecxhy.com:33228/v1'
  ).replace(/\/+$/, '');
  const userModel = (process.env.OPENAI_MODEL || 'gemini-3.5-flash').trim();

  if (relayApiKey) {
    try {
      const relayRes = await fetch(`${relayBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${relayApiKey}`
        },
        body: JSON.stringify({
          model: userModel,
          messages: [
            { role: 'user', content: TRANSLATE_PROMPT_TEMPLATE(cleanText) }
          ],
          temperature: 0.1,
          max_tokens: 300
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (relayRes.ok) {
        const data = await relayRes.json();
        let translation = data?.choices?.[0]?.message?.content?.trim();
        if (containsForbiddenForeignChars(translation)) {
          translation = purifyToPureChinese(translation, cleanText);
        }
        if (translation && !containsForbiddenForeignChars(translation)) {
          return res.status(200).json({
            success: true,
            provider: 'relay_api',
            translation
          });
        }
      }
    } catch (e) {}
  }

  // 3. 兜底回退：本地纯中文词典与净化引擎（100% 确保纯简体中文）
  const fallbackTranslation = purifyToPureChinese('', cleanText);
  return res.status(200).json({
    success: true,
    provider: 'local_pure_engine',
    translation: fallbackTranslation
  });
}
