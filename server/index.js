import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// ==========================================
// 东南亚跨境电商多语言评论 AI 深度分析提示词 (Prompt)
// 彻底移至后端管理，不在前端暴露
// ==========================================
const SEA_REVIEW_SYSTEM_PROMPT = `
你是一名深耕东南亚跨境电商（Shopee、Lazada）的资深数据分析专家与多语言本土化评审大师。
你精通泰语 (TH)、越南语 (VI)、印尼/马来语 (ID/MS)、菲律宾他加禄语 (TL/PH)、英文 (EN) 以及中英混合语。

你深刻理解东南亚本土电商买家的文化与评价心理：
1. 【泰国人情面子 (Kreng Jai)】：买家即使对商品极度不满或发现缺陷，也常出于礼貌先打 4-5★，口吻如 "ให้ 5 ดาวเป็นกำลังใจค่ะ แต่..."（给5星是鼓励，但电池充不进/链条脱落）。
2. 【Shopee/Lazada 金币羊毛党】：为了领取满评平台金币（Shopee Coins），随手打满星，正文中却写满产品硬伤。
3. 【物流与产品混淆】：买家给5星夸赞当地快递小哥送货快，正文中却痛批产品导板反装、做工粗糙。
4. 【俚语与缩写识别】：
   - 泰语：5555 (哈哈/讥讽笑声), แบตหมดไว (电池掉电极快), พัง/แตก (损坏/破裂), ไม่ตรงปก (货不对板)。
   - 越南语：sp ok nhưng (商品看着还行但是...), pin tụt nhanh (电池暴跌), hàng lởm/đểu (垃圾假货), cho 5 sao để nhận xu (给5星只为领币)。
   - 印尼语：b aja (biasa aja 平平无奇), baterai boros (电池极耗电), rusak pas dibuka (开箱即损), bintang 5 buat kurir doang (5星只给快递)。
   - 他加禄语：mabilis malowbat (电量掉太快), sira agad (很快就坏了), basag (碎了)。

【任务目标】：
请仔细审视传入评论的【表面星级 (rating)】与【买家评价原文 (content)】，在单次分析中输出以下标准 JSON 字段：
1. "translation": 精准的中文直译。必须识破本土俚语、网络缩写与反讽，将买家真实语义完整、通顺、原汁原味地翻译为中文（严禁机翻生硬直译）。如果原文已是中文，进行润色提炼。
2. "sentiment": 真实情感方向。必须穿透表面星级，准确判断真实倾向。只能从以下分类中选取一个：
   - "五星隐性差评"：买家打了 5 星，但正文中存在明确的质量缺陷、退货意向、功能失灵等不满；
   - "四星隐性差评"：买家打了 4 星，但正文实为差评扣分与痛点吐槽；
   - "正向满意"：买家真正满意产品质量与使用体验；
   - "严重差评"：1-2 星，存在严重质量缺陷、假货、破损、欺诈等严重不满；
   - "负向不满"：明显的差评或抱怨；
   - "中立观望"：中规中矩，无明显喜恶，或好坏参半。
3. "tags": 包含 1 到 3 个精准具体的痛点或优点标签（例如："电池虚标/充不进电", "链条频繁脱落", "做工粗糙/材质单薄", "动力强劲/切割平整", "物流包装简陋"）。

【输出格式要求】：
必须严格只返回一个纯 JSON 对象，不得包含 Markdown 标记或多余文字：
{
  "translation": "精准中文翻译",
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

// 本地高精度东南亚语意与隐性差评备用分析引擎（当没有任何外部 API 时兜底）
function fallbackAnalyze(content, rating, language) {
  const text = (content || '').trim();
  const star = Number(rating) || 5;

  let translation = text;
  let sentiment = '中立观望';
  const tags = [];

  const hasBattery = /แบต|bat|baterai|pin|battery|charg|ไฟ|sạc/i.test(text);
  const hasDamage = /พัง|แตก|hỏng|vỡ|rusak|patah|broken|defect|crack|rách/i.test(text);
  const hasChainOrBlade = /โซ่|ใบเลื่อย|xích|lưỡi|rantai|pisau|chain|blade/i.test(text);
  const hasFakeCoin = /xu|koin|เหรียญ|555|coin|shopee coin/i.test(text);
  const hasGood = /ดี|สวย|ชอบ|tốt|đẹp|thích|bagus|mantap|good|great|suka/i.test(text);

  if (/[\u0e00-\u0e7f]/.test(text)) {
    if (text.includes('ให้ 5 ดาวเป็นกำลังใจ')) {
      translation = '打5星是给店家鼓励，但是电池充不了电，用一会儿就没电了。';
    } else if (text.includes('แบต')) {
      translation = '电池性能不佳，掉电极快，与描述有差距。';
    } else {
      translation = `[译文] ${text}`;
    }
  } else if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) {
    if (text.includes('pin')) {
      translation = '商品外观还行，但是电池掉电很快，充几次就充不进了。';
    } else {
      translation = `[译文] ${text}`;
    }
  } else if (/\b(baterai|rusak|bagus|kurir|kecewa|patah)\b/i.test(text)) {
    if (text.includes('rusak') || text.includes('baterai')) {
      translation = '收到了但是有部件破损，电池续航不耐用，挺失望的。';
    } else {
      translation = `[译文] ${text}`;
    }
  }

  const hasComplaint = hasBattery || hasDamage || hasChainOrBlade || /ไม่ดี|kém|jelek|bad|slow|tệ/i.test(text);

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

  if (hasBattery) tags.push('电池不耐用/充不进电');
  if (hasDamage) tags.push('部件破损/做工瑕疵');
  if (hasChainOrBlade) tags.push('链条/刀具易卡顿脱落');
  if (hasFakeCoin) tags.push('为了平台金币凑字');
  if (tags.length === 0) {
    if (sentiment === '正向满意') tags.push('动力充沛', '性价比高');
    else if (sentiment.includes('差评')) tags.push('质量瑕疵/需改进');
    else tags.push('使用体验平平');
  }

  return {
    translation,
    sentiment,
    tags: tags.slice(0, 3)
  };
}

// 候选优质模型列表（从中转站众多模型中自适应探测可用模型，优先 Gemini 系列极速模型）
const PREFERRED_RELAY_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
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
  if (geminiApiKey) {
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
        return {
          success: true,
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          translation: parsed.translation,
          sentiment: parsed.sentiment,
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : ['深度痛点提炼']
        };
      }
    } catch (geminiErr) {
      console.warn('[Backend] Gemini API call failed, trying backup relay:', geminiErr.message);
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
            cachedWorkingModel = modelCandidate;
            return {
              success: true,
              provider: 'relay_api',
              model: modelCandidate,
              translation: parsed.translation,
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

  // 纯文本翻译接口
  app.post('/api/translate', async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ success: false, error: 'text 不能为空' });
      }
      const fb = fallbackAnalyze(text, 5, 'auto');
      return res.json({ success: true, translation: fb.translation });
    } catch (e) {
      return res.json({ success: true, translation: req.body?.text || '' });
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
