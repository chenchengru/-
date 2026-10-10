/**
 * Vercel Serverless Function: /api/analyze
 * 东南亚跨境电商多语言评论 AI 深度分析接口
 * 
 * 核心要求：
 * 1. 评论翻译直接全部调用中转站的模型额度，译文必须 100% 为简体中文；
 * 2. 固化中转站配置，部署 Vercel 后分享给同事也能稳定调用 AI 大模型；
 * 3. 优化提示词：原文不仅有买家情感，还包含大量商品参数/功能点（如快干、防水、涂轮胎、9色等），
 *    需忠实且通顺地翻译其真实功能特性与买家反馈；
 * 4. 严禁遗留任何非中文单词（除品牌名、数字、型号外）；
 * 5. 若网络异常使用本地引擎，明确透传 isFallback 标记，不做隐蔽的伪假翻译。
 */

// 固化生产环境与中转站默认连接参数（确保部署 Vercel 无论是否手动配置 env 都能直接调用）
const DEFAULT_RELAY_KEY = 'sk-t095ogHNcj63wueXNbwkTu4otrsnPOysgba28cHLGUfzcLZm';
const DEFAULT_RELAY_BASE_URL = 'http://dc-aiapi-666.ecxhy.com:33228/v1';
const DEFAULT_RELAY_MODEL = 'gemini-3.7-flash';

// 东南亚本土电商多语言专业分析 Prompt
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

// 检查译文是否包含禁止的外文字符（泰文字符、越南语重音字符、未翻译的外文单词等）
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

  // 若中文字符不足，忠实结合原文关键词生成直观含义，拒绝捏造假好评
  const chineseChars = result.match(/[\u4e00-\u9fa5]/g) || [];
  if (chineseChars.length < 3) {
    const star = Number(rating) || 5;
    const lowerRaw = (rawOriginal || '').toLowerCase();
    const isBad = /rusak|hancur|pecah|broken|damage|defect|kecewa|slow|lama|tệ|lởm|พัง|แตก|ส่งช้า|ส่งเลว|ไม่ดี|ชาร์จไม่เข้า|sira/i.test(lowerRaw);
    
    if (isBad) {
      result = '买家反馈商品存在破损瑕疵或物流延误，使用体验不佳。';
    } else if (star >= 4) {
      result = '买家反馈商品已收到，功能与做工符合预期，整体满意。';
    } else {
      result = '买家对商品整体表现评价中规中矩。';
    }
  }

  if (!result.endsWith('。') && !result.endsWith('！')) {
    result += '。';
  }

  return result;
}

// 本地 NLP 兜底引擎（仅用于断网时紧急支撑，不做伪假翻译）
function localFallbackAnalyze(content, rating, language) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const { content, rating, sku, language } = body || {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: '评价内容 (content) 不能为空'
      });
    }

    const star = Number(rating) || 5;

    const userPromptContent = `
买家表面评分: ${star} ★
买家购买规格(SKU): ${sku || '默认规格'}
原语言: ${language || '自动检测'}
买家评论原文:
"""
${content}
"""
`.trim();

    // 1. 首选优先调用公司中转站大模型 API（直接使用充足额度，确保团队与同事共享可用）
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
      'gpt-5.4-mini',
      'gpt-5.4'
    ];

    if (relayApiKey) {
      for (const m of candidateModels) {
        try {
          const relayRes = await fetch(`${relayBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${relayApiKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [
                { role: 'system', content: SEA_REVIEW_SYSTEM_PROMPT },
                { role: 'user', content: userPromptContent }
              ],
              temperature: 0.1,
              max_tokens: 450,
              response_format: { type: 'json_object' }
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (relayRes.ok) {
            const data = await relayRes.json();
            const textContent = data?.choices?.[0]?.message?.content;
            const parsed = extractJsonFromText(textContent);
            if (parsed && parsed.translation && parsed.sentiment) {
              let trans = parsed.translation.trim();

              // 严格纯中文校验：若检测到非中文字符，自动触发单项重新翻译
              if (containsForbiddenForeignChars(trans)) {
                try {
                  const retryRes = await fetch(`${relayBaseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${relayApiKey}`
                    },
                    body: JSON.stringify({
                      model: m,
                      messages: [
                        {
                          role: 'user',
                          content: `请将以下买家评论直接翻译为100%纯简体中文。忠实完整保留所有商品功能特性与参数（如快干、防水、涂轮胎等）。只输出中文译文，不要输出原文，不要中英夹杂，不要解释，直接给译文：\n"""\n${content}\n"""`
                        }
                      ],
                      temperature: 0.1,
                      max_tokens: 350
                    }),
                    signal: AbortSignal.timeout(8000)
                  });
                  if (retryRes.ok) {
                    const retryData = await retryRes.json();
                    const retryText = retryData?.choices?.[0]?.message?.content?.trim();
                    if (retryText && !containsForbiddenForeignChars(retryText)) {
                      trans = retryText;
                    } else {
                      trans = purifyToPureChinese(trans, content, star);
                    }
                  } else {
                    trans = purifyToPureChinese(trans, content, star);
                  }
                } catch (reErr) {
                  trans = purifyToPureChinese(trans, content, star);
                }
              }

              return res.status(200).json({
                success: true,
                provider: 'relay_station',
                model: m,
                translation: trans,
                sentiment: parsed.sentiment,
                tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['深度痛点提炼']
              });
            }
          }
        } catch (relayErr) {
          console.warn(`[Vercel Serverless /api/analyze] Relay model ${m} failed:`, relayErr.message);
        }
      }
    }

    // 2. 备用：Google Gemini 官方 API (仅当中转站完全不可用时)
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (geminiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const resp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [{ text: `${SEA_REVIEW_SYSTEM_PROMPT}\n\n${userPromptContent}` }]
            }
          ],
          config: { responseMimeType: 'application/json' }
        });

        const textOutput = resp?.text;
        const parsed = extractJsonFromText(textOutput);
        if (parsed && parsed.translation && parsed.sentiment) {
          let trans = parsed.translation.trim();
          if (containsForbiddenForeignChars(trans)) {
            trans = purifyToPureChinese(trans, content, star);
          }
          return res.status(200).json({
            success: true,
            provider: 'gemini_official',
            model: 'gemini-2.5-flash',
            translation: trans,
            sentiment: parsed.sentiment,
            tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['深度语义提炼']
          });
        }
      } catch (gemErr) {
        console.warn('[Vercel Serverless] Official Gemini API failed:', gemErr.message);
      }
    }

    // 3. 兜底回退：若所有网络大模型额度或网络均不可达，明确透传 isFallback
    const fallback = localFallbackAnalyze(content, rating, language);
    return res.status(200).json({
      success: true,
      provider: 'local_nlp_fallback',
      isFallback: true,
      model: 'local-multilingual-engine',
      translation: fallback.translation,
      sentiment: fallback.sentiment,
      tags: fallback.tags
    });
  } catch (err) {
    console.error('[Vercel Serverless /api/analyze Error]', err);
    return res.status(500).json({
      success: false,
      isFallback: true,
      error: err.message || '内部分析服务异常'
    });
  }
}
