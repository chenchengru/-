import { StandardReview } from '../types';
import { 
  ExecutiveDashboardData, 
  DualSatisfactionData, 
  FeedbackItem, 
  UnmetNeedItem, 
  ReviewTagItem, 
  TimelineTrendItem, 
  DailyTimelineItem,
  MonthlyComboTimelineItem,
  StarDistributionItem,
  VariantRatioItem
} from '../types/dashboard';

// 正向高频关键词规则
const POSITIVE_PATTERNS: { text: string; pattern: RegExp }[] = [
  { text: '轻巧便携/单手操作握持好', pattern: /น้ำหนักเบา|ถือได้ง่าย|ผู้หญิงก็ใช้ได้|เบาดี|ringan|lightweight|easy to hold/i },
  { text: '材质结实耐用/经久抗造', pattern: /ทนทาน|ยาวนาน|ซีดจาง|อึดมาก|แข็งแรง|awet|tahan lama|durable/i },
  { text: '电池续航持久/工作效率高', pattern: /แบตเตอรี่.*อึด|ใช้งานได้นาน|ชาร์จเร็ว|baterai awet|fast charge|long battery/i },
  { text: '安装简易/上手调试快捷', pattern: /ติดตั้งง่าย|ใช้งานง่าย|ควบคุมได้สะดวก|mudah dipasang|easy to install/i },
  { text: '锯切顺滑锋利/切割精准', pattern: /ตัดได้แม่นยำ|ตัดคม|ตัดง่าย|smooth cut|sharp/i },
  { text: '发货极速/物流配送及时', pattern: /ส่งไว|ส่งเร็ว|发货快|物流快|速度快|cepat|giao nhanh|fast delivery/i },
  { text: '包装加固严实无破损', pattern: /แพ็คดี|ห่อดี|包装严实|包装好|完好|packing rapi|packing aman|well packed/i },
  { text: '性价比超高/物超所值', pattern: /คุ้มค่า|คุ้มราคา|性价比|划算|超值|murah|worth|value for money/i },
  { text: '客服沟通礼貌/售后负责', pattern: /บริการดี|ตอบแชทไว|แอดมิน|รับผิดชอบสูง|เอาใจใส่|客服好|态度好|ramah|good service/i }
];

// 负向风险词根库（排除 แตกต่าง[不同] 等词汇误判，增加工具机械专业痛点）
const NEGATIVE_PATTERNS: { text: string; pattern: RegExp }[] = [
  { text: '电池无法充电/续航极短/BMS保护板故障', pattern: /bms|ชาร์จไม่เข้า|แบตหมดไว|แบตเตอรี่.*(?:พัง|เสีย)|กระตุ้นแบต/i },
  { text: '锯切作业中链条易松动脱落', pattern: /โซ่หลุด|โซ่หย่อน|โซ่ตก|rantai lepas|chain comes off/i },
  { text: '外壳固定塑料结构件脆裂', pattern: /หางปลา.*หัก|พลาสติก.*หัก|ฝาครอบ.*หัก|ตัวล็อคหัก/i },
  { text: '外包装箱被压瘪破损凹陷', pattern: /กล่องบุบ|กล่องแตก|ของแตก|สินค้าแตก|แตกหัก|แตกชำรุด|破损|压烂|凹陷|hancur|penyok|pecah/i },
  { text: '实物尺寸/导板比预期偏小', pattern: /ขนาดเล็กกว่าที่คิด|ใบเลื่อยเล็ก|เล็กกว่าที่คิดมาก/i },
  { text: '跨境物流漫长/等待焦躁', pattern: /ส่งช้ามาก|รอนานมาก|发货慢|物流慢|清关慢|lama|lambat/i },
  { text: '实物颜色与主图有偏差/货不对板', pattern: /สีไม่ตรง|ไม่เหมือน|色差|不符|货不对板|beda warna/i },
  { text: '仓库漏发配件/少发链条或电池', pattern: /ส่งผิด|ขาด|少件|漏发|发错|salah kirim|missing/i },
  { text: '质量瑕疵/使用不久即故障', pattern: /ใช้ไม่ได้|พัง|坏了|不能用|故障|tidak bisa|broken|defective/i },
  { text: '售后客服答复迟缓不理人', pattern: /ไม่ตอบ|客服慢|不理人|态度差|slow reply/i }
];

