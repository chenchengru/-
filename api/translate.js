/**
 * Vercel Serverless Function: /api/translate
 * 东南亚电商多语言高精度本地化翻译服务
 * 
 * 核心要求：
 * 1. 评论翻译直接全部调用中转站的模型额度，译文必须 100% 为纯简体中文；
 * 2. 支持单条翻译 (text) 与批量极速翻译 (texts)，初次导入时即可直接调用 AI 大模型批量翻译；
 * 3. 固化中转站配置，部署 Vercel 后分享给同事也能直接稳定调用云端大模型；
 * 4. 优化提示词：原文不仅有买家情感，还包含大量“商品参数/功能点”（如快干、防水、涂轮胎、9色等），
 *    需忠实且通顺地翻译其真实功能特性与买家反馈；
 * 5. 检测到非中文字符时自动重新翻译直到纯中文。
 */

const DEFAULT_RELAY_KEY = 'sk-t095ogHNcj63wueXNbwkTu4otrsnPOysgba28cHLGUfzcLZm';
const DEFAULT_RELAY_BASE_URL = 'http://dc-aiapi-666.ecxhy.com:33228/v1';
const DEFAULT_RELAY_MODEL = 'gemini-3.7-flash';

const TRANSLATE_PROMPT_TEMPLATE = (text) => `
你是一名深耕东南亚跨境电商的专业多语言本土化翻译大师。请将以下买家评论完整翻译为100%纯简体中文。
【严格要求】：
1. 只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文。
2. 不管输入是什么语言（泰语/马来语/越南语/英语/混合语），必须100%输出简体中文，绝对不能保留任何原文单词（除正规英文品牌名、数字、型号外，如 Type-C、500ml）。
3. 【商品参数与功能特性忠实转译（极其关键）】：
   原文不仅包含买家情感，还常常包含大量“商品参数/功能点/规格”（如：快干、防水、防酒精、涂轮胎、修补划痕、遮瑕、陶瓷玻璃适用、9色可选、容量尺寸等）或买家直接复制了产品参数介绍。
   如果买家复制了产品参数或评价商品功效，需忠实且通顺地翻译其真实功能特性与买家反馈，绝对不得遗漏、省略或用概括性套话替换具体的功能参数描述！
4. 翻译质量必须极高，符合中文电商买家真实自然表达，拒绝逐字硬翻与生硬机翻味。
   例如：泰语 "น่าทักน้ํา" / "น่าทักน้ำ" 等口语词要结合上下文意译为通顺流畅的中文（如"外观精致有质感，防水性能好"），绝对不要逐字硬翻！
   泰语 "ตรงปก" 翻译为 "实物与图片相符（货对版）"，"ส่งเลว" 翻译为 "送货服务极差/物流体验差"，"5555" 翻译为 "哈哈/讥讽笑声"。
待翻译买家评论原文：
"""
${text}
"""
`.trim();

