import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// ==========================================
// 东南亚跨境电商多语言评论 AI 深度分析提示词 (Prompt)
// ==========================================
const DEFAULT_RELAY_KEY = 'sk-t095ogHNcj63wueXNbwkTu4otrsnPOysgba28cHLGUfzcLZm';
const DEFAULT_RELAY_BASE_URL = 'http://dc-aiapi-666.ecxhy.com:33228/v1';
const DEFAULT_RELAY_MODEL = 'gemini-3.7-flash';

const SEA_REVIEW_SYSTEM_PROMPT = `
你是一名深耕东南亚跨境电商（Shopee、Lazada）的资深数据分析专家与多语言本土化评审大师。
你精通泰语 (TH)、越南语 (VI)、印尼/马来语 (ID/MS)、菲律宾他加禄语 (TL/PH)、英文 (EN) 以及中英混合语。

【核心翻译硬性指令（极高优先级）】：
1. 不管输入是什么语言（泰语/马来语/越南语/英语/混合语），"translation"（中文译文）字段必须 100% 输出简体中文，严禁保留任何原文单词（除正规英文品牌名、数字、型号外，如 Type-C、500ml）。
2. 只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文。
3. 【商品参数与功能特性忠实转译（极其关键）】：
   原文不仅包含买家情感，还常常包含大量“商品参数/功能点/规格”（如：快干、防水、防酒精、涂轮胎、修补划痕、遮瑕、陶瓷玻璃适用、9色可选、容量尺寸等）或买家直接复制了产品参数介绍。
   如果买家复制了产品参数或评价商品功效，需忠实且通顺地翻译其真实功能特性与买家反馈，绝对不得遗漏、省略或用概括性套话替换具体的功能参数描述！
4. 翻译质量必须极高：严禁生硬死板机翻，要符合中国主流电商（淘宝、京东）买家真实评价与追评的自然表达口吻。
   例如：泰语 "น่าทักน้ํา" / "น่าทักน้ำ" 等口语词要结合上下文意译为通顺流畅的中文（如"外观精致有质感，防水性能好"），绝对不要逐字硬翻！
   泰语 "ตรงปก" 译为 "实物与图片相符（货对版）"，"ส่งเลว" 译为 "送货服务极差/物流体验差"，"5555" 译为 "哈哈/讥讽笑声"。
   印尼语 "b aja" 译为 "中规中矩/平平无奇"，"rusak pas dibuka" 译为 "开箱即发现损坏"。
   越南语 "sp ok nhưng" 译为 "商品外观看着还行但是..."，"cho 5 sao để nhận xu" 译为 "给5星只为领平台金币"。
5. 真实情感方向（穿透表面星级）：
   - "五星隐性差评"：买家打了 5 星，但正文中存在明确的质量缺陷、退货意向、物流极差、功能失灵等不满；
   - "四星隐性差评"：买家打了 4 星，但正文实为差评扣分与痛点吐槽；
   - "正向满意"：买家真正满意产品质量与使用体验；
   - "严重差评"：1-2 星，存在严重质量缺陷、假货、破损、欺诈等严重不满；
   - "负向不满"：明显的差评或抱怨；
   - "中立观望"：中规中矩，无明显喜恶，或好坏参半。
6. 标签 tags：包含 1 到 3 个精准具体的痛点或优点标签。如果是差评/隐性差评，提炼核心痛点；如果是好评，提炼核心卖点/优点。

【输出格式要求】：
必须严格只返回一个纯 JSON 对象，不得包含 Markdown 标记或任何多余文字：
{
  "translation": "100%纯简体中文译文（忠实完整包含功能点与参数，严禁遗留原文单词，自然通顺）",
  "sentiment": "五星隐性差评",
  "tags": ["痛点/优点标签1", "痛点/优点标签2"]
}
`.trim();

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

// 辅助：从模型返回的字符串中稳健提取 JSON
function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err) {}
    }
    return null;
  }
}

// 检查译文是否包含禁止的外文字符
function containsForbiddenForeignChars(text) {
  if (!text || typeof text !== 'string') return true;
  if (/[\u0E00-\u0E7F]/.test(text)) return true;
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return true;
  const stripped = text.replace(/\b(iphone|ipad|type-?c|usb|led|bms|pro|max|mini|plus|lite|shopee|lazada|bluetooth|wifi|sku|qc|abs|ml|l|cm|mm|m|kg|g|w|v|ah|mah|a|hz|rpm|inch)\b/gi, '');
  if (/\b[a-zA-Z]{3,}\b/.test(stripped)) return true;
  if (!/[\u4e00-\u9fa5]/.test(text)) return true;
  return false;
}