// 核心标签统一定义库（支持双向双看板精确联动，杜绝点击后0匹配）
export interface TagDefinition {
  tag: string;
  type: 'positive' | 'negative' | 'hidden_negative';
  matcher: (r: StandardReview) => boolean;
}

export const TAG_DEFINITIONS: TagDefinition[] = [
  {
    tag: '电池耐用超长续航',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /แบต|ชาร์จ|bms|baterai|battery|电池|续航|充电/i.test(text) && !/充不进|不充电|坏|เสื่อม|หมดไว/i.test(text);
    }
  },
  {
    tag: '自重轻巧女用顺手',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /น้ำหนักเบา|เบาดี|ถือได้ง่าย|ผู้หญิง|ringan|lightweight|轻巧|轻便|便携|单手/i.test(text);
    }
  },
  {
    tag: '切割顺滑锋利',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /ตัดคม|ตัดแม่นยำ|ตัดง่าย|คมมาก|sharp|tajam|锋利|顺滑|好切|切割/i.test(text);
    }
  },
  {
    tag: '安装简易上手快',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /ติดตั้งง่าย|ใช้งานง่าย|mudah|easy|好用|简单|易安装|上手快/i.test(text);
    }
  },
  {
    tag: '性价比之王',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /คุ้มค่า|คุ้มราคา|คุ้ม|worth|murah|划算|超值|性价比|物超所值/i.test(text);
    }
  },
  {
    tag: '发货神速物流给力',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /ส่งไว|ส่งเร็ว|เร็วมาก|cepat|fast|快速|神速|发货快|物流快/i.test(text);
    }
  },
  {
    tag: '包装加固防护好',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /แพ็คดี|ห่อดี|严实|防震|packing|包装好|包得好/i.test(text);
    }
  },
  {
    tag: '售后客服负责贴心',
    type: 'positive',
    matcher: (r) => {
      if (r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative) return false;
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      return /เอาใจใส่|รับผิดชอบ|บริการดี|แอดมิน|客服|售后|态度/i.test(text);
    }
  },
  {
    tag: '痛点: 电池充不进电/BMS故障',
    type: 'negative',
    matcher: (r) => {
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => /电池|充电|bms/i.test(g));
      return inGrievances || /bms|ชาร์จไม่เข้า|แบตหมดไว|แบตเสีย|แบตเตอรี่.*(?:พัง|เสีย)|充不进|不充电|电池坏/i.test(text);
    }
  },
  {
    tag: '痛点: 链条频繁脱落松动',
    type: 'negative',
    matcher: (r) => {
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => /链条|松动/i.test(g));
      return inGrievances || /โซ่หลุด|โซ่หย่อน|โซ่ตก|rantai lepas|chain comes off|链条掉|链条脱落|松动/i.test(text);
    }
  },
  {
    tag: '痛点: 固定塑料件脆裂',
    type: 'negative',
    matcher: (r) => {
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => /塑料|断裂|结构件/i.test(g));
      return inGrievances || /หางปลา.*หัก|พลาสติก.*หัก|ฝาครอบ.*หัก|ตัวล็อคหัก|塑料.*裂|断裂|脆/i.test(text);
    }
  },
  {
    tag: '痛点: 外箱挤压破损',
    type: 'negative',
    matcher: (r) => {
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => /包装|外箱|破损/i.test(g));
      return inGrievances || /กล่องบุบ|กล่องแตก|箱子破|盒子扁|凹陷|压坏|压瘪|penyok|pecah/i.test(text);
    }
  },
  {
    tag: '痛点: 实物尺寸比预期偏小',
    type: 'negative',
    matcher: (r) => {
      const text = `${r.content} ${r.contentZh || ''}`.toLowerCase();
      const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => /尺寸|偏小|导板/i.test(g));
      return inGrievances || /ขนาดเล็กกว่าที่คิด|ใบเลื่อยเล็ก|偏小|太小/i.test(text);
    }
  },
  {
    tag: '特有: 五星鼓励隐性差评',
    type: 'hidden_negative',
    matcher: (r) => {
      return r.hiddenNegativeCheck.isHiddenNegative;
    }
  }
];