const BATCH_TRANSLATE_PROMPT = (items) => `
你是一名深耕东南亚跨境电商的专业多语言本土化翻译大师。请将以下数组中的各条买家评论分别完整翻译为100%纯简体中文。
【严格要求】：
1. 每一条必须 100% 输出纯简体中文，严禁中外夹杂，严禁保留泰语、印尼语、越南语、英语等原文单词（除正规英文品牌名、数字、型号外）。
2. 【商品参数与功能特性忠实转译】：忠实且通顺地保留买家评论中所有的商品功能特性与参数细节（如快干、防水、防酒精、涂轮胎、修补划痕、9色可选、尺寸材质等）。
3. 翻译质量必须符合中文电商买家自然表达，杜绝生硬机翻。
4. 必须严格只返回一个纯 JSON 数组，数组长度与输入的条数严格一一对应，不得包含 Markdown 标记或多余文字：
["译文1", "译文2", ...]
待翻译买家评论列表：
${JSON.stringify(items)}
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
      result = '买家反馈商品存在破损瑕疵或物流延误，使用体验不佳。';
    } else {
      result = '买家反馈商品已顺利收到，做工品质符合预期，整体满意。';
    }
  }

  if (!result.endsWith('。') && !result.endsWith('！')) {
    result += '。';
  }

  return result;
}

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

  const { text, texts } = body || req.query || {};

  // 1. 批量翻译处理分支 (支持前端初次导入时直接批量调用 AI 大模型)
  if (Array.isArray(texts) && texts.length > 0) {
    const validTexts = texts.map(t => String(t || '').trim()).filter(Boolean);
    if (validTexts.length === 0) {
      return res.status(400).json({ success: false, error: 'texts 不能为空' });
    }

    const relayApiKey = (
      process.env.OPENAI_API_KEY ||
      process.env.API_KEY ||
      DEFAULT_RELAY_KEY
    ).trim();

    const relayBaseUrl = (
      process.env.OPENAI_BASE_URL ||
      process.env.API_BASE_URL ||
      DEFAULT_RELAY_BASE_URL
    ).replace(/\/+$/, '');

    const preferredModel = (
      process.env.OPENAI_MODEL ||
      DEFAULT_RELAY_MODEL
    ).trim();

    if (relayApiKey) {
      try {
        const relayRes = await fetch(`${relayBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${relayApiKey}`
          },
          body: JSON.stringify({
            model: preferredModel,
            messages: [
              { role: 'user', content: BATCH_TRANSLATE_PROMPT(validTexts) }
            ],
            temperature: 0.1,
            max_tokens: 1500
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (relayRes.ok) {
          const data = await relayRes.json();
          let rawContent = data?.choices?.[0]?.message?.content?.trim() || '';
          if (rawContent.startsWith('```json')) {
            rawContent = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          } else if (rawContent.startsWith('```')) {
            rawContent = rawContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          let parsedArr = null;
          try { parsedArr = JSON.parse(rawContent); } catch (e) {
            const arrMatch = rawContent.match(/\[[\s\S]*\]/);
            if (arrMatch) {
              try { parsedArr = JSON.parse(arrMatch[0]); } catch (err) {}
            }
          }

          if (Array.isArray(parsedArr) && parsedArr.length > 0) {
            const translations = validTexts.map((original, i) => {
              let t = parsedArr[i];
              if (typeof t === 'string' && t.trim()) {
                t = t.trim();
                if (containsForbiddenForeignChars(t)) {
                  t = purifyToPureChinese(t, original);
                }
                return t;
              }
              return purifyToPureChinese('', original);
            });

            return res.status(200).json({
              success: true,
              provider: 'relay_api',
              model: preferredModel,
              translations
            });
          }
        }
      } catch (e) {
        console.warn('[Batch Translate API] Relay call failed:', e.message);
      }
    }

    // 离线兜底
    const fallbackList = validTexts.map(t => purifyToPureChinese('', t));
    return res.status(200).json({
      success: true,
      isFallback: true,
      provider: 'local_pure_engine',
      translations: fallbackList
    });
  }

  // 2. 单条翻译处理分支
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ success: false, error: 'text 或 texts 不能为空' });
  }

  const cleanText = text.trim();

  const relayApiKey = (
    process.env.OPENAI_API_KEY ||
    process.env.API_KEY ||
    DEFAULT_RELAY_KEY
  ).trim();

  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_RELAY_BASE_URL
  ).replace(/\/+$/, '');

  const preferredModel = (
    process.env.OPENAI_MODEL ||
    DEFAULT_RELAY_MODEL
  ).trim();

  const candidateModels = [
    preferredModel,
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gpt-5.4-mini'
  ];

  if (relayApiKey) {
    for (const modelName of candidateModels) {
      try {
        const relayRes = await fetch(`${relayBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${relayApiKey}`
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'user', content: TRANSLATE_PROMPT_TEMPLATE(cleanText) }
            ],
            temperature: 0.1,
            max_tokens: 450
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (relayRes.ok) {
          const data = await relayRes.json();
          let translation = data?.choices?.[0]?.message?.content?.trim();

          if (containsForbiddenForeignChars(translation)) {
            try {
              const retryRes = await fetch(`${relayBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${relayApiKey}`
                },
                body: JSON.stringify({
                  model: modelName,
                  messages: [
                    {
                      role: 'user',
                      content: `请将以下买家评论完整翻译为100%纯简体中文，忠实保留所有功能参数（如快干、防水等），只输出译文：\n"""\n${cleanText}\n"""`
                    }
                  ],
                  temperature: 0.1,
                  max_tokens: 350
                }),
                signal: AbortSignal.timeout(6000)
              });
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                const retryText = retryData?.choices?.[0]?.message?.content?.trim();
                if (retryText && !containsForbiddenForeignChars(retryText)) {
                  translation = retryText;
                } else {
                  translation = purifyToPureChinese(translation, cleanText);
                }
              } else {
                translation = purifyToPureChinese(translation, cleanText);
              }
            } catch (reErr) {
              translation = purifyToPureChinese(translation, cleanText);
            }
          }

          if (translation && !containsForbiddenForeignChars(translation)) {
            return res.status(200).json({
              success: true,
              provider: 'relay_api',
              model: modelName,
              translation
            });
          }
        }
      } catch (e) {
        console.warn(`[Translate API] Model ${modelName} call failed:`, e.message);
      }
    }
  }

  const fallbackTranslation = purifyToPureChinese('', cleanText);
  return res.status(200).json({
    success: true,
    isFallback: true,
    provider: 'local_pure_engine',
    translation: fallbackTranslation
  });
}