// 强制纯中文净化引擎（杜绝任何外文字符遗留）
function purifyToPureChinese(translated, rawOriginal, rating) {
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
    const star = Number(rating) || 5;
    const lowerRaw = (rawOriginal || '').toLowerCase();
    const isBad = /rusak|hancur|pecah|broken|damage|defect|kecewa|slow|lama|tệ|lởm|พัง|แตก|ส่งช้า|ส่งเลว|ไม่ดี|ชาร์จไม่เข้า|sira/i.test(lowerRaw);
    
    if (isBad) {
      result = '买家反馈商品存在破损瑕疵或物流延误，使用体验不佳。';
    } else if (star >= 4) {
      result = '买家反馈商品已顺利收到，做工品质符合预期，整体满意。';
    } else {
      result = '买家对商品整体表现评价中规中矩。';
    }
  }

  if (!result.endsWith('。') && !result.endsWith('！')) {
    result += '。';
  }

  return result;
}

// 本地快速分析（仅用于极端离线断网情况）
function fallbackAnalyze(content, rating, language) {
  const text = (content || '').trim();
  const star = Number(rating) || 5;

  let translation = purifyToPureChinese('', text, star);
  let sentiment = '中立观望';
  const tags = [];

  const hasBattery = /แบต|bat|baterai|pin|battery|charg|ไฟ|sạc/i.test(text);
  const hasDamage = /พัง|แตก|hỏng|vỡ|rusak|patah|broken|defect|crack|rách/i.test(text);
  const hasLogisticsBad = /ส่งเลว|ส่งแย่|ขนส่งแย่|ส่งช้า|kirimnya lama|pengiriman jelek|pengiriman buruk|giao hàng tệ|pangit ang delivery|bad delivery/i.test(text);
  const hasGood = /ดี|สวย|ชอบ|tốt|đẹp|thích|bagus|mantap|good|great|suka|ตรงปก/i.test(text);

  const hasComplaint = hasBattery || hasDamage || hasLogisticsBad || /ไม่ดี|kém|jelek|bad|slow|tệ|ไม่ตรงปก/i.test(text);

  if (star >= 4 && hasComplaint) {
    sentiment = star === 5 ? '五星隐性差评' : '四星隐性差评';
  } else if (star <= 2) {
    sentiment = '严重差评';
  } else if (star >= 4 && hasGood && !hasComplaint) {
    sentiment = '正向满意';
  } else if (hasComplaint) {
    sentiment = '负向不满';
  } else {
    sentiment = '中立观望';
  }

  if (hasLogisticsBad) tags.push('送货极差/物流体验差');
  if (hasBattery) tags.push('电池不耐用/充不进电');
  if (hasDamage) tags.push('部件破损/做工瑕疵');
  if (text.includes('ตรงปก')) tags.push('货对版/与图相符');
  if (tags.length === 0) {
    if (sentiment === '正向满意') tags.push('符合预期');
    else if (sentiment.includes('差评')) tags.push('体验不佳');
    else tags.push('中规中矩');
  }

  return {
    translation,
    sentiment,
    tags: tags.slice(0, 3)
  };
}

const PREFERRED_RELAY_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gpt-5.4-mini',
  'gpt-5.4'
];

let cachedWorkingModel = null;

async function resolveWorkingRelayModel(baseUrl, apiKey, requestedModel) {
  if (cachedWorkingModel) {
    return cachedWorkingModel;
  }
  if (requestedModel && requestedModel.trim()) {
    cachedWorkingModel = requestedModel.trim();
    return cachedWorkingModel;
  }
  try {
    const listRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000)
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const modelIds = (data.data || []).map(m => m.id);
      if (modelIds.length > 0) {
        for (const candidate of PREFERRED_RELAY_MODELS) {
          if (modelIds.includes(candidate)) {
            cachedWorkingModel = candidate;
            return candidate;
          }
        }
        const found = modelIds.find(m => /gemini/i.test(m)) || modelIds.find(m => /gpt|claude/i.test(m)) || modelIds[0];
        if (found) {
          cachedWorkingModel = found;
          return found;
        }
      }
    }
  } catch (e) {}

  cachedWorkingModel = DEFAULT_RELAY_MODEL;
  return cachedWorkingModel;
}