// 核心标签精确匹配判断函数（供外部看板全局联动调用）
export function matchReviewWithTag(r: StandardReview, tagName: string): boolean {
  if (!tagName) return true;
  const def = TAG_DEFINITIONS.find(d => d.tag === tagName);
  if (def) {
    return def.matcher(r);
  }
  // 兜底通用匹配
  const cleanTag = tagName.replace(/^痛点:\s*/, '').replace(/^特有:\s*/, '');
  const inTopics = r.topics.some(t => t.includes(cleanTag));
  const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => g.includes(cleanTag));
  const inContent = (r.contentZh || r.content).includes(cleanTag);
  return inTopics || inGrievances || inContent;
}

// 日期解析工具
function extractDateInfo(timeStr?: string): { day: string; month: string; dayLabel: string; monthLabel: string } | null {
  if (!timeStr) return null;
  const str = timeStr.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  const m1 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const m = m1[2].padStart(2, '0');
    const d = m1[3].padStart(2, '0');
    return {
      day: `${y}-${m}-${d}`,
      month: `${y}-${m}`,
      dayLabel: `${m}-${d}`,
      monthLabel: `${y}年${m}月`
    };
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const m2 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m2) {
    const d = m2[1].padStart(2, '0');
    const m = m2[2].padStart(2, '0');
    const y = m2[3];
    return {
      day: `${y}-${m}-${d}`,
      month: `${y}-${m}`,
      dayLabel: `${m}-${d}`,
      monthLabel: `${y}年${m}月`
    };
  }

  // YYYY-MM
  const m3 = str.match(/^(\d{4})[-/.](\d{1,2})/);
  if (m3) {
    const y = m3[1];
    const m = m3[2].padStart(2, '0');
    return {
      day: `${y}-${m}-01`,
      month: `${y}-${m}`,
      dayLabel: `${m}-01`,
      monthLabel: `${y}年${m}月`
    };
  }

  return null;
}

