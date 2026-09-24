import { StandardReview } from './index';

export interface UsageScenarioItem {
  scenario: string;
  count: number;
  percentage: number;
}

export interface FeedbackBarItem {
  text: string;
  count: number;
  percentage: number;
  subCategory?: string;
}

// 别名兼容
export type FeedbackItem = FeedbackBarItem;

export interface VariantDistributionItem {
  variant: string;
  count: number;
  percentage: number;
  color: string;
}

// 别名兼容
export type VariantRatioItem = VariantDistributionItem;

export interface SatisfactionMetric {
  positive: number;
  positivePercent: number;
  negative: number;
  negativePercent: number;
  neutral: number;
  neutralPercent: number;
}

export interface DualSatisfactionData {
  total: number;
  // 标准一：按评分星级计算 (4-5星满意，3星中立，1-2星差评)
  byStar: SatisfactionMetric;
  // 标准二：按实际内容与隐性差评校准计算 (五星隐性差评及负向文本归为不满意，纯正向归为满意)
  byContent: SatisfactionMetric;
  // 偏差指标：因为隐性差评导致实际满意率下降的百分点
  hiddenDisparityRate: number;
  hiddenCount: number;
}

export interface StarDistributionItem {
  star: number;
  count: number;
  percentage: number;
}

export interface TimelineTrendItem {
  dateKey?: string; // YYYY-MM
  label: string;
  count: number;
  positiveCount: number;
  negativeCount: number;
}

export interface DailyTimelineItem {
  date: string; // YYYY-MM-DD
  label: string; // MM-DD
  count: number;
  positiveCount: number;
  negativeCount: number;
  positiveRate: number;
  avgRating: number;
}

export interface MonthlyComboTimelineItem {
  month: string; // YYYY-MM
  label: string; // YYYY年MM月
  count: number; // 留评总量 (柱)
  positiveCount: number;
  negativeCount: number;
  positiveRate: number; // 真实好评率 % (线)
  avgRating: number; // 均星 (线)
}

export interface UnmetNeedItem {
  text: string;
  count: number;
  sourceContext?: string;
  urgency: 'high' | 'medium' | 'normal';
}

export interface ReviewTagItem {
  tag: string;
  count: number;
  type: 'positive' | 'negative' | 'neutral' | 'hidden_negative';
}

export interface ExecutiveDashboardData {
  totalCount: number;
  avgRating: number;
  // 双标准满意度
  satisfaction: DualSatisfactionData;
  positiveRate: number; // 依据实际内容标准
  negativeRate: number; // 依据实际内容标准
  hasMediaRate: number;
  hiddenNegativeCount: number;
  hiddenNegativeRate: number;
  scenarios: UsageScenarioItem[];
  variants: VariantDistributionItem[];
  positiveFeedbacks: FeedbackBarItem[];
  negativeFeedbacks: FeedbackBarItem[];
  unmetNeeds: UnmetNeedItem[];
  reviewTags: ReviewTagItem[];
  starDistribution: StarDistributionItem[];
  timelineTrends: TimelineTrendItem[];
  dailyTrends: DailyTimelineItem[];
  monthlyComboTrends: MonthlyComboTimelineItem[];
}
