import { InvalidReviewCheck, InvalidCategory } from '../types';

/**
 * 东南亚电商刷单与无效评论规则识别引擎
 * 基于 文本(Text)、图片(Image)、行为(Behavior)、评分(Rating) 四维特征模型
 * 输出：可解释的原因、置信度以及分流建议（有效 / 刷单存疑 / 凑金币无意义 / 默认好评）
 */

// 平台默认评论特征集
const DEFAULT_REVIEW_PATTERNS = [
  /^(good|ok|okay|nice|satisfy|very good|barang bagus|mantap|paket sudah sampai|received with thanks|fast delivery)$/i,
  /ได้รับสินค้าแล้ว|สินค้าดีมาก|ได้รับสินค้าเรียบร้อยแล้ว|แพ็คมาดี|จัดส่งรวดเร็ว/i,
  /đã nhận được hàng|chất lượng sản phẩm tuyệt vời|shop phục vụ tốt/i,
  /barang sesuai pesanan|terima kasih seller|pengiriman cepat/i
];

// 东南亚虾皮/Lazada凑金币特征 (长无意义文本/字符循环/灌水)
const COINS_FARMING_PATTERNS = [
  /(.)\1{6,}/, // 同一字符连续重复超过6次 (如 aaaaaaaa, 555555555)
  /เพลง|เนื้อเพลง|lirik lagu|lyric|recipe|สูตรอาหาร/i, // 粘贴歌词或菜谱
  /(ได้รับสินค้าเรียบร้อยแล้วค่ะ\s*){2,}/, // 重复粘贴固定套话
  /ยังไม่ได้ลองใช้|ซื้อให้เพื่อน|chưa dùng thử|belum dicoba/i // "还没用/买给朋友不知道"
];

// 刷单极度夸张修饰语
const SUSPECTED_FAKE_SUPERLATIVES = [
  /superb quality beyond belief|best shop on earth|perfect in every single way/i,
  /ยอดเยี่ยมที่สุดในสามโลก|ดีงามพระรามแปดจนพูดไม่ออก/i,
  /quá đỉnh cao không có gì để chê/i,
  /sangat luar biasa sempurna tiada tara/i
];

export function evaluateReviewValidity(
  content: string,
  rating: number,
  imageCount: number,
  hasVideo: boolean,
  isAnonymous: boolean,
  likesCount: number = 0
): InvalidReviewCheck {
  const trimmed = (content || '').trim();
  const reasons: string[] = [];
  let category: InvalidCategory | undefined;
  let confidence = 0;

  // 1. 纯空/纯符号/极短
  if (trimmed.length === 0) {
    return {
      isInvalid: true,
      confidence: 100,
      category: 'system_default',
      reasons: ['纯空评论或买家仅打星未留言'],
      evidenceText: '（买家未填写文字）'
    };
  }

  // 纯标点或纯表情 (长度小于4且无有效字母/汉字/泰文字符)
  const effectiveChars = trimmed.replace(/[\s\p{Emoji}\p{Punctuation}]/gu, '');
  if (effectiveChars.length <= 1) {
    return {
      isInvalid: true,
      confidence: 95,
      category: 'text_irrelevant',
      reasons: ['纯表情符号或无意义单字（如仅点赞手势/点）'],
      evidenceText: trimmed
    };
  }

  // 2. 平台默认模版评论
  for (const pat of DEFAULT_REVIEW_PATTERNS) {
    if (pat.test(trimmed) && trimmed.length < 35) {
      return {
        isInvalid: true,
        confidence: 90,
        category: 'system_default',
        reasons: ['命中平台默认好评模板或极短流水账好评（无产品实质信息）'],
        evidenceText: trimmed
      };
    }
  }

  // 3. 东南亚买家典型赚金币(Shopee Coins)灌水
  for (const pat of COINS_FARMING_PATTERNS) {
    if (pat.test(trimmed)) {
      return {
        isInvalid: true,
        confidence: 88,
        category: 'text_coins_farming',
        reasons: ['疑似买家为获取平台评价金币奖励而粘贴的灌水长文/循环字符/未拆封留言'],
        evidenceText: trimmed.slice(0, 40) + (trimmed.length > 40 ? '...' : '')
      };
    }
  }

  // 4. 刷单/水军嫌疑组合特征 (Rating 5 + 极度溢美词 + 3图以上 + 长文 + 匿名/异常)
  let fakeScore = 0;
  if (rating === 5) fakeScore += 20;
  if (trimmed.length > 90) fakeScore += 25;
  if (imageCount >= 3) fakeScore += 25;
  if (hasVideo) fakeScore += 10;
  if (isAnonymous) fakeScore += 10;

  for (const sup of SUSPECTED_FAKE_SUPERLATIVES) {
    if (sup.test(trimmed)) {
      fakeScore += 30;
      reasons.push('包含违背真实买家口吻的极端溢美夸张堆砌词');
    }
  }

  if (fakeScore >= 75) {
    reasons.push(`典型刷单特征画像：全5星满分 + ${imageCount}张图文并茂 + 超长文案赞美`);
    return {
      isInvalid: true,
      confidence: Math.min(96, fakeScore),
      category: 'rating_fake_cluster',
      reasons,
      evidenceText: trimmed.slice(0, 50) + '...'
    };
  }

  // 5. 评论内容极短且无实质评价内容（如 "ok", "krup", "555"）
  if (trimmed.length <= 4 && !/ไม่|bad|rua|hỏng|chậm/i.test(trimmed)) {
    return {
      isInvalid: true,
      confidence: 75,
      category: 'text_template',
      reasons: ['超短敷衍评价，无法提取有效商品与体验维度'],
      evidenceText: trimmed
    };
  }

  // 有效评论
  return {
    isInvalid: false,
    confidence: 10,
    reasons: []
  };
}