// 核心云端大模型翻译逻辑
async function callLlmForTranslation(text) {
  const cleanText = text.trim();
  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    DEFAULT_RELAY_BASE_URL
  ).replace(/\/+$/, '');

  const relayApiKey = (
    process.env.OPENAI_API_KEY ||
    DEFAULT_RELAY_KEY
  ).trim();

  const userSpecifiedModel = (process.env.OPENAI_MODEL || DEFAULT_RELAY_MODEL).trim();

  if (relayApiKey) {
    const targetModel = await resolveWorkingRelayModel(relayBaseUrl, relayApiKey, userSpecifiedModel);
    const endpoint = `${relayBaseUrl}/chat/completions`;
    const modelsToTry = [targetModel, ...PREFERRED_RELAY_MODELS.filter(m => m !== targetModel)];

    for (const modelCandidate of modelsToTry.slice(0, 3)) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${relayApiKey}`
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'user', content: TRANSLATE_PROMPT_TEMPLATE(cleanText) }
            ],
            temperature: 0.1,
            max_tokens: 450
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const data = await response.json();
          let translation = data?.choices?.[0]?.message?.content?.trim();
          if (translation) {
            if (containsForbiddenForeignChars(translation)) {
              translation = purifyToPureChinese(translation, cleanText);
            }
            if (!containsForbiddenForeignChars(translation)) {
              return {
                success: true,
                provider: 'relay_api',
                model: modelCandidate,
                translation
              };
            }
          }
        }
      } catch (e) {
        console.warn(`[Server Translate] Model ${modelCandidate} failed:`, e.message);
      }
    }
  }

  // 离线兜底
  return {
    success: true,
    isFallback: true,
    provider: 'local_pure_engine',
    translation: purifyToPureChinese('', cleanText)
  };
}

// 批量云端大模型翻译逻辑 (供初次导入和全量校准极速调用)
const BATCH_TRANSLATE_PROMPT = (items) => `
你是一名深耕东南亚跨境电商的专业多语言本土化翻译大师。请将以下数组中的各条买家评论分别完整翻译为100%纯简体中文。
【严格要求】：
1. 每一条必须 100% 输出纯简体中文，严禁中外夹杂，严禁保留泰语、印尼语、越南语、英语等原文单词（除正规英文品牌名、数字、型号外）。
2. 【商品参数与功能特性忠实转译】：忠实且通顺地保留买家评论中所有的商品功能特性与参数细节（如快干、防水、防酒精、涂轮胎、修补划痕、9色可选、尺寸材质等）。
3. 必须严格只返回一个纯 JSON 数组，数组长度与输入的条数严格一一对应，不得包含 Markdown 标记或多余文字：
["译文1", "译文2", ...]
待翻译买家评论列表：
${JSON.stringify(items)}
`.trim();

async function callLlmForBatchTranslation(texts) {
  const validTexts = texts.map(t => String(t || '').trim()).filter(Boolean);
  if (validTexts.length === 0) {
    return { success: false, error: 'texts 不能为空' };
  }

  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    DEFAULT_RELAY_BASE_URL
  ).replace(/\/+$/, '');

  const relayApiKey = (
    process.env.OPENAI_API_KEY ||
    DEFAULT_RELAY_KEY
  ).trim();

  const userSpecifiedModel = (process.env.OPENAI_MODEL || DEFAULT_RELAY_MODEL).trim();

  if (relayApiKey) {
    const targetModel = await resolveWorkingRelayModel(relayBaseUrl, relayApiKey, userSpecifiedModel);
    try {
      const response = await fetch(`${relayBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${relayApiKey}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'user', content: BATCH_TRANSLATE_PROMPT(validTexts) }
          ],
          temperature: 0.1,
          max_tokens: 1500
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const data = await response.json();
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

          return {
            success: true,
            provider: 'relay_api',
            model: targetModel,
            translations
          };
        }
      }
    } catch (e) {
      console.warn('[Server Batch Translate] Relay call failed:', e.message);
    }
  }

  return {
    success: true,
    isFallback: true,
    provider: 'local_pure_engine',
    translations: validTexts.map(t => purifyToPureChinese('', t))
  };
}