export function extractExecutiveDashboardData(reviews: StandardReview[]): ExecutiveDashboardData {
  const totalCount = reviews.length;
  if (totalCount === 0) {
    const emptySatisfaction: DualSatisfactionData = {
      total: 0,
      byStar: { positive: 0, positivePercent: 0, negative: 0, negativePercent: 0, neutral: 0, neutralPercent: 0 },
      byContent: { positive: 0, positivePercent: 0, negative: 0, negativePercent: 0, neutral: 0, neutralPercent: 0 },
      hiddenDisparityRate: 0,
      hiddenCount: 0
    };
    return {
      totalCount: 0,
      avgRating: 0,
      satisfaction: emptySatisfaction,
      positiveRate: 0,
      negativeRate: 0,
      hasMediaRate: 0,
      hiddenNegativeCount: 0,
      hiddenNegativeRate: 0,
      scenarios: [],
      positiveFeedbacks: [],
      negativeFeedbacks: [],
      variants: [],
      starDistribution: [],
      unmetNeeds: [],
      reviewTags: [],
      timelineTrends: [],
      dailyTrends: [],
      monthlyComboTrends: []
    };
  }

  // 1. 满意度双重算法测算
  let starPosCount = 0;
  let starNegCount = 0;
  let starNeuCount = 0;

  let contentPosCount = 0;
  let contentNegCount = 0;
  let contentNeuCount = 0;

  let hiddenCount = 0;
  let sumRating = 0;
  let mediaCount = 0;

  const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const variantCounts: Record<string, number> = {};
  
  // 日期统计桶
  const dayBuckets: Record<string, { count: number; pos: number; neg: number; sumRating: number; dayLabel: string }> = {};
  const monthBuckets: Record<string, { count: number; pos: number; neg: number; sumRating: number; monthLabel: string }> = {};

  reviews.forEach(r => {
    sumRating += r.rating;
    if (r.imageCount > 0 || (r.imageUrls && r.imageUrls.length > 0) || r.hasVideo) {
      mediaCount++;
    }

    starCounts[r.rating] = (starCounts[r.rating] || 0) + 1;

    // 算法1：按表面星级
    if (r.rating >= 4) {
      starPosCount++;
    } else if (r.rating <= 2) {
      starNegCount++;
    } else {
      starNeuCount++;
    }

    // 算法2：按实际内容测算
    const isHidden = r.hiddenNegativeCheck.isHiddenNegative;
    let isPositiveContent = false;
    let isNegativeContent = false;

    if (isHidden) {
      hiddenCount++;
      contentNegCount++;
      isNegativeContent = true;
    } else if (r.hiddenNegativeCheck.realSentiment === 'positive') {
      contentPosCount++;
      isPositiveContent = true;
    } else if (r.hiddenNegativeCheck.realSentiment === 'negative') {
      contentNegCount++;
      isNegativeContent = true;
    } else {
      contentNeuCount++;
    }

    // 变体统计
    const vKey = (r.sku && r.sku.trim()) || '默认规格';
    variantCounts[vKey] = (variantCounts[vKey] || 0) + 1;

    // 日期时间聚合统计
    const dateInfo = extractDateInfo(r.reviewTime);
    if (dateInfo) {
      // 日统计
      if (!dayBuckets[dateInfo.day]) {
        dayBuckets[dateInfo.day] = { count: 0, pos: 0, neg: 0, sumRating: 0, dayLabel: dateInfo.dayLabel };
      }
      dayBuckets[dateInfo.day].count++;
      dayBuckets[dateInfo.day].sumRating += r.rating;
      if (isPositiveContent) dayBuckets[dateInfo.day].pos++;
      if (isNegativeContent) dayBuckets[dateInfo.day].neg++;

      // 月统计
      if (!monthBuckets[dateInfo.month]) {
        monthBuckets[dateInfo.month] = { count: 0, pos: 0, neg: 0, sumRating: 0, monthLabel: dateInfo.monthLabel };
      }
      monthBuckets[dateInfo.month].count++;
      monthBuckets[dateInfo.month].sumRating += r.rating;
      if (isPositiveContent) monthBuckets[dateInfo.month].pos++;
      if (isNegativeContent) monthBuckets[dateInfo.month].neg++;
    }
  });

  const starPosPct = Math.round((starPosCount / totalCount) * 100);
  const starNegPct = Math.round((starNegCount / totalCount) * 100);
  const starNeuPct = Math.max(0, 100 - starPosPct - starNegPct);

  const contentPosPct = Math.round((contentPosCount / totalCount) * 100);
  const contentNegPct = Math.round((contentNegCount / totalCount) * 100);
  const contentNeuPct = Math.max(0, 100 - contentPosPct - contentNegPct);

  const hiddenDisparityRate = Math.max(0, starPosPct - contentPosPct);

  const satisfaction: DualSatisfactionData = {
    total: totalCount,
    byStar: {
      positive: starPosCount,
      positivePercent: starPosPct,
      negative: starNegCount,
      negativePercent: starNegPct,
      neutral: starNeuCount,
      neutralPercent: starNeuPct
    },
    byContent: {
      positive: contentPosCount,
      positivePercent: contentPosPct,
      negative: contentNegCount,
      negativePercent: contentNegPct,
      neutral: contentNeuCount,
      neutralPercent: contentNeuPct
    },
    hiddenDisparityRate,
    hiddenCount
  };

  // 2. 正反馈与负反馈高频统计
  const posCounts: Record<string, number> = {};
  const negCounts: Record<string, number> = {};

  POSITIVE_PATTERNS.forEach(p => { posCounts[p.text] = 0; });
  NEGATIVE_PATTERNS.forEach(p => { negCounts[p.text] = 0; });

  reviews.forEach(r => {
    const isGood = r.rating >= 4 && !r.hiddenNegativeCheck.isHiddenNegative;
    const isBad = r.rating <= 2 || r.hiddenNegativeCheck.isHiddenNegative;

    if (isGood) {
      POSITIVE_PATTERNS.forEach(p => {
        if (p.pattern.test(r.content) || (r.contentZh && p.pattern.test(r.contentZh))) {
          posCounts[p.text] = (posCounts[p.text] || 0) + 1;
        }
      });
    }

    if (isBad) {
      NEGATIVE_PATTERNS.forEach(p => {
        if (p.pattern.test(r.content) || (r.contentZh && p.pattern.test(r.contentZh))) {
          negCounts[p.text] = (negCounts[p.text] || 0) + 1;
        }
      });
    }

    // 统计自提炼的具体痛点
    if (r.hiddenNegativeCheck.extractedGrievances.length > 0) {
      r.hiddenNegativeCheck.extractedGrievances.forEach(g => {
        negCounts[g] = (negCounts[g] || 0) + 1;
      });
    }
  });

  const positiveFeedbacks: FeedbackItem[] = Object.entries(posCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({
      text,
      count,
      percentage: Math.round((count / totalCount) * 100)
    }));

  const negativeFeedbacks: FeedbackItem[] = Object.entries(negCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({
      text,
      count,
      percentage: Math.round((count / totalCount) * 100)
    }));

  // 3. 变体分布
  const variantColors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#64748b'];
  const variants: VariantRatioItem[] = Object.entries(variantCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([variant, count], idx) => ({
      variant,
      count,
      percentage: Math.round((count / totalCount) * 100),
      color: variantColors[idx % variantColors.length]
    }));

  // 4. 星级真实分布
  const starDistribution: StarDistributionItem[] = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: starCounts[star] || 0,
    percentage: Math.round(((starCounts[star] || 0) / totalCount) * 100)
  }));

  // 5. 未被满足的需求与改进空间 (纯中文提炼)
  const unmetNeeds: UnmetNeedItem[] = [];

  if (negCounts['电池无法充电/续航极短/BMS保护板故障'] > 0) {
    unmetNeeds.push({
      text: '电池与BMS品质升级：买家反馈电池充不进电或单块电池极快耗尽，建议向电芯厂索要真实循环测试报告并升级BMS过流保护板。',
      count: negCounts['电池无法充电/续航极短/BMS保护板故障'],
      sourceContext: '电池与电芯供应链质检',
      urgency: 'high'
    });
  }

  if (negCounts['锯切作业中链条易松动脱落'] > 0) {
    unmetNeeds.push({
      text: '导板链条张紧结构优化：买家多次提及锯切时链条易松动滑脱，建议在主图第2张增加【链条张紧与防脱操作图解】，并附赠备用紧固螺丝。',
      count: negCounts['锯切作业中链条易松动脱落'],
      sourceContext: '产品机械结构与详情页说明',
      urgency: 'high'
    });
  }

  if (negCounts['外壳固定塑料结构件脆裂'] > 0) {
    unmetNeeds.push({
      text: '防护罩结构件材质强化：买家反馈固定塑料扣仅使用1天即折断，建议开模升级为加厚耐摔工程塑料或尼龙材质。',
      count: negCounts['外壳固定塑料结构件脆裂'],
      sourceContext: '模具与注塑用料改善',
      urgency: 'high'
    });
  }

  if (negCounts['外包装箱被压瘪破损凹陷'] > 0) {
    unmetNeeds.push({
      text: '外包装抗震加固：长途海运与本土快递颠簸易致损，建议采用高密度气泡柱或硬质手提箱包装。',
      count: negCounts['外包装箱被压瘪破损凹陷'],
      sourceContext: '包装包材与物流防护',
      urgency: 'medium'
    });
  }

  if (negCounts['实物尺寸/导板比预期偏小'] > 0) {
    unmetNeeds.push({
      text: '尺寸参照物视觉规范：部分买家对导板尺寸缺乏概念，建议在Listing主图补充真实成人手持或砍树实景对比。',
      count: negCounts['实物尺寸/导板比预期偏小'],
      sourceContext: 'Listing 主图视觉呈现',
      urgency: 'medium'
    });
  }

  if (unmetNeeds.length === 0) {
    unmetNeeds.push({
      text: '长效品质监控：当前批次评价整体较为稳定，建议持续观察买家在长期使用后对配件耐磨度的反馈。',
      count: 1,
      sourceContext: '日常品控巡检',
      urgency: 'normal'
    });
  }

  // 6. 智能评论标签（严格基于统一特征规则库，保证展示数量与筛选匹配 100% 对应）
  const reviewTags: ReviewTagItem[] = TAG_DEFINITIONS.map(def => {
    const matchCount = reviews.filter(def.matcher).length;
    return {
      tag: def.tag,
      count: matchCount,
      type: def.type
    };
  }).filter(t => t.count > 0);

  // 7. 留评时间趋势按月聚合与按日聚合
  // 按日折线图数据
  const dailyTrends: DailyTimelineItem[] = Object.entries(dayBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30) // 取最近 30 个有留评的日期
    .map(([date, val]) => ({
      date,
      label: val.dayLabel,
      count: val.count,
      positiveCount: val.pos,
      negativeCount: val.neg,
      positiveRate: val.count > 0 ? Math.round((val.pos / val.count) * 100) : 0,
      avgRating: val.count > 0 ? Number((val.sumRating / val.count).toFixed(1)) : 5
    }));

  // 按月柱状图+折线图组合数据
  const monthlyComboTrends: MonthlyComboTimelineItem[] = Object.entries(monthBuckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12) // 最近 12 个月
    .map(([month, val]) => ({
      month,
      label: val.monthLabel,
      count: val.count,
      positiveCount: val.pos,
      negativeCount: val.neg,
      positiveRate: val.count > 0 ? Math.round((val.pos / val.count) * 100) : 0,
      avgRating: val.count > 0 ? Number((val.sumRating / val.count).toFixed(2)) : 5
    }));

  // 兼容老字段
  const timelineTrends: TimelineTrendItem[] = monthlyComboTrends.map(m => ({
    label: m.month,
    count: m.count,
    positiveCount: m.positiveCount,
    negativeCount: m.negativeCount
  }));

  const avgRating = Number((sumRating / totalCount).toFixed(2));
  const hasMediaRate = Math.round((mediaCount / totalCount) * 100);

  return {
    totalCount,
    avgRating,
    satisfaction,
    positiveRate: contentPosPct,
    negativeRate: contentNegPct,
    hasMediaRate,
    hiddenNegativeCount: hiddenCount,
    hiddenNegativeRate: totalCount > 0 ? Math.round((hiddenCount / totalCount) * 100) : 0,
    scenarios: [],
    positiveFeedbacks,
    negativeFeedbacks,
    variants,
    starDistribution,
    unmetNeeds,
    reviewTags,
    timelineTrends,
    dailyTrends,
    monthlyComboTrends
  };
}

