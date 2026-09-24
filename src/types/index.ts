/**
 * Data structures for SEA Cross-Border E-Commerce Review Analysis Tool
 */

export type SEAPlatform = 'shopee' | 'lazada' | 'custom';

export type SupportedLanguage = 'th' | 'vi' | 'id' | 'ph' | 'my' | 'zh' | 'en' | 'mixed';

export type InvalidCategory = 
  | 'text_template'      // 文本模板化/极度夸张
  | 'text_irrelevant'    // 凑字数/歌词/与商品无关
  | 'text_coins_farming' // 东南亚典型赚金币/虾币废话
  | 'img_studio_fake'    // 棚拍精修非买家秀
  | 'img_black_irrelevant' // 纯黑/纯乱拍地板凑图
  | 'behavior_burst'     // 短期集中爆发
  | 'behavior_duplicate' // 同买家跨评价雷同
  | 'rating_fake_cluster' // 全5星+多精美图+长文赞美典型刷单画像
  | 'system_default';    // 系统默认评价

export interface InvalidReviewCheck {
  isInvalid: boolean;
  confidence: number; // 0 - 100
  category?: InvalidCategory;
  reasons: string[];
  evidenceText?: string;
}

export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

export interface HiddenNegativeCheck {
  isHiddenNegative: boolean; // 是否属于五星差评/四星差评
  severity: 'low' | 'medium' | 'high';
  realSentiment: ReviewSentiment;
  surfaceRating: number;
  extractedGrievances: string[]; // 具体隐性不满点 (如"电池充不进电", "链条频繁脱落")
  primaryCategory: string; // 归属主题
  businessImpact: string; // 对商家的实质影响
}

export interface StandardReview {
  id: string;
  platform: SEAPlatform;
  rating: number; // 1-5
  content: string; // 原文
  contentZh: string; // 中文释义或完整翻译
  sku: string;
  buyerName: string;
  reviewTime: string;
  likesCount: number;
  imageCount: number;
  imageUrls?: string[]; // 提取到的图片链接列表
  hasVideo: boolean;
  sellerReply?: string;
  isAnonymous: boolean;
  isRepeatBuyer: boolean;
  // 识别标签
  language: SupportedLanguage;
  languageLabel: string;
  invalidCheck: InvalidReviewCheck;
  hiddenNegativeCheck: HiddenNegativeCheck;
  topics: string[]; // 涉及主题：质量、尺寸、物流、包装等
  keyPhrases: string[]; // 提炼关键词根
  itemType?: 'our_product' | 'competitor_product'; // 本品或竞品
  rawRow?: Record<string, any>; // 保留原始行字段以便表格穿透查看
}

export interface ScenarioInsights {
  productCategory: 'tools_hardware' | 'apparel_fashion' | 'digital_3c' | 'home_living' | 'general';
  selectionSignals: {
    highFrequencyDemands: { keyword: string; count: number; sentimentScore: number; suggestion: string }[];
    unmetNeeds: { need: string; mentionRate: string; solution: string }[];
    skuPreferenceDiff: { sku: string; positiveRatio: number; complaintPoint: string }[];
    riskWarnings: string[];
  };
  listingSignals: {
    authenticBuyerKeywords: { original: string; zh: string; usageScenario: string; targetPosition: 'title' | 'bullet' | 'search_terms' }[];
    valueClaimsAudit: { claim: string; customerPerception: 'verified' | 'exaggerated' | 'neutral'; buyerVoice: string }[];
    imageGuidance: { advice: string; reason: string }[];
    specCorrections: string[]; // 规格与防踩坑修正建议（根据品类自动适配）
  };
  competitorSignals: {
    benchmarkingRole: 'competitor_weakness' | 'self_diagnostic';
    ourAdvantages: { theme: string; netScore: number; remark: string }[];
    competitorWeaknesses: { theme: string; failurePoint: string; counterStrategy: string }[];
    painPointOverlap: { theme: string; overlapDegree: 'high' | 'medium' | 'low'; details: string }[];
    priceSensitivity: string;
  };
}

export interface DatasetSummary {
  totalCount: number;
  validCount: number;
  invalidCount: number;
  suspectedFakeCount: number;
  coinsFarmingCount: number;
  hiddenNegativeCount: number; // 五星/四星差评数
  avgRating: number;
  realSatisfactionScore: number; // 扣除虚假好评与五星差评后的真实满意度(0-100)
}