/**
 * 规则说明字典，供前端规则配置器与落地方案书呈现
 */
export const INVALID_RULES_SPEC = [
  {
    id: 'R-TXT-01',
    category: '文本特征',
    name: '纯符号与空白过滤',
    trigger: '内容为空或去除表情/标点后字符数 ≤ 1',
    threshold: '字符长度 ≤ 1',
    action: '打标分流至 [无意义噪音]',
    impact: '剔除无法提供信息价值的占位评论'
  },
  {
    id: 'R-TXT-02',
    category: '文本特征',
    name: '平台系统默认好评识别',
    trigger: '完全匹配Shopee/Lazada预设快捷评价（如“Barang bagus”、“สินค้าดีมาก”）且无附加描述',
    threshold: '长度 < 35 字符且命中模版库',
    action: '打标分流至 [系统默认好评]',
    impact: '防止通篇默认好评掩盖真实产品体验'
  },
  {
    id: 'R-TXT-03',
    category: '文本特征',
    name: 'Shopee Coins 赚金币灌水识别',
    trigger: '买家为了凑50字赚取平台虾币/奖励币，粘贴连续字符(aaaaa)或菜谱/歌词/未拆封说明',
    threshold: '同字符重复 ≥ 6 或命中灌水特征词库',
    action: '打标分流至 [金币灌水评]',
    impact: '东南亚特有文化噪音，必须剔除避免干扰真实词频'
  },
  {
    id: 'R-IMG-01',
    category: '图片特征',
    name: '非买家秀及凑图识别',
    trigger: '纯黑背景图、地板随手拍，或与商品完全无关的截图',
    threshold: '图片特征异常/凑图',
    action: '扣减图片有效性权重',
    impact: '真实买家秀占比才是Listing优化的黄金素材'
  },
  {
    id: 'R-BRS-01',
    category: '综合特征',
    name: '全五星豪华好评刷单特征画像',
    trigger: 'Rating=5 + 评论字数 > 90 + 配图 ≥ 3张 + 带有极端溢美修饰词 + 匿名买家',
    threshold: '刷单风险评分 ≥ 75',
    action: '打标分流至 [刷单存疑池]',
    impact: '将中介/刷单好评与真实自来水好评剥离，还原真实转化率'
  }
];
