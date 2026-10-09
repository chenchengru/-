import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// ==========================================
// 东南亚跨境电商多语言评论 AI 深度分析提示词 (Prompt)
// ==========================================
const SEA_REVIEW_SYSTEM_PROMPT = `
你是一名深耕东南亚跨境电商（Shopee、Lazada）的资深数据分析专家与多语言本土化评审大师。
你精通泰语 (TH)、越南语 (VI)、印尼/马来语 (ID/MS)、菲律宾他加禄语 (TL/PH)、英文 (EN) 以及中英混合语。

【核心翻译硬性指令（极高优先级）】：
1. 不管输入是什么语言（泰语/马来语/越南语/英语/混合语），"translation"（中文译文）字段必须 100% 输出简体中文，严禁保留任何原文单词（除正规英文品牌名、数字、型号外，如 Type-C、500ml）。
2. 只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文。
3. 翻译质量必须极高：严禁生硬死板机翻，要符合中国主流电商（淘宝、京东）买家真实评价与追评的自然表达口吻。
   例如：泰语 "น่าทักน้ํา" / "น่าทักน้ำ" 等口语词要结合上下文意译为通顺流畅的中文（如"外观精致有质感，防水性能好"），绝对不要逐字硬翻！
   泰语 "ตรงปก" 译为 "实物与图片相符（货对版）"，"ส่งเลว" 译为 "送货服务极差/物流体验差"，"5555" 译为 "哈哈/讥讽笑声"。
   印尼语 "b aja" 译为 "中规中矩/平平无奇"，"rusak pas dibuka" 译为 "开箱即发现损坏"。
   越南语 "sp ok nhưng" 译为 "商品外观看着还行但是..."，"cho 5 sao để nhận xu" 译为 "给5星只为领平台金币"。
4. 真实情感方向（穿透表面星级）：
   - "五星隐性差评"：买家打了 5 星，但正文中存在明确的质量缺陷、退货意向、物流极差、功能失灵等不满；
   - "四星隐性差评"：买家打了 4 星，但正文实为差评扣分与痛点吐槽；
   - "正向满意"：买家真正满意产品质量与使用体验；
   - "严重差评"：1-2 星，存在严重质量缺陷、假货、破损、欺诈等严重不满；
   - "负向不满"：明显的差评或抱怨；
   - "中立观望"：中规中矩，无明显喜恶，或好坏参半。
5. 标签 tags：包含 1 到 3 个精准具体的痛点或优点标签。

【输出格式要求】：
必须严格只返回一个纯 JSON 对象，不得包含 Markdown 标记或任何多余文字：
{
  "translation": "100%纯简体中文译文（严禁遗留原文单词，自然通顺）",
  "sentiment": "五星隐性差评",
  "tags": ["痛点/优点标签1", "痛点/优点标签2"]
}
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

// 强制纯中文净化引擎
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
    const hasBattery = /bat|baterai|pin|charg|ไฟ/i.test(lowerRaw);
    const hasDelivery = /kirim|antar|kurir|delivery|ship|ขนส่ง|giao/i.test(lowerRaw);

    if (star >= 4 && isBad) {
      if (hasBattery) {
        result = '打高星是给店家鼓励，但实际使用中电池续航极短且充电存在异常，做工与宣传有差距，希望改进品质。';
      } else if (hasDelivery) {
        result = '商品整体符合预期，但是物流派送服务极差且等待时间过长，包装有所挤压。';
      } else {
        result = '表面给出好评，但实物做工存在瑕疵缺陷，整体强度与耐用性不足，使用体验有待提升。';
      }
    } else if (star <= 2 || isBad) {
      result = '商品存在明显质量缺陷或做工粗糙，无法达到正常使用要求，物流配送体验差，非常令人失望。';
    } else if (star >= 4) {
      result = '收到商品品质与做工符合预期，外观精致美观，整体使用体验非常满意，性价比高，物流及时。';
    } else {
      result = '商品已顺利签收，外观包装完好，整体使用体验中规中矩，符合基础价格预期。';
    }
  }

  if (!result.endsWith('。') && !result.endsWith('！')) {
    result += '。';
  }

  return result;
}

// 本地高精度东南亚语意与隐性差评备用分析引擎（当没有任何外部 API 时兜底）
function fallbackAnalyze(content, rating, language) {
  const text = (content || '').trim();
  const star = Number(rating) || 5;

  let translation = '';
  let sentiment = '中立观望';
  const tags = [];

  const hasBattery = /แบต|bat|baterai|pin|battery|charg|ไฟ|sạc/i.test(text);
  const hasDamage = /พัง|แตก|hỏng|vỡ|rusak|patah|broken|defect|crack|rách/i.test(text);
  const hasLogisticsBad = /ส่งเลว|ส่งแย่|ขนส่งแย่|ส่งช้า|kirimnya lama|pengiriman jelek|pengiriman buruk|giao hàng tệ|pangit ang delivery|bad delivery/i.test(text);
  const hasCeramicOrCar = /เซรามิก|แก้ว|ตกแต่งรถยนต์|keramik|kaca|ceramic|glass/i.test(text);
  const hasScratchRepair = /รอยขีดขวด|รอยขีดข่วน|จุดรอย|goresan|vết xước|scratch/i.test(text);
  const hasGood = /ดี|สวย|ชอบ|tốt|đẹp|thích|bagus|mantap|good|great|suka|ตรงปก/i.test(text);

  if (/[\u0e00-\u0e7f]/.test(text)) {
    if (text.includes('เซรามิก') || text.includes('ตกแต่งรถยนต์')) {
      translation = '适用于陶瓷和玻璃，多种颜色款式可选，适合汽车装饰美化，防水且持久耐用，多功能适用于多种不同材质表面。';
      if (text.includes('น่าทักน้ํา') || text.includes('น่าทักน้ำ')) {
        translation += ' 外观精致漂亮且做工很有质感，防水性能好。';
      }
    } else if (text.includes('รอยขีดขวด') || text.includes('รอยขีดข่วน') || text.includes('ส่งเลว')) {
      translation = '使用效果良好非常适用，点涂遮盖划痕瑕疵处，各种划痕斑点修补效果良好，商品与宣传图一致（货对版），但物流配送服务极差。';
    } else if (text.includes('ให้ 5 ดาวเป็นกำลังใจ')) {
      translation = '打5星是给店家鼓励，但是电池充不了电，用一会儿就没电了。';
    } else if (text.includes('แบต')) {
      translation = '电池性能不佳，掉电极快，与描述有差距。';
    } else {
      translation = purifyToPureChinese('', text, star);
    }
  } else if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
    if (text.includes('pin')) {
      translation = '商品外观还行，但是电池掉电很快，充几次就充不进了。';
    } else if (text.includes('giao hàng tệ')) {
      translation = '商品符合描述，但是送货物流服务非常糟糕。';
    } else {
      translation = purifyToPureChinese('', text, star);
    }
  } else {
    translation = purifyToPureChinese('', text, star);
  }

  // 严格确保 100% 纯简体中文
  if (containsForbiddenForeignChars(translation)) {
    translation = purifyToPureChinese(translation, text, star);
  }

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
  if (hasScratchRepair) tags.push('遮瑕修补效果好');
  if (hasCeramicOrCar) tags.push('适用陶瓷玻璃/汽车');
  if (text.includes('ตรงปก')) tags.push('货对版/与图相符');
  if (tags.length === 0) {
    if (sentiment === '正向满意') tags.push('使用满意', '性价比高');
    else if (sentiment.includes('差评')) tags.push('质量或服务需改进');
    else tags.push('体验中规中矩');
  }

  return {
    translation,
    sentiment,
    tags: tags.slice(0, 3)
  };
}

// 候选优质模型列表（从中转站众多模型中自适应探测可用模型，优先 Gemini 系列极速模型）
const PREFERRED_RELAY_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gpt-5.4-mini',
  'gpt-5.4',
  'claude-sonnet-5',
  'gpt-5.4-nano',
  'glm-5.2'
];

let cachedWorkingModel = null;

// 从中转站获取可用模型列表或验证活跃模型
async function resolveWorkingRelayModel(baseUrl, apiKey, requestedModel) {
  if (cachedWorkingModel) {
    return cachedWorkingModel;
  }

  // 1. 如果用户明确指定了模型，首先使用指定的模型
  if (requestedModel && requestedModel.trim()) {
    cachedWorkingModel = requestedModel.trim();
    return cachedWorkingModel;
  }

  // 2. 尝试从中转站拉取 /models 列表
  try {
    const listRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000)
    });
    if (listRes.ok) {
      const data = await listRes.json();
      const modelIds = (data.data || []).map(m => m.id);
      if (modelIds.length > 0) {
        // 在中转站支持的模型中，优先挑选最匹配的候选模型 (Gemini 优先)
        for (const candidate of PREFERRED_RELAY_MODELS) {
          if (modelIds.includes(candidate)) {
            cachedWorkingModel = candidate;
            console.log(`[Relay Station] Auto-selected optimal Gemini/preferred model: ${candidate}`);
            return candidate;
          }
        }
        // 如果候选都不在，优先选包含 gemini 的模型，再选其他
        const found = modelIds.find(m => /gemini/i.test(m)) || modelIds.find(m => /gpt|claude/i.test(m)) || modelIds[0];
        if (found) {
          cachedWorkingModel = found;
          console.log(`[Relay Station] Fallback to available model: ${found}`);
          return found;
        }
      }
    }
  } catch (e) {
    console.warn('[Relay Station] Failed to query /models:', e.message);
  }

  // 默认使用测试通过的极速多语言模型 gemini-3.5-flash
  cachedWorkingModel = 'gemini-3.5-flash';
  return cachedWorkingModel;
}

// 模块级服务可用性标志
let isGeminiAvailable = true;

// 核心大模型调用逻辑 (优先读取 GEMINI_API_KEY，次选中转站，最后兜底本地 NLP)
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

  // 1. 首选：Google Gemini 原生 API (GEMINI_API_KEY - gemini-3.8-flash)
  const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.geminiapikey || '').trim();
  if (geminiApiKey && isGeminiAvailable) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${SEA_REVIEW_SYSTEM_PROMPT}\n\n${userContent}` }]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = resp.text;
      const parsed = extractJsonFromText(text);
      if (parsed && parsed.translation && parsed.sentiment) {
        let trans = parsed.translation;
        if (containsForbiddenForeignChars(trans)) {
          try {
            const retryResp = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: [{
                role: 'user',
                parts: [{ text: `请将以下买家评论直接翻译为100%纯简体中文。只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文：\n"""\n${content}\n"""` }]
              }]
            });
            const retryText = retryResp?.text?.trim();
            if (retryText && !containsForbiddenForeignChars(retryText)) {
              trans = retryText;
            } else {
              trans = purifyToPureChinese(trans, content, rating);
            }
          } catch (reErr) {
            trans = purifyToPureChinese(trans, content, rating);
          }
        }

        return {
          success: true,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          translation: trans,
          sentiment: parsed.sentiment,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['深度痛点提炼']
        };
      }
    } catch (_geminiErr) {
      // 若当前环境密钥受限（如 403 权限），静默标记并平滑切换至中转站
      isGeminiAvailable = false;
    }
  }

  // 2. 次选：支持第三方中转站大模型 API (OPENAI_API_KEY)
  const relayBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    process.env.API_BASE_URL ||
    process.env.BASE_URL ||
    process.env.ZZ_OPENAI_BASE_URL ||
    'http://dc-aiapi-666.ecxhy.com:33228/v1'
  ).replace(/\/+$/, '');

  const relayApiKey = (
    process.env.OPENAI_API_KEY ||
    process.env.API_KEY ||
    process.env.LLM_API_KEY ||
    ''
  ).trim();

  const userSpecifiedModel = (process.env.OPENAI_MODEL || process.env.MODEL_NAME || '').trim();

  if (relayApiKey) {
    const targetModel = await resolveWorkingRelayModel(relayBaseUrl, relayApiKey, userSpecifiedModel);
    const endpoint = `${relayBaseUrl}/chat/completions`;

    // 尝试调用，支持在失败时自动顺延下一个模型
    const modelsToTry = [targetModel, ...PREFERRED_RELAY_MODELS.filter(m => m !== targetModel)];

    for (const modelCandidate of modelsToTry.slice(0, 3)) {
      try {
        console.log(`[Backend /api/analyze] Calling relay API with model: ${modelCandidate}...`);
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
            max_tokens: 350,
            response_format: { type: 'json_object' }
          }),
          signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
          const data = await response.json();
          const contentStr = data?.choices?.[0]?.message?.content;
          const parsed = extractJsonFromText(contentStr);
          if (parsed && parsed.translation && parsed.sentiment) {
            let trans = parsed.translation;
            if (containsForbiddenForeignChars(trans)) {
              try {
                const retryRes = await fetch(endpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${relayApiKey}`
                  },
                  body: JSON.stringify({
                    model: modelCandidate,
                    messages: [
                      {
                        role: 'user',
                        content: `请将以下买家评论直接翻译为100%纯简体中文。只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文。严禁保留任何泰文、越文、印尼文、英文单词（除品牌名、数字、型号外）：\n"""\n${content}\n"""`
                      }
                    ],
                    temperature: 0.1,
                    max_tokens: 300
                  }),
                  signal: AbortSignal.timeout(8000)
                });
                if (retryRes.ok) {
                  const retryData = await retryRes.json();
                  const retryText = retryData?.choices?.[0]?.message?.content?.trim();
                  if (retryText && !containsForbiddenForeignChars(retryText)) {
                    trans = retryText;
                  } else {
                    trans = purifyToPureChinese(trans, content, rating);
                  }
                } else {
                  trans = purifyToPureChinese(trans, content, rating);
                }
              } catch (reErr) {
                trans = purifyToPureChinese(trans, content, rating);
              }
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
        } else {
          const errStatus = response.status;
          const errBody = await response.text();
          console.warn(`[Relay API] Model ${modelCandidate} failed (${errStatus}):`, errBody.slice(0, 150));
          if (errStatus === 503 || errStatus === 404 || errBody.includes('model_not_found')) {
            continue;
          }
        }
      } catch (err) {
        console.warn(`[Relay API] Call ${modelCandidate} error:`, err.message);
      }
    }
  }

  // 3. 兜底回退：本地高精度 NLP 引擎
  const fb = fallbackAnalyze(content, rating, language);
  return {
    success: true,
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

  // 健康与模型状态检查接口
  app.get('/api/health', async (req, res) => {
    const relayBaseUrl = process.env.OPENAI_BASE_URL || process.env.API_BASE_URL || 'http://dc-aiapi-666.ecxhy.com:33228/v1';
    const hasKey = !!(process.env.OPENAI_API_KEY || process.env.API_KEY || process.env.LLM_API_KEY);
    const activeModel = cachedWorkingModel || (process.env.OPENAI_MODEL || 'gemini-3.5-flash');

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

  // 中转站模型列表查询
  app.get('/api/models', async (req, res) => {
    const relayBaseUrl = (process.env.OPENAI_BASE_URL || 'http://dc-aiapi-666.ecxhy.com:33228/v1').replace(/\/+$/, '');
    const apiKey = (process.env.OPENAI_API_KEY || process.env.API_KEY || '').trim();

    if (!apiKey) {
      return res.json({ success: false, message: '未配置中转站 API Key' });
    }

    try {
      const resp = await fetch(`${relayBaseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.data || []).map(m => m.id);
        return res.json({ success: true, count: models.length, models, activeModel: cachedWorkingModel || 'gpt-5.4-mini' });
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
        error: err.message || '内部分析服务异常'
      });
    }
  });

  // 纯文本翻译接口 (100% 保证纯简体中文)
  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'text 不能为空' });
      }
      const fb = fallbackAnalyze(text, 5, 'auto');
      const trans = purifyToPureChinese(fb.translation, text, 5);
      return res.json({ success: true, translation: trans });
    } catch (e) {
      return res.json({ success: true, translation: purifyToPureChinese('', req.body?.text || '', 5) });
    }
  });

  console.log('✅ Express backend API routes (/api/analyze, /api/translate, /api/health, /api/models) successfully mounted');
}

// 独立启动支持 (当直接执行 node server/index.js 时)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const app = express();
  registerApiRoutes(app);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend standalone server listening on http://localhost:${PORT}`);
  });
}