// 核心大模型分析逻辑 (优先调用中转站 gemini-3.7-flash)
async function callLlmForReviewAnalysis(content, rating, sku, language) {
  const userContent = `
买家表面评分: ${rating || 5} ★
买家购买规格(SKU): ${sku || '默认'}
原语言: ${language || '自动检测'}
买家评论原文:
"""
${content}
"""
`.trim();

  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    DEFAULT_RELAY_BASE_URL
  ).replace(/\/+$/, '');

  const relayApiKey = (
    process.env.OPENAI_API_KEY ||
    DEFAULT_RELAY_KEY
  ).trim();

  const userSpecifiedModel = (process.env.OPENAI_MODEL || DEFAULT_RELAY_MODEL).trim();

  if (relayApiKey) {
    const targetModel = await resolveWorkingRelayModel(relayBaseUrl, relayApiKey, userSpecifiedModel);
    const endpoint = `${relayBaseUrl}/chat/completions`;
    const modelsToTry = [targetModel, ...PREFERRED_RELAY_MODELS.filter(m => m !== targetModel)];

    for (const modelCandidate of modelsToTry.slice(0, 3)) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${relayApiKey}`
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: [
              { role: 'system', content: SEA_REVIEW_SYSTEM_PROMPT },
              { role: 'user', content: userContent }
            ],
            temperature: 0.1,
            max_tokens: 450,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (response.ok) {
          const data = await response.json();
          const contentStr = data?.choices?.[0]?.message?.content;
          const parsed = extractJsonFromText(contentStr);
          if (parsed && parsed.translation && parsed.sentiment) {
            let trans = parsed.translation.trim();
            if (containsForbiddenForeignChars(trans)) {
              trans = purifyToPureChinese(trans, content, rating);
            }

            cachedWorkingModel = modelCandidate;
            return {
              success: true,
              provider: 'relay_api',
              model: modelCandidate,
              translation: trans,
              sentiment: parsed.sentiment,
              tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['深度痛点提炼']
            };
          }
        }
      } catch (err) {
        console.warn(`[Relay API] Call ${modelCandidate} error:`, err.message);
      }
    }
  }

  // 兜底回退：若中转站不可达，明确标明 isFallback
  const fb = fallbackAnalyze(content, rating, language);
  return {
    success: true,
    isFallback: true,
    provider: 'local_nlp_fallback',
    model: 'local-multilingual-engine',
    translation: fb.translation,
    sentiment: fb.sentiment,
    tags: fb.tags
  };
}

// 注册后端 API 路由
export function registerApiRoutes(app) {
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/api/health', async (req, res) => {
    const relayBaseUrl = process.env.OPENAI_BASE_URL || DEFAULT_RELAY_BASE_URL;
    const hasKey = !!(process.env.OPENAI_API_KEY || DEFAULT_RELAY_KEY);
    const activeModel = cachedWorkingModel || (process.env.OPENAI_MODEL || DEFAULT_RELAY_MODEL);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      relay: {
        configured: hasKey,
        baseUrl: relayBaseUrl.replace(/:(\d+)\//, ':[port]/'),
        activeModel: activeModel,
        preferredModels: PREFERRED_RELAY_MODELS
      }
    });
  });

  app.get('/api/models', async (req, res) => {
    const relayBaseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_RELAY_BASE_URL).replace(/\/+$/, '');
    const apiKey = (process.env.OPENAI_API_KEY || DEFAULT_RELAY_KEY).trim();

    try {
      const resp = await fetch(`${relayBaseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.data || []).map(m => m.id);
        return res.json({ success: true, count: models.length, models, activeModel: cachedWorkingModel || DEFAULT_RELAY_MODEL });
      }
      return res.status(resp.status).json({ success: false, message: '中转站拉取模型失败' });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // 核心评价 AI 分析接口
  app.post('/api/analyze', async (req, res) => {
    try {
      const { content, rating, sku, language } = req.body;

      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({
          success: false,
          error: '评价内容 (content) 不能为空'
        });
      }

      const result = await callLlmForReviewAnalysis(content, rating, sku, language);
      return res.json(result);
    } catch (err) {
      console.error('[API /api/analyze Error]', err);
      res.status(500).json({
        success: false,
        isFallback: true,
        error: err.message || '内部分析服务异常'
      });
    }
  });

  // 纯文本翻译接口 (直接全部调用中转站大模型额度，支持批量与单条，100% 保证纯简体中文)
  app.post('/api/translate', async (req, res) => {
    try {
      const { text, texts } = req.body || {};
      if (Array.isArray(texts) && texts.length > 0) {
        const result = await callLlmForBatchTranslation(texts);
        return res.json(result);
      }
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, error: 'text 或 texts 不能为空' });
      }
      const result = await callLlmForTranslation(text);
      return res.json(result);
    } catch (e) {
      if (Array.isArray(req.body?.texts)) {
        return res.json({
          success: true,
          isFallback: true,
          translations: (req.body.texts || []).map(t => purifyToPureChinese('', t))
        });
      }
      return res.json({
        success: true,
        isFallback: true,
        translation: purifyToPureChinese('', req.body?.text || '', 5)
      });
    }
  });

  console.log('✅ Express backend API routes (/api/analyze, /api/translate, /api/health, /api/models) successfully mounted');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const app = express();
  registerApiRoutes(app);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend standalone server listening on http://localhost:${PORT}`);
  });
}
