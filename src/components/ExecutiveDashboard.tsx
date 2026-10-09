import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown, 
  ChevronUp, Star, Sparkles, Filter, Eye, Calendar, Layers, 
  Tag, ShieldAlert, Upload, FileSpreadsheet, History, Clock, Trash2, X,
  Info, ExternalLink, HelpCircle, ArrowRight, ShieldCheck, Check,
  ImageIcon, ShieldX, SlidersHorizontal, Download, Maximize2, PieChart, ChevronRight,
  Share2, Copy, BarChart3, TrendingUp, FileText, Zap, MessageSquare, ArrowUpDown
} from 'lucide-react';
import { StandardReview, DatasetSummary } from '../types';
import { extractExecutiveDashboardData, matchReviewWithTag } from '../utils/dashboardExtractor';
import { DatasetRecord } from '../utils/datasetStorage';
import { 
  translateWithGoogleApi, 
  translateToChinese, 
  cacheAiTranslationResult,
  containsForbiddenForeignChars,
  purifyToPureChinese
} from '../utils/translator';
import { analyzeReviewWithBackend } from '../utils/reviewAnalyzer';
import { SEA_SLANG_DICTIONARY } from '../utils/languageDetector';
import { parseRawRowToStandard, autoDetectFieldMapping } from '../utils/fileParser';
import * as XLSX from 'xlsx';

interface ExecutiveDashboardProps {
  reviews: StandardReview[];
  setReviews: React.Dispatch<React.SetStateAction<StandardReview[]>>;
  currentFileName: string;
  importTime: string;
  historyList: DatasetRecord[];
  onSelectHistory: (record: DatasetRecord) => void;
  onDeleteHistory: (id: string) => void;
  onProcessFile: (file: File) => Promise<void>;
  onNavigateToHiddenNegatives?: () => void;
  theme?: 'dark' | 'light';
}

export interface ZoomedRingModalData {
  chartTitle: string;
  chartType: 'star_satisfaction' | 'content_satisfaction' | 'variant_distribution';
  activeDimensionKey: string;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  reviews,
  setReviews,
  currentFileName,
  importTime,
  historyList,
  onSelectHistory,
  onDeleteHistory,
  onProcessFile,
  onNavigateToHiddenNegatives,
  theme = 'light'
}) => {
  // 筛选器状态
  const [selectedStar, setSelectedStar] = useState<number | 'all'>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'negative' | 'hidden_negative' | 'neutral'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  // 清洗分流透视多选状态 (空数组 [] 表示全量原始)
  const [selectedCleaningSegments, setSelectedCleaningSegments] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyValidFilter, setOnlyValidFilter] = useState<boolean>(false);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [retranslatingIds, setRetranslatingIds] = useState<Record<string, boolean>>({});
  // 表格按时间排序（desc: 最新在前；asc: 最晚在前）
  const [timeSortOrder, setTimeSortOrder] = useState<'desc' | 'asc'>('desc');

  const toggleCleaningSegment = (segmentId: string) => {
    if (segmentId === 'all') {
      setSelectedCleaningSegments([]);
      return;
    }
    setSelectedCleaningSegments(prev => {
      if (prev.includes(segmentId)) {
        return prev.filter(s => s !== segmentId);
      } else {
        return [...prev, segmentId];
      }
    });
  };

  // 时间趋势展示模式：按月 (柱状图+折线图) vs 按日 (精准折线图)
  const [timelineMode, setTimelineMode] = useState<'monthly' | 'daily'>('monthly');
  const [hoveredDailyIndex, setHoveredDailyIndex] = useState<number | null>(null);
  const [hoveredMonthlyIndex, setHoveredMonthlyIndex] = useState<number | null>(null);

  // 弹窗与交互状态
  const [activeDrilldownReview, setActiveDrilldownReview] = useState<StandardReview | null>(null);
  const [sentimentGuideOpen, setSentimentGuideOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [previewRawTableRecord, setPreviewRawTableRecord] = useState<DatasetRecord | null>(null);
  const [previewImageModalUrl, setPreviewImageModalUrl] = useState<string | null>(null);
  const [zoomedRing, setZoomedRing] = useState<ZoomedRingModalData | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  // 导入清洗合并功能状态：粘贴文本弹窗与团队分享弹窗
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // 清洗展开抽屉 (实现与数据清洗模块的深度无缝合并)
  const [cleaningDrawerOpen, setCleaningDrawerOpen] = useState(false);

  // 拖拽与上传状态
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // 单条精准调用后端大模型深度分析 (/api/analyze)，全量联动同步刷新【译文】、【情感方向】与【匹配标签】
  const handleManualReanalyze = async (review: StandardReview) => {
    setRetranslatingIds(prev => ({ ...prev, [review.id]: true }));
    setUploadToast(`🚀 正在请求后端大模型对评价 #${review.id} 启动深度分析（解析小语种俚语与真实情感）...`);
    try {
      const res = await analyzeReviewWithBackend({
        content: review.content,
        rating: review.rating,
        sku: review.sku,
        language: review.language
      });
      if (res && res.success) {
        let cleanTrans = (res.translation || '').trim();
        if (containsForbiddenForeignChars(cleanTrans)) {
          cleanTrans = purifyToPureChinese(cleanTrans, review.content, review.rating);
        }
        if (cleanTrans) {
          cacheAiTranslationResult(review.content, cleanTrans);
        }
        setReviews(prev => prev.map(r => {
          if (r.id !== review.id) return r;
          const isHidden = res.sentiment.includes('隐性差评') || (r.rating >= 4 && (res.sentiment.includes('差评') || res.sentiment.includes('不满')));
          const isPos = res.sentiment.includes('正向') || res.sentiment.includes('满意');
          const isNeg = res.sentiment.includes('差评') || res.sentiment.includes('不满');
          const realSentiment = isPos ? 'positive' : (isNeg ? 'negative' : 'neutral');

          const newTopics = res.tags && res.tags.length > 0 ? res.tags : r.topics;
          const newGrievances = (isHidden || isNeg) && res.tags && res.tags.length > 0 
            ? res.tags 
            : r.hiddenNegativeCheck.extractedGrievances;

          return {
            ...r,
            contentZh: cleanTrans || r.contentZh,
            languageLabel: (r.languageLabel === '未知/英文' || !r.languageLabel) ? '未知' : r.languageLabel,
            topics: newTopics,
            customSentimentLabel: res.sentiment,
            analyzedModel: res.model || 'gpt-5.4-mini',
            hiddenNegativeCheck: {
              ...r.hiddenNegativeCheck,
              isHiddenNegative: isHidden,
              realSentiment: realSentiment,
              extractedGrievances: newGrievances
            }
          };
        }));
        setUploadToast(`✅ 评价 #${review.id} AI分析完成 (模型: ${res.model || 'gpt-5.4-mini'})：【译文】、【情感方向: ${res.sentiment}】、【标签: ${res.tags.join('、')}】已全部联动刷新！`);
        setTimeout(() => setUploadToast(null), 5000);
      } else {
        setUploadToast(`⚠️ 评价 #${review.id} 分析请求未成功返回，已维持安全兜底。`);
        setTimeout(() => setUploadToast(null), 4000);
      }
    } catch (e) {
      console.error('Manual reanalyze failed', e);
      setUploadToast(`❌ 评价 #${review.id} AI分析遇到网络异常，请检查后端状态。`);
      setTimeout(() => setUploadToast(null), 4000);
    } finally {
      setRetranslatingIds(prev => ({ ...prev, [review.id]: false }));
    }
  };

  // 自动后台异步对检测为模板词、未完全配对或泰语/小语种的评论进行 Google Translate 翻译校准升级
  useEffect(() => {
    let isMounted = true;
    const upgradeTranslations = async () => {
      // 找出需要升级翻译的评论（包含可疑的第三方模板词、非中文但缺乏译文、或者包含泰文字符未清洗等）
      const candidates = reviews.filter(r => 
        !r.contentZh ||
        !/[\u4e00-\u9fa5]/.test(r.contentZh) ||
        r.contentZh.includes('【买家好评】') ||
        r.contentZh.includes('规格材质符合预期') ||
        r.contentZh.includes('【给5星鼓励】') ||
        /[\u0E00-\u0E7F]/.test(r.contentZh) ||
        (r.rating <= 3 && (r.contentZh.includes('好评') || r.contentZh.includes('满意') || r.contentZh.includes('质量可靠耐用'))) ||
        (r.content.includes('สินค้าที่ได้มาสวยค่ะ') && !r.contentZh.includes('切割效果')) ||
        (r.content.length > 20 && (!r.contentZh || r.contentZh.length < 8))
      ).slice(0, 50);

      if (candidates.length === 0) return;

      let changed = false;
      const updatedMap: Record<string, string> = {};

      for (const r of candidates) {
        try {
          const fullTrans = await translateWithGoogleApi(r.content, r.language || 'auto');
          if (fullTrans && fullTrans !== r.contentZh && !containsForbiddenForeignChars(fullTrans)) {
            updatedMap[r.id] = fullTrans;
            changed = true;
          }
        } catch (e) {}
      }

      if (changed && isMounted) {
        setReviews(prev => prev.map(r => updatedMap[r.id] ? { ...r, contentZh: updatedMap[r.id] } : r));
      }
    };

    upgradeTranslations();
    return () => { isMounted = false; };
  }, [reviews.length, currentFileName]);

  // 文件拖拽/选择处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setIsUploading(true);
      await onProcessFile(file);
      setIsUploading(false);
      setUploadToast(`已成功载入【${file.name}】，全部指标已基于原始数据实时计算！`);
      setTimeout(() => setUploadToast(null), 5000);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      await onProcessFile(file);
      setIsUploading(false);
      setUploadToast(`已成功载入【${file.name}】，全部指标已基于原始数据实时计算！`);
      setTimeout(() => setUploadToast(null), 5000);
    }
    e.target.value = '';
  };

  // 粘贴文本处理 (合并自数据导入与清洗模块)
  const handlePastedData = () => {
    if (!pastedText.trim()) return;
    try {
      const lines = pastedText.split('\n').filter(l => l.trim().length > 0);
      const parsedRows: StandardReview[] = lines.map((line, idx) => {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const content = parts[0]?.trim() || line.trim();
        const rawRating = parts[1] ? parseInt(parts[1], 10) : 5;
        const rating = isNaN(rawRating) ? 5 : Math.max(1, Math.min(5, rawRating));
        const sku = parts[2]?.trim() || '默认SKU';

        return parseRawRowToStandard({ content, rating, sku }, {
          ratingKey: 'rating',
          contentKey: 'content',
          skuKey: 'sku',
          buyerKey: 'buyer',
          timeKey: 'time',
          imageKey: 'image',
          replyKey: 'reply',
          idKey: 'id'
        }, 'shopee', idx);
      });

      setReviews(parsedRows);
      setUploadToast(`已成功载入直接粘贴语料 (${parsedRows.length} 条)！`);
      setPasteModalOpen(false);
      setPastedText('');
      setTimeout(() => setUploadToast(null), 4000);
    } catch (err: any) {
      setUploadToast(`粘贴文本解析异常: ${err?.message}`);
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 所有变体列表
  const allVariants = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach(r => {
      if (r.sku && r.sku.trim()) set.add(r.sku.trim());
    });
    return Array.from(set);
  }, [reviews]);

  // 清洗统计指标（合并自清洗模块，精细拆分三大无效/水军分类）
  const cleaningSummary = useMemo(() => {
    let invalidCount = 0;
    let coinsCount = 0;
    let fakeClusterCount = 0;
    let defaultCount = 0;
    let hiddenCount = 0;
    let lowStarCount = 0;

    reviews.forEach(r => {
      if (r.hiddenNegativeCheck.isHiddenNegative) {
        hiddenCount++;
      }
      if (r.rating <= 3) {
        lowStarCount++;
      }
      if (r.invalidCheck.isInvalid) {
        invalidCount++;
        if (r.invalidCheck.category === 'text_coins_farming') {
          coinsCount++;
        } else if (r.invalidCheck.category === 'rating_fake_cluster') {
          fakeClusterCount++;
        } else {
          defaultCount++;
        }
      }
    });

    const validCount = reviews.length - invalidCount;
    const cleanRate = reviews.length > 0 ? Math.round((validCount / reviews.length) * 100) : 100;

    return {
      total: reviews.length,
      validCount,
      invalidCount,
      cleanRate,
      coinsCount,
      fakeClusterCount,
      defaultCount,
      hiddenCount,
      lowStarCount
    };
  }, [reviews]);

  // 全局标签提取（保持标签库无论怎么点击都能完整呈现所有标签，不会因为筛选而缩减为0）
  const availableTags = useMemo(() => {
    return extractExecutiveDashboardData(reviews).reviewTags;
  }, [reviews]);

  // 根据当前顶部综合筛选条件，过滤评论列表
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      // 0. 清洗分段多选过滤 (支持同时多选多个分类，OR 逻辑组合)
      if (selectedCleaningSegments.length > 0) {
        const matchesAny = selectedCleaningSegments.some(seg => {
          if (seg === 'valid') return !r.invalidCheck.isInvalid;
          if (seg === 'hidden_negative') return r.hiddenNegativeCheck.isHiddenNegative;
          if (seg === 'coins') return r.invalidCheck.category === 'text_coins_farming';
          if (seg === 'default') return r.invalidCheck.category === 'system_default' || r.invalidCheck.category === 'text_template' || r.invalidCheck.category === 'text_irrelevant' || r.content.trim().length === 0;
          if (seg === 'fake') return r.invalidCheck.category === 'rating_fake_cluster';
          if (seg === 'low_star') return r.rating <= 3;
          return false;
        });
        if (!matchesAny) return false;
      }

      // 兼容原有 onlyValidFilter
      if (onlyValidFilter && r.invalidCheck.isInvalid) {
        return false;
      }

      // 1. 星级过滤
      if (selectedStar !== 'all' && r.rating !== selectedStar) {
        return false;
      }

      // 2. 变体过滤
      if (selectedVariant !== 'all' && r.sku !== selectedVariant) {
        return false;
      }

      // 3. 情感过滤
      if (selectedSentiment === 'positive') {
        if (r.hiddenNegativeCheck.isHiddenNegative || r.hiddenNegativeCheck.realSentiment !== 'positive') return false;
      } else if (selectedSentiment === 'negative') {
        if (!r.hiddenNegativeCheck.isHiddenNegative && r.hiddenNegativeCheck.realSentiment !== 'negative') return false;
      } else if (selectedSentiment === 'hidden_negative') {
        if (!r.hiddenNegativeCheck.isHiddenNegative) return false;
      } else if (selectedSentiment === 'neutral') {
        if (r.hiddenNegativeCheck.isHiddenNegative || r.hiddenNegativeCheck.realSentiment !== 'neutral') return false;
      }

      // 4. 标签快速点击过滤 (使用 matchReviewWithTag，精确联动左右看板)
      if (selectedTagFilter) {
        if (!matchReviewWithTag(r, selectedTagFilter)) {
          return false;
        }
      }

      // 5. 搜索关键词
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inContent = r.content.toLowerCase().includes(q);
        const inZh = (r.contentZh || '').toLowerCase().includes(q);
        const inSku = (r.sku || '').toLowerCase().includes(q);
        const inTopics = r.topics.some(t => t.toLowerCase().includes(q));
        const inGrievances = r.hiddenNegativeCheck.extractedGrievances.some(g => g.toLowerCase().includes(q));
        if (!inContent && !inZh && !inSku && !inTopics && !inGrievances) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, selectedCleaningSegments, selectedStar, selectedVariant, selectedSentiment, selectedTagFilter, searchQuery, onlyValidFilter]);

  // 核心业务大盘聚合计算 (联动随 filteredReviews 实时计算)
  const dashboardData = useMemo(() => {
    return extractExecutiveDashboardData(filteredReviews);
  }, [filteredReviews]);

  // 评论证据表格：根据留评时间排序 (最新 / 最晚)
  const displayReviews = useMemo(() => {
    const sorted = [...filteredReviews];
    sorted.sort((a, b) => {
      const timeA = new Date(a.reviewTime || '').getTime() || 0;
      const timeB = new Date(b.reviewTime || '').getTime() || 0;
      return timeSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return sorted;
  }, [filteredReviews, timeSortOrder]);

  // 重置筛选
  const handleResetFilters = () => {
    setSelectedStar('all');
    setSelectedVariant('all');
    setSelectedSentiment('all');
    setSelectedTagFilter(null);
    setSelectedCleaningSegments([]);
    setOnlyValidFilter(false);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedStar !== 'all' || selectedVariant !== 'all' || selectedSentiment !== 'all' || selectedTagFilter !== null || selectedCleaningSegments.length > 0 || onlyValidFilter || searchQuery.trim().length > 0;

  const toggleExpand = (id: string) => {
    setExpandedReviewIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 下载原始导表
  const handleDownloadOriginalExcel = (record: DatasetRecord) => {
    const rawList = record.reviews.map(r => r.rawRow || {
      '评价ID': r.id,
      '星级': r.rating,
      '评价内容': r.content,
      '规格SKU': r.sku,
      '买家': r.buyerName,
      '时间': r.reviewTime
    });
    const worksheet = XLSX.utils.json_to_sheet(rawList);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '原始评价数据');
    XLSX.writeFile(workbook, `原始数据_${record.fileName}`);
  };

  // 打开环形图动态放大透视弹窗
  const openZoomedRing = (chartType: ZoomedRingModalData['chartType'], activeKey: string) => {
    const titles = {
      star_satisfaction: '客户满意度 (按星级计算) · 动态维度放大透视',
      content_satisfaction: '客户满意度 (按实际内容测算) · 动态维度放大透视',
      variant_distribution: '变体分布 (各规格SKU) · 动态维度放大透视'
    };
    setZoomedRing({
      chartTitle: titles[chartType],
      chartType,
      activeDimensionKey: activeKey
    });
  };

  // 辅助渲染：格式化非零微量百分比（当样本量>0但四舍五入为0%时，显示为 0.4% 等精确小数，杜绝 1条显示为0% 的矛盾）
  const formatSmallPct = (count: number, total: number, roundedPct: number) => {
    if (count === 0 || total === 0) return '0%';
    const exact = (count / total) * 100;
    if (exact > 0 && exact < 1) {
      return `${exact.toFixed(1)}%`;
    }
    return `${roundedPct}%`;
  };

  // 辅助渲染：星级满意度 Donut (采用 #1B58A1 / #91AECF 蓝色系与柔和珊瑚红 #E05D52 差评警示)
  const renderStarDonut = () => {
    const { positivePercent, negativePercent, neutralPercent } = dashboardData.satisfaction.byStar;
    const r = 36;
    const circ = 2 * Math.PI * r;
    const posStroke = (positivePercent / 100) * circ;
    const negStroke = (negativePercent / 100) * circ;
    const neuStroke = (neutralPercent / 100) * circ;

    return (
      <svg className="w-24 h-24 transform -rotate-90 cursor-pointer select-none">
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#D8E4F0' : '#1e293b'} strokeWidth="12" fill="none" />
        <circle
          cx="48" cy="48" r={r} stroke="#1B58A1" strokeWidth={hoveredSlice === 'star_pos' ? 16 : 12} fill="none"
          strokeDasharray={`${posStroke} ${circ}`} strokeDashoffset={0}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('star_pos')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('star_satisfaction', 'positive'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#E05D52" strokeWidth={hoveredSlice === 'star_neg' ? 16 : 12} fill="none"
          strokeDasharray={`${negStroke} ${circ}`} strokeDashoffset={-posStroke}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('star_neg')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('star_satisfaction', 'negative'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#91AECF" strokeWidth={hoveredSlice === 'star_neu' ? 16 : 12} fill="none"
          strokeDasharray={`${neuStroke} ${circ}`} strokeDashoffset={-(posStroke + negStroke)}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('star_neu')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('star_satisfaction', 'neutral'); }}
        />
      </svg>
    );
  };

  // 辅助渲染：实际内容测算满意度 Donut (支持切片交互与点击放大)
  const renderContentDonut = () => {
    const { positivePercent, negativePercent, neutralPercent } = dashboardData.satisfaction.byContent;
    const r = 36;
    const circ = 2 * Math.PI * r;
    const posStroke = (positivePercent / 100) * circ;
    const negStroke = (negativePercent / 100) * circ;
    const neuStroke = (neutralPercent / 100) * circ;

    return (
      <svg className="w-24 h-24 transform -rotate-90 cursor-pointer select-none">
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#D8E4F0' : '#1e293b'} strokeWidth="12" fill="none" />
        <circle
          cx="48" cy="48" r={r} stroke="#1B58A1" strokeWidth={hoveredSlice === 'content_pos' ? 16 : 12} fill="none"
          strokeDasharray={`${posStroke} ${circ}`} strokeDashoffset={0}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('content_pos')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('content_satisfaction', 'positive'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#E05D52" strokeWidth={hoveredSlice === 'content_neg' ? 16 : 12} fill="none"
          strokeDasharray={`${negStroke} ${circ}`} strokeDashoffset={-posStroke}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('content_neg')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('content_satisfaction', 'negative'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#91AECF" strokeWidth={hoveredSlice === 'content_neu' ? 16 : 12} fill="none"
          strokeDasharray={`${neuStroke} ${circ}`} strokeDashoffset={-(posStroke + negStroke)}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('content_neu')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('content_satisfaction', 'neutral'); }}
        />
      </svg>
    );
  };

  // 辅助渲染：变体分布 Donut (支持切片交互与点击放大)
  const renderVariantDonut = () => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    let accumulated = 0;

    return (
      <svg className="w-24 h-24 transform -rotate-90 cursor-pointer select-none">
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#D8E4F0' : '#1e293b'} strokeWidth="12" fill="none" />
        {dashboardData.variants.map((v, idx) => {
          const strokeLength = (v.percentage / 100) * circ;
          const offset = -accumulated;
          accumulated += strokeLength;
          const isHovered = hoveredSlice === `var_${idx}`;
          return (
            <circle
              key={idx}
              cx="48"
              cy="48"
              r={r}
              stroke={v.color}
              strokeWidth={isHovered ? 16 : 12}
              fill="none"
              strokeDasharray={`${strokeLength} ${circ}`}
              strokeDashoffset={offset}
              className="transition-all duration-200 hover:opacity-90 cursor-pointer"
              onMouseEnter={() => setHoveredSlice(`var_${idx}`)}
              onMouseLeave={() => setHoveredSlice(null)}
              onClick={(e) => { e.stopPropagation(); openZoomedRing('variant_distribution', v.variant); }}
            />
          );
        })}
      </svg>
    );
  };

  const isLight = theme === 'light';

  return (
    <div className="space-y-6">
      {/* 顶部：当前数据源明确标识栏 + 快速导入拖拽区 + 历史记录管理入口 + 数据清洗合并控制台 */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-4 rounded-xl border transition-all ${
          isDragging 
            ? 'bg-[#BCD7F5]/30 border-[#1B58A1] ring-2 ring-[#1B58A1]/30' 
            : (isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800')
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[#1B58A1] uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-[#1B58A1]" />
                <span>当前分析原始表格</span>
              </span>
              <span aria-hidden="true" className={isLight ? 'text-[#91AECF]' : 'text-neutral-600'}>·</span>
              
              {/* 点击表格名可直接查看原始表格 */}
              <button
                onClick={() => {
                  const currentRecord: DatasetRecord = historyList.find(h => h.fileName === currentFileName) || {
                    id: 'curr',
                    fileName: currentFileName,
                    importTime,
                    rowCount: reviews.length,
                    avgRating: 4.8,
                    reviews
                  };
                  setPreviewRawTableRecord(currentRecord);
                }}
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isLight 
                    ? 'bg-[#D8E4F0]/40 text-[#090911] border-[#91AECF]/40 hover:bg-[#BCD7F5]/40 hover:text-[#1B58A1]' 
                    : 'text-white bg-neutral-800 border-neutral-700 hover:bg-neutral-750 hover:text-sky-300'
                }`}
                title="点击直接在页面内打开查看原始表格数据明细"
              >
                <span>{currentFileName || '未载入表格 (请拖入原始 Excel)'}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>

              {importTime && (
                <span className={`text-xs font-mono flex items-center gap-1 ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
                  <Clock className="h-3 w-3 opacity-70" />
                  <span>导入时间: {importTime}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className={isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}>
                全量样本: <strong className={isLight ? 'text-[#090911] font-mono' : 'text-white font-mono'}>{reviews.length}</strong> 条
              </span>
              <span aria-hidden="true" className={isLight ? 'text-[#91AECF]/40' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}>
                清洗后有效: <strong className="text-[#1B58A1] font-mono font-bold">{cleaningSummary.validCount}</strong> 条 ({cleaningSummary.cleanRate}%)
              </span>
              <span aria-hidden="true" className={isLight ? 'text-[#91AECF]/40' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}>
                剔除无效水军: <strong className="text-[#E05D52] font-mono">{cleaningSummary.invalidCount}</strong> 条
              </span>
              <span aria-hidden="true" className={isLight ? 'text-[#91AECF]/40' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}>
                当前参与计算: <strong className="text-[#1B58A1] font-mono font-bold">{filteredReviews.length}</strong> 条
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 展开清洗与水军排查抽屉按钮 */}
            <button
              onClick={() => setCleaningDrawerOpen(!cleaningDrawerOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border whitespace-nowrap cursor-pointer ${
                cleaningDrawerOpen
                  ? 'bg-[#1B58A1] text-white border-[#1B58A1] font-bold shadow-xs'
                  : (isLight ? 'bg-white text-[#090911] border-[#91AECF]/40 hover:bg-[#D8E4F0]/40' : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700')
              }`}
              title="查看水军识别、凑字刷单过滤等清洗详情"
            >
              <ShieldX className="h-3.5 w-3.5 text-[#E05D52]" />
              <span>数据清洗排查 ({cleaningSummary.invalidCount})</span>
              {cleaningDrawerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* 粘贴文本按钮 (合并自清洗模块) */}
            <button
              onClick={() => setPasteModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border whitespace-nowrap cursor-pointer ${
                isLight 
                  ? 'bg-white text-[#090911] border-[#91AECF]/40 hover:bg-[#D8E4F0]/40' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="直接粘贴文本语料进行快速分析"
            >
              <FileText className="h-3.5 w-3.5 text-[#1B58A1]" />
              <span>粘贴文本</span>
            </button>

            {/* 分享工作台按钮 */}
            <button
              onClick={() => setShareModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border whitespace-nowrap cursor-pointer ${
                isLight 
                  ? 'bg-white text-[#090911] border-[#91AECF]/40 hover:bg-[#D8E4F0]/40' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="协同分享此分析工作台"
            >
              <Share2 className="h-3.5 w-3.5 text-[#1B58A1]" />
              <span>分享工作台</span>
            </button>

            {/* 查看历史记录按钮 */}
            <button
              onClick={() => setHistoryModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border whitespace-nowrap cursor-pointer ${
                isLight 
                  ? 'bg-white text-[#090911] border-[#91AECF]/40 hover:bg-[#D8E4F0]/40' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
            >
              <History className="h-3.5 w-3.5 text-[#1B58A1]" />
              <span>历史表格 ({historyList.length})</span>
            </button>

            {/* 拖入/选择本地表格按钮 */}
            <label className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B58A1] hover:bg-[#154680] rounded-lg cursor-pointer transition-colors shadow-xs whitespace-nowrap font-semibold">
              <Upload className="h-3.5 w-3.5" />
              <span>{isUploading ? '解析计算中...' : '拖入 / 导入新表格'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 合并嵌入的数据清洗与水军识别控制台 */}
        {cleaningDrawerOpen && (
          <div className={`mt-3 pt-3 border-t space-y-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#090911]' : 'text-neutral-200'}`}>
                <ShieldCheck className="h-4 w-4 text-[#1B58A1]" />
                <span>数据清洗与水军识别控制台（已深度无缝整合）</span>
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={onlyValidFilter}
                  onChange={(e) => setOnlyValidFilter(e.target.checked)}
                  className="rounded text-[#1B58A1] focus:ring-[#1B58A1] cursor-pointer"
                />
                <span className={`font-medium ${isLight ? 'text-[#090911]' : 'text-neutral-300'}`}>
                  仅分析清洗后真实有效评论（自动剔除 {cleaningSummary.invalidCount} 条无效与水军废话）
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-[#F0F6FC] border-[#BCD7F5]' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block text-[#5A6E85]">真实有效评论</span>
                <span className="text-sm font-bold font-mono text-[#1B58A1]">{cleaningSummary.validCount} 条</span>
                <span className="text-[10px] opacity-60 block">占比 {cleaningSummary.cleanRate}%</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block text-[#5A6E85]">虾币/金币凑字废话</span>
                <span className="text-sm font-bold font-mono text-[#090911]">{cleaningSummary.coinsCount} 条</span>
                <span className="text-[10px] opacity-60 block">“555/kfjds/凑字”</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block text-[#5A6E85]">疑似集中刷单好评</span>
                <span className="text-sm font-bold font-mono text-[#090911]">{cleaningSummary.fakeClusterCount} 条</span>
                <span className="text-[10px] opacity-60 block">全5星长文模板</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block text-[#5A6E85]">系统默认无字评价</span>
                <span className="text-sm font-bold font-mono text-[#090911]">{cleaningSummary.defaultCount} 条</span>
                <span className="text-[10px] opacity-60 block">超时自动默认好评</span>
              </div>
            </div>
          </div>
        )}

        {uploadToast && (
          <div className="mt-3 p-2.5 rounded bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{uploadToast}</span>
          </div>
        )}
      </div>

      {/* 顶端6大核心指标卡片 (已按需求移除真实净满意度组件，从左到右：评论总量、有效评论（剔除无字、凑字、刷单好评）、五星/四星隐形差评、系统默认无字评价、凑字评论、疑似集中刷单好评) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 指标1: 评论总量 (Total) */}
        <div 
          onClick={() => { setSelectedCleaningSegments([]); setSelectedStar('all'); setSelectedSentiment('all'); }}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedCleaningSegments.length === 0 && selectedSentiment === 'all' && selectedStar === 'all'
              ? 'ring-2 ring-[#1B58A1] shadow-sm'
              : ''
          } ${
            isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)] hover:border-[#1B58A1]/40' : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
          title="点击重置为全量原始样本"
        >
          <div className={`text-[11px] mb-1 font-medium min-h-[30px] flex items-center ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
            评论总量 (Total)
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isLight ? 'text-[#090911]' : 'text-white'}`}>
              {reviews.length}
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#91AECF]' : 'text-neutral-500'}`}>
              全量原始留评总数
            </div>
          </div>
        </div>

        {/* 指标2: 有效评论（剔除无字、凑字、刷单好评） */}
        <div 
          onClick={() => toggleCleaningSegment('valid')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedCleaningSegments.includes('valid') ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/25 shadow-sm' : ''
          } ${
            isLight ? 'bg-[#F4F8FC] border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)] hover:border-[#1B58A1]/40' : 'bg-neutral-900/90 border-neutral-800'
          }`}
          title="点击多选切换：查看有效评论（剔除无字、凑字、刷单好评）"
        >
          <div className={`text-[11px] mb-1 font-semibold leading-snug whitespace-normal break-words min-h-[36px] flex items-center ${isLight ? 'text-[#1B58A1]' : 'text-neutral-200'}`} title="有效评论（剔除无字、凑字、刷单好评）">
            有效评论（剔除无字、凑字、刷单好评）
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isLight ? 'text-[#1B58A1]' : 'text-emerald-400'}`}>
              {cleaningSummary.validCount}
              <span className={`text-[10px] font-normal ml-1 ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
                ({cleaningSummary.cleanRate}%)
              </span>
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#91AECF]' : 'text-neutral-500'}`}>
              自然买家真实留评
            </div>
          </div>
        </div>

        {/* 指标3: 五星/四星隐形差评 (保留柔和橙红点缀状态预警) */}
        <div 
          onClick={() => toggleCleaningSegment('hidden_negative')}
          className={`p-3 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
            selectedCleaningSegments.includes('hidden_negative') ? 'ring-2 ring-[#E05D52] shadow-sm' : ''
          } ${
            isLight 
              ? 'bg-[#FFF5F5] border-[#FCA5A5]/60 hover:border-[#E05D52] shadow-[0_2px_8px_rgba(224,93,82,0.06)]' 
              : 'bg-neutral-900/90 border-rose-900/60 hover:border-rose-500/80'
          }`}
          title="点击多选切换：透视五星/四星隐形差评"
        >
          <div className="flex items-center justify-between text-[11px] text-[#E05D52] mb-1 font-medium min-h-[30px]">
            <span className="font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-[#E05D52] shrink-0" />
              <span>五星/四星隐形差评</span>
            </span>
            <ChevronRight className="h-3 w-3 text-[#E05D52] group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono tabular-nums tracking-tight text-[#E05D52]">
              {cleaningSummary.hiddenCount}
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#C53030]/80' : 'text-rose-400/80'}`}>
              高星人情·文字痛骂
            </div>
          </div>
        </div>

        {/* 指标4: 系统默认无字评价 */}
        <div 
          onClick={() => toggleCleaningSegment('default')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedCleaningSegments.includes('default') ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/25 shadow-sm' : ''
          } ${
            isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)] hover:border-[#1B58A1]/40' : 'bg-neutral-900/90 border-neutral-800'
          }`}
          title="点击多选切换：查看系统默认无字评价"
        >
          <div className={`text-[11px] mb-1 font-medium min-h-[30px] flex items-center ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
            系统默认无字评价
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isLight ? 'text-[#090911]' : 'text-sky-400'}`}>
              {cleaningSummary.defaultCount}
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#91AECF]' : 'text-neutral-500'}`}>
              平台超时默认好评
            </div>
          </div>
        </div>

        {/* 指标5: 凑字评论 */}
        <div 
          onClick={() => toggleCleaningSegment('coins')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedCleaningSegments.includes('coins') ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/25 shadow-sm' : ''
          } ${
            isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)] hover:border-[#1B58A1]/40' : 'bg-neutral-900/90 border-neutral-800'
          }`}
          title="点击多选切换：查看凑字评论"
        >
          <div className={`text-[11px] mb-1 font-medium min-h-[30px] flex items-center ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
            凑字评论
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isLight ? 'text-[#090911]' : 'text-amber-400'}`}>
              {cleaningSummary.coinsCount}
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#91AECF]' : 'text-neutral-500'}`}>
              “555/kfjds/凑字”
            </div>
          </div>
        </div>

        {/* 指标6: 疑似集中刷单好评 */}
        <div 
          onClick={() => toggleCleaningSegment('fake')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            selectedCleaningSegments.includes('fake') ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/25 shadow-sm' : ''
          } ${
            isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)] hover:border-[#1B58A1]/40' : 'bg-neutral-900/90 border-neutral-800'
          }`}
          title="点击多选切换：查看疑似集中刷单模板好评"
        >
          <div className={`text-[11px] mb-1 font-medium min-h-[30px] flex items-center ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
            疑似集中刷单好评
          </div>
          <div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${isLight ? 'text-[#090911]' : 'text-rose-400'}`}>
              {cleaningSummary.fakeClusterCount}
            </div>
            <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-[#91AECF]' : 'text-neutral-500'}`}>
              批量机器模板号
            </div>
          </div>
        </div>
      </div>

      {/* 第一行看板：
          第1框: 客户满意度 (按星级计算)
          第2框: 客户满意度 (按实际内容测算)
          第3框: 变体分布 (无滑动条紧凑排版)
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 第1框: 客户满意度 (按星级计算) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-[#090911]' : 'text-white'
              }`}>
                <Star className="h-3.5 w-3.5 text-[#1B58A1]" />
                <span>客户满意度 (按星级计算)</span>
              </h2>
              <button 
                onClick={() => openZoomedRing('star_satisfaction', 'positive')}
                className="text-[10px] text-[#1B58A1] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                title="点击动态放大此环形图"
              >
                <Maximize2 className="h-3 w-3" />
                <span>放大透视</span>
              </button>
            </div>
            <p className="text-[11px] opacity-60">
              纯依据买家给出的表面评分星级直接统计 (点击维度可放大)
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div 
              onClick={() => openZoomedRing('star_satisfaction', 'positive')}
              className="relative flex items-center justify-center shrink-0 cursor-pointer group"
              title="点击放大查看星级满意度环形图"
            >
              {renderStarDonut()}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center group-hover:scale-105 transition-transform">
                <span className={`text-base font-bold font-mono leading-tight ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                  {dashboardData.satisfaction.byStar.positivePercent}%
                </span>
                <span className="text-[10px] opacity-60">表面好评</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1 pl-4">
              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'positive')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#F0F6FC]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看4-5星满意维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1B58A1]" />
                  <span>4-5星满意</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byStar.positive} ({dashboardData.satisfaction.byStar.positivePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'negative')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#FFF5F5]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看1-2星差评维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E05D52]" />
                  <span>1-2星差评</span>
                </div>
                <span className="font-mono text-[#E05D52] font-semibold">
                  {dashboardData.satisfaction.byStar.negative} ({formatSmallPct(dashboardData.satisfaction.byStar.negative, dashboardData.satisfaction.total, dashboardData.satisfaction.byStar.negativePercent)})
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'neutral')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#F0F6FC]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看3星中立维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#91AECF]" />
                  <span>3星中立</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byStar.neutral} ({formatSmallPct(dashboardData.satisfaction.byStar.neutral, dashboardData.satisfaction.total, dashboardData.satisfaction.byStar.neutralPercent)})
                </span>
              </div>
            </div>
          </div>

          <div className={`p-2 rounded border text-[11px] flex items-center justify-between ${
            isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#5A6E85]' : 'bg-neutral-950 border-neutral-850 text-neutral-400'
          }`}>
            <div>
              <span className="opacity-70">总样本: </span>
              <strong className="font-mono font-bold text-[#090911]">{dashboardData.satisfaction.total}</strong> 条评价
            </div>
            <span className="text-[10px] text-[#1B58A1] font-medium">🔍 点击维度可深度透视</span>
          </div>
        </div>

        {/* 第2框: 客户满意度 (按实际内容测算) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-[#090911]' : 'text-white'
              }`}>
                <ShieldCheck className="h-3.5 w-3.5 text-[#1B58A1]" />
                <span>客户满意度 (按实际内容测算)</span>
              </h2>
              <button 
                onClick={() => openZoomedRing('content_satisfaction', 'negative')}
                className="text-[10px] text-[#E05D52] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                title="点击动态放大此环形图"
              >
                <Maximize2 className="h-3 w-3" />
                <span>放大透视</span>
              </button>
            </div>
            <p className="text-[11px] opacity-60">
              结合真实文本情感：五星差评强制归入负向不满
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div 
              onClick={() => openZoomedRing('content_satisfaction', 'positive')}
              className="relative flex items-center justify-center shrink-0 cursor-pointer group"
              title="点击放大查看内容满意度环形图"
            >
              {renderContentDonut()}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center group-hover:scale-105 transition-transform">
                <span className={`text-base font-bold font-mono leading-tight ${isLight ? 'text-[#1B58A1]' : 'text-sky-400'}`}>
                  {dashboardData.satisfaction.byContent.positivePercent}%
                </span>
                <span className="text-[10px] opacity-60">净满意度</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1 pl-4">
              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'positive')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#F0F6FC]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看真实满意维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1B58A1]" />
                  <span>真实满意好评</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byContent.positive} ({dashboardData.satisfaction.byContent.positivePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'negative')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#FFF5F5]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看不满/含隐性差评维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E05D52]" />
                  <span>不满/含隐性差评</span>
                </div>
                <span className="font-mono text-[#E05D52] font-semibold">
                  {dashboardData.satisfaction.byContent.negative} ({formatSmallPct(dashboardData.satisfaction.byContent.negative, dashboardData.satisfaction.total, dashboardData.satisfaction.byContent.negativePercent)})
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'neutral')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-[#F0F6FC]' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看中立观望维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#91AECF]" />
                  <span>中立观望评价</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byContent.neutral} ({formatSmallPct(dashboardData.satisfaction.byContent.neutral, dashboardData.satisfaction.total, dashboardData.satisfaction.byContent.neutralPercent)})
                </span>
              </div>
            </div>
          </div>

          <div className={`p-2 rounded border text-[11px] space-y-0.5 ${
            isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#5A6E85]' : 'bg-neutral-950 border-neutral-850 text-neutral-400'
          }`}>
            {dashboardData.satisfaction.hiddenCount > 0 ? (
              <p className="text-[#E05D52] text-[11px] leading-tight font-medium">
                ⚠️ 检出 <strong>{dashboardData.satisfaction.hiddenCount}</strong> 条五星/四星隐性差评，真实满意率较表面星级下修 <strong>{dashboardData.satisfaction.hiddenDisparityRate}%</strong>。
              </p>
            ) : (
              <p className="text-[#1B58A1] text-[11px] leading-tight font-medium">
                ✅ 文本情感与星级吻合良好，未见明显的人情掩饰差评。
              </p>
            )}
          </div>
        </div>

        {/* 第3框: 变体分布 (彻底消除内部滚动条，优雅紧凑排版) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                变体分布
              </h2>
              <button
                onClick={() => openZoomedRing('variant_distribution', dashboardData.variants[0]?.variant || 'all')}
                className="text-[10px] text-[#1B58A1] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                title="点击放大所有变体分布"
              >
                <Maximize2 className="h-3 w-3" />
                <span>放大透视</span>
              </button>
            </div>
            <p className="text-[11px] opacity-60">
              各 SKU 销售与留评占比结构 (共 {dashboardData.variants.length} 种规格)
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 gap-3">
            <div 
              onClick={() => openZoomedRing('variant_distribution', dashboardData.variants[0]?.variant || 'all')}
              className="relative flex items-center justify-center shrink-0 cursor-pointer group"
              title="点击放大查看变体分布环形图"
            >
              {renderVariantDonut()}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center group-hover:scale-105 transition-transform">
                <span className={`text-base font-bold font-mono leading-tight ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                  {dashboardData.totalCount}
                </span>
                <span className="text-[10px] opacity-60">总留评</span>
              </div>
            </div>

            {/* 变体排版：彻底无滑动条，紧凑优雅，多余项以放大透视引导展示 */}
            <div className="space-y-1.5 text-xs flex-1 min-w-0">
              {dashboardData.variants.length === 0 ? (
                <div className="opacity-50 text-xs">无变体划分</div>
              ) : (
                <>
                  {dashboardData.variants.slice(0, 3).map((v, i) => (
                    <div 
                      key={i} 
                      onClick={() => openZoomedRing('variant_distribution', v.variant)}
                      className={`p-1.5 rounded cursor-pointer transition-all border flex flex-col gap-1 ${
                        isLight 
                          ? 'bg-[#F8FAFC] hover:bg-[#F0F6FC] border-[#91AECF]/30' 
                          : 'bg-neutral-950/60 hover:bg-neutral-800/80 border-neutral-800'
                      }`}
                      title={`点击放大查看该规格: ${v.variant}`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 truncate max-w-[130px]">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: v.color }} />
                          <span className="truncate font-medium">{v.variant}</span>
                        </div>
                        <span className="font-mono opacity-80 font-bold">{v.percentage}%</span>
                      </div>
                      <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-[#D8E4F0]' : 'bg-neutral-800'}`}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v.percentage}%`, backgroundColor: v.color }} />
                      </div>
                    </div>
                  ))}

                  {dashboardData.variants.length > 3 && (
                    <button
                      onClick={() => openZoomedRing('variant_distribution', dashboardData.variants[3].variant)}
                      className={`w-full text-center py-1 rounded text-[11px] font-medium border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                        isLight 
                          ? 'bg-[#F0F6FC] hover:bg-[#BCD7F5]/40 border-[#BCD7F5] text-[#1B58A1]' 
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <Maximize2 className="h-3 w-3 text-[#1B58A1]" />
                      <span>查看其余 {dashboardData.variants.length - 3} 种规格 (点击放大)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={`text-[10px] pt-1 border-t opacity-60 flex items-center justify-between ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-850'}`}>
            <span>* 依据导表中实际抓取的买家购买规格自动聚合</span>
            <span className="text-[#1B58A1] font-medium">🔍 点击维度可放大透视</span>
          </div>
        </div>
      </div>

      {/* 第二行看板：正反馈 (优势) + 负反馈 (风险与隐性差评) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 正反馈 */}
        <div className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#1B58A1] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#1B58A1]" />
              <span>正反馈 · 高频产品优势 (由评论提炼)</span>
            </h2>
            <span className="text-[11px] opacity-60 font-mono">赞许频次</span>
          </div>

          <div className="space-y-2 pt-1">
            {dashboardData.positiveFeedbacks.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-50">
                当前筛选结果中暂未提取到集中高频正向关键词
              </div>
            ) : (
              dashboardData.positiveFeedbacks.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#090911]">{item.text}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="opacity-70">{item.count}</span>
                      <span className="text-[#1B58A1] text-[11px] font-bold">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden ${isLight ? 'bg-[#D8E4F0]/60' : 'bg-neutral-950'}`}>
                    <div 
                      className="bg-[#1B58A1] h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 负反馈 */}
        <div className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#E05D52] uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-[#E05D52]" />
              <span>负反馈 · 高频问题与风险 (含隐性差评)</span>
            </h2>
            <span className="text-[11px] opacity-60 font-mono">客诉频次</span>
          </div>

          <div className="space-y-2 pt-1">
            {dashboardData.negativeFeedbacks.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-50">
                当前筛选结果中暂未提取到集中负向客诉痛点
              </div>
            ) : (
              dashboardData.negativeFeedbacks.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#090911]">{item.text}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="opacity-70">{item.count}</span>
                      <span className="text-[#E05D52] text-[11px] font-bold">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden ${isLight ? 'bg-[#FFF1F0]' : 'bg-neutral-950'}`}>
                    <div 
                      className="bg-[#E05D52] h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 第三行看板：未满足需求与改进空间 + 智能评论标签库 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 未被满足的需求与改进空间 */}
        <div className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#1B58A1] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#1B58A1]" />
              <span>未满足的需求与改进空间</span>
            </h2>
            <span className="text-[11px] opacity-60 font-mono">纯中文业务行动建议</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {dashboardData.unmetNeeds.length === 0 ? (
              <div className="py-8 text-center text-xs opacity-50">
                原始数据中未检测到明确的改进建议或未满足诉求
              </div>
            ) : (
              dashboardData.unmetNeeds.map((need, idx) => (
                <div key={idx} className={`p-3 rounded-lg border space-y-1.5 ${
                  isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-relaxed text-[#090911]">{need.text}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                      need.urgency === 'high' 
                        ? 'bg-[#FFF1F0] text-[#E05D52] border border-[#FCA5A5] font-bold'
                        : 'bg-[#F0F6FC] text-[#1B58A1] border border-[#BCD7F5]'
                    }`}>
                      {need.count} 次提及
                    </span>
                  </div>
                  {need.sourceContext && (
                    <div className="text-[11px] opacity-60">
                      💡 关联领域: {need.sourceContext}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 智能评论标签库 (基于真实词频与情感打标 · 点击标签快速筛选) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                <Tag className="h-4 w-4 text-[#1B58A1]" />
                <span>智能评论标签库</span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] opacity-70 font-mono">共 {availableTags.length} 个特征</span>
                {selectedTagFilter && (
                  <button
                    onClick={() => setSelectedTagFilter(null)}
                    className="text-xs text-[#1B58A1] hover:underline font-medium flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    <span>清除</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] opacity-60 mt-0.5">
              基于真实词频与情感打标 · 点击标签可联动全大盘过滤
            </p>
          </div>

          {/* 激活标签透视提示条 */}
          {selectedTagFilter && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#F0F6FC] border border-[#BCD7F5] text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span className="h-2 w-2 rounded-full bg-[#1B58A1] animate-pulse shrink-0" />
                <span className="text-[#1B58A1] font-medium truncate">
                  锁定: <strong>【{selectedTagFilter}】</strong>
                </span>
                <span className="opacity-70 font-mono text-[11px]">
                  ({filteredReviews.length}条留评)
                </span>
              </div>
              <button
                onClick={() => setSelectedTagFilter(null)}
                className="text-xs text-[#1B58A1] hover:underline flex items-center gap-0.5 font-semibold shrink-0 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>退出</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-56 overflow-y-auto pr-1">
            {availableTags.length === 0 ? (
              <div className="py-6 text-center text-xs opacity-50 w-full">
                暂无足够词频提取标签
              </div>
            ) : (
              availableTags.map((tag, i) => {
                let badgeClass = isLight 
                  ? 'bg-[#F8FAFC] text-[#5A6E85] border-[#91AECF]/30 hover:border-[#1B58A1]/40'
                  : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:border-neutral-500';

                if (tag.type === 'positive') {
                  badgeClass = isLight
                    ? 'bg-[#F0F6FC] text-[#1B58A1] border-[#BCD7F5] hover:bg-[#BCD7F5]/30'
                    : 'bg-sky-950/40 text-sky-300 border-sky-800/60 hover:bg-sky-900/60';
                } else if (tag.type === 'negative') {
                  badgeClass = isLight
                    ? 'bg-[#FFF1F0] text-[#E05D52] border-[#FCA5A5] hover:bg-[#FEE2E2]'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60';
                } else if (tag.type === 'hidden_negative') {
                  badgeClass = isLight
                    ? 'bg-[#FFF8F0] text-[#C26118] border-[#FED7AA] hover:bg-[#FFEDD5]'
                    : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60';
                }

                const isSelected = selectedTagFilter === tag.tag;

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedTagFilter(isSelected ? null : tag.tag)}
                    className={`px-2.5 py-1 text-xs rounded-md border flex items-center gap-1.5 transition-all cursor-pointer ${badgeClass} ${
                      isSelected ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/40 text-[#1B58A1] font-bold shadow-xs' : ''
                    }`}
                    title={`点击以【${tag.tag}】联动过滤大盘数据`}
                  >
                    <span>{tag.tag}</span>
                    <span className="font-mono text-[10px] opacity-75 font-semibold">({tag.count})</span>
                    {isSelected && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })
            )}
          </div>

          <div className={`text-[10px] pt-1 border-t opacity-60 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-850'}`}>
            * 蓝色正向 · 红色痛点 · 橙色隐性差评
          </div>
        </div>
      </div>

      {/* 第四行看板：真实星级分布 (左 1/3) + 留评时间趋势分析 (右 2/3) 同一行并排呈现 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左侧三分之一：星级真实分布 */}
        <div className={`lg:col-span-1 p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                  <Star className="h-4 w-4 text-[#1B58A1]" />
                  <span>真实星级分布</span>
                </h2>
                <p className="text-[11px] opacity-60">
                  梯度分布 · 点击卡片快速钻取样本
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-[#F0F6FC] text-[#1B58A1] border border-[#BCD7F5] font-mono text-[11px] font-semibold">
                  均分: {dashboardData.avgRating} ★
                </span>
                {selectedStar !== 'all' && (
                  <button
                    onClick={() => setSelectedStar('all')}
                    className="text-xs text-[#1B58A1] hover:underline font-medium flex items-center gap-0.5 cursor-pointer ml-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>重置 ({selectedStar}★)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] mt-2 font-mono flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[#F0F6FC] text-[#1B58A1] border border-[#BCD7F5]/60">
                4-5★: <strong>{
                  (dashboardData.starDistribution.find(s => s.star === 5)?.percentage || 0) + 
                  (dashboardData.starDistribution.find(s => s.star === 4)?.percentage || 0)
                }%</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FFF1F0] text-[#E05D52] border border-[#FCA5A5]/60">
                1-2★: <strong>{
                  (dashboardData.starDistribution.find(s => s.star === 1)?.percentage || 0) + 
                  (dashboardData.starDistribution.find(s => s.star === 2)?.percentage || 0)
                }%</strong>
              </span>
            </div>
          </div>

          {/* 5星等阶柱状卡片 (横排5列自适应) */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {dashboardData.starDistribution.map((item) => {
              const maxCount = Math.max(1, ...dashboardData.starDistribution.map(s => s.count));
              // 当数据量为0时，柱子内部的深色填充高度直接设为 0%（仅保留外框/虚线槽）
              const heightPct = item.count === 0 ? 0 : Math.max(8, Math.round((item.count / maxCount) * 100));
              const isCurrentStarSelected = selectedStar === item.star;

              // 蓝色渐变系列：5星深蓝 #1B58A1, 4星中蓝 #3A70AC, 3星灰蓝 #91AECF，1-2星差评/预警状态保留柔和橙红 #E05D52
              const barColor = item.star === 5
                ? 'bg-[#1B58A1]'
                : item.star === 4
                  ? 'bg-[#3A70AC]'
                  : item.star === 3
                    ? 'bg-[#91AECF]'
                    : item.star === 2
                      ? 'bg-[#F59E8B]'
                      : 'bg-[#E05D52]';

              return (
                <div 
                  key={item.star} 
                  onClick={() => setSelectedStar(selectedStar === item.star ? 'all' : item.star)}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between text-center ${
                    isCurrentStarSelected
                      ? 'ring-2 ring-[#1B58A1] bg-[#BCD7F5]/30 shadow-xs'
                      : isLight 
                        ? 'bg-[#F8FAFC] border-[#91AECF]/30 hover:border-[#1B58A1]/40 hover:bg-[#BCD7F5]/15' 
                        : 'bg-neutral-950/70 border-neutral-850 hover:border-neutral-700'
                  }`}
                  title={`点击筛选查看 ${item.star} 星评价`}
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-xs font-bold text-[#1B58A1]">
                      {item.star}★
                    </div>
                    <div className="font-mono text-[10px] opacity-70">
                      {item.count}
                    </div>
                  </div>

                  <div className="my-2">
                    <div className={`w-full rounded h-24 flex items-end justify-center p-0.5 border ${
                      item.count === 0
                        ? (isLight ? 'bg-transparent border-dashed border-[#91AECF]/50' : 'bg-transparent border-dashed border-neutral-800')
                        : (isLight ? 'bg-[#D8E4F0]/60 border-transparent' : 'bg-neutral-900 border-transparent')
                    }`}>
                      {heightPct > 0 && (
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-500 ${barColor}`} 
                          style={{ height: `${heightPct}%` }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] font-mono font-bold opacity-80 pt-0.5 border-t border-[#91AECF]/20">
                    {item.percentage}%
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`text-[10px] pt-1.5 border-t opacity-60 flex items-center justify-between ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-850'}`}>
            <span>* 点击卡片穿透样本</span>
            <span className="font-mono font-semibold text-[#1B58A1]">共 {filteredReviews.length} 条</span>
          </div>
        </div>

        {/* 右侧三分之二：留评时间趋势分析 */}
        <div className={`lg:col-span-2 p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-[#090911]' : 'text-white'}`}>
                  <Calendar className="h-4 w-4 text-[#1B58A1]" />
                  <span>留评时间趋势分析</span>
                </h2>
                <p className="text-[11px] opacity-60">
                  {timelineMode === 'monthly' 
                    ? '按月聚合呈现留评总量柱状分布与真实好评率双轴走势' 
                    : '按日聚合高精度呈现留评波形与爆发周期'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* 月度 / 日度 聚合切换按键 */}
                <div className={`flex items-center p-0.5 rounded-lg border ${
                  isLight ? 'bg-[#F0F6FC] border-[#91AECF]/40' : 'bg-neutral-950 border-neutral-800'
                }`}>
                  <button
                    onClick={() => setTimelineMode('monthly')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      timelineMode === 'monthly'
                        ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                        : isLight ? 'text-[#5A6E85] hover:text-[#090911]' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>按月聚合</span>
                  </button>
                  <button
                    onClick={() => setTimelineMode('daily')}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      timelineMode === 'daily'
                        ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                        : isLight ? 'text-[#5A6E85] hover:text-[#090911]' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>按日聚合</span>
                  </button>
                </div>

                <span className="text-[11px] opacity-60 font-mono hidden sm:inline">
                  {timelineMode === 'monthly' 
                    ? `共 ${dashboardData.monthlyComboTrends?.length || dashboardData.timelineTrends.length} 个月份` 
                    : `共 ${dashboardData.dailyTrends?.length || 0} 个日节点`}
                </span>
              </div>
            </div>
          </div>

          {/* 1. 按月聚合：柱状图 + 真实好评率折线图 (Combo Chart) */}
          {timelineMode === 'monthly' && (() => {
            const comboData = (dashboardData.monthlyComboTrends && dashboardData.monthlyComboTrends.length > 0)
              ? dashboardData.monthlyComboTrends
              : dashboardData.timelineTrends.map(t => ({
                  month: t.label,
                  label: t.label,
                  count: t.count,
                  positiveCount: Math.round(t.count * 0.8),
                  negativeCount: Math.round(t.count * 0.1),
                  positiveRate: 85,
                  avgRating: 4.6
                }));

            if (comboData.length === 0) {
              return (
                <div className="py-12 text-center text-xs opacity-50">
                  原始数据中未包含有效留评时间字段
                </div>
              );
            }

            const maxCount = Math.max(1, ...comboData.map(c => c.count));
            const hoveredItem = hoveredMonthlyIndex !== null ? comboData[hoveredMonthlyIndex] : null;

            // 1. 动态自适应 Y 轴下限 (Dynamic Min-Y)：使 90%~98% 之间的微小波动清晰显现
            const allRates = comboData.map(d => typeof d.positiveRate === 'number' ? d.positiveRate : 80);
            const rawMinRate = Math.min(...allRates);
            const rateMinY = Math.max(0, Math.min(85, Math.floor((rawMinRate - 4) / 5) * 5));
            const rateMaxY = 100;
            const rateRange = Math.max(10, rateMaxY - rateMinY);

            // SVG 布局尺寸
            const W = 800;
            const H = 210;
            const padL = 40;
            const padR = 48;
            const padT = 28;
            const padB = 30;
            const graphW = W - padL - padR;
            const graphH = H - padT - padB;
            const n = comboData.length;
            const slotW = graphW / Math.max(1, n);
            const barW = Math.max(16, Math.min(44, slotW * 0.52));

            // 计算各柱和折线坐标 (分层隔离：柱状图最高高度占据画布下半区 40%，折线图在上半区 48% 自由起伏，中间预留物理缓冲，彻底消除柱体与折线/文字重叠)
            const barMaxH = graphH * 0.40;
            const lineZoneH = graphH * 0.48;
            const points = comboData.map((d, i) => {
              const centerX = padL + i * slotW + slotW / 2;
              const barH = (d.count / maxCount) * barMaxH;
              const barY = padT + graphH - barH;
              const rate = typeof d.positiveRate === 'number' ? d.positiveRate : 80;
              // 动态自适应 Y 轴坐标计算 (限制在上半区)
              const lineY = padT + (1 - Math.max(0, Math.min(rateRange, rate - rateMinY)) / rateRange) * lineZoneH;

              // 环比分析与预警判定 (<90% 或 环比大幅下滑)
              const prevRate = i > 0 && typeof comboData[i - 1].positiveRate === 'number' ? comboData[i - 1].positiveRate : null;
              const rateDiff = prevRate !== null ? Number((rate - prevRate).toFixed(1)) : 0;
              const isWarning = rate < 90 || (prevRate !== null && rateDiff <= -2.5);

              return {
                ...d,
                rate,
                centerX,
                barX: centerX - barW / 2,
                barY,
                barH,
                lineY,
                rateDiff,
                isWarning
              };
            });

            const polylinePoints = points.map(p => `${p.centerX},${p.lineY}`).join(' ');
            const areaPath = `M ${points[0].centerX} ${padT + lineZoneH + 8} L ${points.map(p => `${p.centerX} ${p.lineY}`).join(' L ')} L ${points[points.length - 1].centerX} ${padT + lineZoneH + 8} Z`;

            return (
              <div className="space-y-2 pt-1">
                {/* 图例与实时 Hover 信息 */}
                <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-2">
                  <div className="flex items-center gap-3 sm:gap-4 text-[11px] flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-xs bg-[#1E528E] inline-block shadow-xs" />
                      <span className="font-semibold text-[#090911]">留评总量 (加深柱)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-3.5 bg-[#1B58A1] inline-block rounded-full" />
                      <span className="h-2 w-2 rounded-full bg-[#1B58A1] border border-white inline-block" />
                      <span className="opacity-80">好评率走势 (上半区独立折线)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#E05D52] ring-2 ring-[#FCA5A5] inline-block" />
                      <span className="text-[#E05D52] font-bold text-xs">下滑/预警节点</span>
                    </span>
                  </div>

                  {hoveredItem ? (
                    <div className="flex items-center gap-3 text-xs bg-[#F0F6FC] border border-[#BCD7F5] px-2.5 py-0.5 rounded font-mono shadow-xs">
                      <span className="font-bold text-[#1B58A1]">{hoveredItem.month}</span>
                      <span>总量: <strong className="text-[#090911]">{hoveredItem.count}</strong> 条</span>
                      <span className="text-[#1B58A1]">好评率: <strong>{hoveredItem.positiveRate}%</strong></span>
                      <span className="opacity-70">评分: <strong>{hoveredItem.avgRating}★</strong></span>
                    </div>
                  ) : (
                    <span className="text-[11px] opacity-60">双轴独立分层呈现 · 鼠标悬浮查看精准明细</span>
                  )}
                </div>

                {/* 组合图表 SVG */}
                <div className={`rounded-xl border p-2 overflow-x-auto ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-850'}`}>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56 select-none">
                    <defs>
                      <linearGradient id="rateAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1B58A1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#1B58A1" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* 背景参考线 */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                      const y = padT + pct * graphH;
                      const countVal = Math.round(maxCount * (1 - pct));
                      // 动态自适应右轴好评率刻度
                      const rateVal = Math.round(rateMaxY - pct * rateRange);
                      return (
                        <g key={idx}>
                          <line 
                            x1={padL} 
                            y1={y} 
                            x2={W - padR} 
                            y2={y} 
                            stroke={isLight ? '#D8E4F0' : '#262626'} 
                            strokeDasharray="4 4" 
                          />
                          {/* 左轴: 评论量 */}
                          <text 
                            x={padL - 6} 
                            y={y + 3} 
                            fill={isLight ? '#5A6E85' : '#737373'} 
                            fontSize="9.5" 
                            textAnchor="end" 
                            fontFamily="monospace"
                          >
                            {countVal}
                          </text>
                          {/* 右轴: 好评率 (自适应刻度) */}
                          <text 
                            x={W - padR + 6} 
                            y={y + 3} 
                            fill="#1B58A1" 
                            fontSize="9.5" 
                            textAnchor="start" 
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {rateVal}%
                          </text>
                        </g>
                      );
                    })}

                    {/* 主次视觉分离：柱状图颜色加深且位于下半部防撞区 */}
                    {points.map((p, i) => {
                      const isHovered = hoveredMonthlyIndex === i;
                      return (
                        <g 
                          key={`bar-${i}`}
                          onMouseEnter={() => setHoveredMonthlyIndex(i)}
                          onMouseLeave={() => setHoveredMonthlyIndex(null)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={p.barX}
                            y={p.barY}
                            width={barW}
                            height={Math.max(4, p.barH)}
                            rx="4"
                            fill={isHovered ? '#0E3668' : '#1E528E'}
                            stroke={isHovered ? '#0A2547' : '#143C68'}
                            strokeWidth="1.5"
                            className="transition-all duration-200"
                          />
                          {/* 柱顶数字 (加粗加大至 13.5px，醒目清晰) */}
                          <text
                            x={p.centerX}
                            y={p.barY - 6}
                            fill={isLight ? '#0B1E38' : '#F1F5F9'}
                            fontSize="13.5"
                            textAnchor="middle"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {p.count}
                          </text>
                          {/* X 轴月份标签 */}
                          <text
                            x={p.centerX}
                            y={H - 10}
                            fill={isHovered ? '#1B58A1' : (isLight ? '#090911' : '#a3a3a3')}
                            fontSize="10"
                            textAnchor="middle"
                            fontWeight={isHovered ? 'bold' : '600'}
                            fontFamily="monospace"
                          >
                            {p.month}
                          </text>
                        </g>
                      );
                    })}

                    {/* 折线下方填充半透明的蓝色渐变面积 (Area Chart) */}
                    <path
                      d={areaPath}
                      fill="url(#rateAreaGrad)"
                    />

                    {/* 好评率折线加粗 (3.5px, 深蓝 #1B58A1) 凌空悬浮于上半区 */}
                    <polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="#1B58A1"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* 波动差异染色与预警圆点 + 下降幅度标出 */}
                    {points.map((p, i) => {
                      const isHovered = hoveredMonthlyIndex === i;
                      return (
                        <g 
                          key={`line-point-${i}`}
                          onMouseEnter={() => setHoveredMonthlyIndex(i)}
                          onMouseLeave={() => setHoveredMonthlyIndex(null)}
                          className="cursor-pointer"
                        >
                          {p.isWarning ? (
                            <>
                              {/* 预警柔和红橙色光晕 */}
                              <circle
                                cx={p.centerX}
                                cy={p.lineY}
                                r={isHovered ? 11 : 8}
                                fill="#E05D52"
                                fillOpacity="0.25"
                              />
                              {/* 预警实心圆点 */}
                              <circle
                                cx={p.centerX}
                                cy={p.lineY}
                                r={isHovered ? 6 : 5}
                                fill="#E05D52"
                                stroke="#FFFFFF"
                                strokeWidth="2"
                                className="transition-all duration-200"
                              />
                              {/* 标出下降幅度 (如 ▼ 4.2% 或 ⚠️ 88%) - 加大字号与背景框 */}
                              <g transform={`translate(${p.centerX}, ${p.lineY - 18})`}>
                                <rect
                                  x="-34"
                                  y="-13"
                                  width="68"
                                  height="22"
                                  rx="5"
                                  fill="#FFF1F0"
                                  stroke="#FCA5A5"
                                  strokeWidth="1.4"
                                />
                                <text
                                  x="0"
                                  y="3"
                                  fill="#E05D52"
                                  fontSize="13"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  fontFamily="monospace"
                                >
                                  {p.rateDiff < 0 ? `▼ ${Math.abs(p.rateDiff)}%` : `⚠️ ${p.rate}%`}
                                </text>
                              </g>
                            </>
                          ) : (
                            <>
                              <circle
                                cx={p.centerX}
                                cy={p.lineY}
                                r={isHovered ? 6 : 4}
                                fill="#1B58A1"
                                stroke={isLight ? '#ffffff' : '#171717'}
                                strokeWidth="2"
                                className="transition-all duration-200"
                              />
                              {isHovered && (
                                <g transform={`translate(${p.centerX}, ${p.lineY - 17})`}>
                                  <rect
                                    x="-28"
                                    y="-12"
                                    width="56"
                                    height="20"
                                    rx="4"
                                    fill="#F0F6FC"
                                    stroke="#BCD7F5"
                                    strokeWidth="1.2"
                                  />
                                  <text
                                    x="0"
                                    y="3"
                                    fill="#1B58A1"
                                    fontSize="12.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    fontFamily="monospace"
                                  >
                                    {p.rate}%
                                  </text>
                                </g>
                              )}
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* 2. 按日聚合：高精度折线走势图 (Daily Line Chart) */}
          {timelineMode === 'daily' && (() => {
            const dailyData = (dashboardData.dailyTrends && dashboardData.dailyTrends.length > 0)
              ? dashboardData.dailyTrends
              : [];

            if (dailyData.length === 0) {
              return (
                <div className="py-12 text-center text-xs opacity-50">
                  当前筛选样本数据量较小或未识别到具体留评日期，建议切回“按月聚合”查看
                </div>
              );
            }

            const maxDailyCount = Math.max(1, ...dailyData.map(d => d.count));
            const hoveredDaily = hoveredDailyIndex !== null ? dailyData[hoveredDailyIndex] : null;

            // SVG 布局
            const W = 800;
            const H = 190;
            const padL = 40;
            const padR = 25;
            const padT = 20;
            const padB = 30;
            const graphW = W - padL - padR;
            const graphH = H - padT - padB;
            const count = dailyData.length;

            const points = dailyData.map((d, i) => {
              const x = padL + (i / Math.max(1, count - 1)) * graphW;
              const y = padT + (1 - d.count / maxDailyCount) * graphH;
              return { ...d, x, y };
            });

            const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
            const areaPath = `M ${points[0].x} ${padT + graphH} L ${points.map(p => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${padT + graphH} Z`;

            return (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[11px] opacity-70">
                    按日高精度连续曲线 · 捕捉留评波动与爆发节点 (共 {count} 天)
                  </span>

                  {hoveredDaily ? (
                    <div className="flex items-center gap-3 text-xs bg-[#F0F6FC] border border-[#BCD7F5] px-2.5 py-0.5 rounded font-mono">
                      <span className="font-bold text-[#1B58A1]">{hoveredDaily.date}</span>
                      <span>当天留评: <strong>{hoveredDaily.count}</strong> 条</span>
                      <span className="text-[#1B58A1]">真实好评: <strong>{hoveredDaily.positiveRate}%</strong></span>
                      <span className="text-[#E05D52]">差评: <strong>{hoveredDaily.negativeCount}</strong></span>
                      <span className="opacity-70">评分: <strong>{hoveredDaily.avgRating}★</strong></span>
                    </div>
                  ) : (
                    <span className="text-[11px] opacity-50">鼠标悬浮折线节点查看当日真实统计</span>
                  )}
                </div>

                <div className={`rounded-xl border p-2 overflow-x-auto ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-850'}`}>
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 select-none">
                    <defs>
                      <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1B58A1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#BCD7F5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* 参考横线 */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                      const y = padT + pct * graphH;
                      const val = Math.round(maxDailyCount * (1 - pct));
                      return (
                        <g key={idx}>
                          <line 
                            x1={padL} 
                            y1={y} 
                            x2={W - padR} 
                            y2={y} 
                            stroke={isLight ? '#D8E4F0' : '#262626'} 
                            strokeDasharray="4 4" 
                          />
                          <text 
                            x={padL - 6} 
                            y={y + 3} 
                            fill={isLight ? '#5A6E85' : '#737373'} 
                            fontSize="9" 
                            textAnchor="end" 
                            fontFamily="monospace"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* 面积填充渐变 */}
                    <path d={areaPath} fill="url(#dailyAreaGrad)" />

                    {/* 连续走势折线 */}
                    <polyline
                      points={polylinePoints}
                      fill="none"
                      stroke="#1B58A1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* X 轴采样日期标注 (选取约 6-8 个均匀时间戳) */}
                    {points.map((p, i) => {
                      const step = Math.max(1, Math.floor(count / 7));
                      const isLast = i === count - 1;
                      if (i % step === 0 || isLast) {
                        return (
                          <text
                            key={`axis-label-${i}`}
                            x={p.x}
                            y={H - 8}
                            fill={isLight ? '#5A6E85' : '#a3a3a3'}
                            fontSize="9"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            {p.date.length > 5 ? p.date.substring(5) : p.date}
                          </text>
                        );
                      }
                      return null;
                    })}

                    {/* 节点交互圆点 */}
                    {points.map((p, i) => {
                      const isHovered = hoveredDailyIndex === i;
                      return (
                        <g
                          key={`daily-dot-${i}`}
                          onMouseEnter={() => setHoveredDailyIndex(i)}
                          onMouseLeave={() => setHoveredDailyIndex(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 6 : 3}
                            fill={isHovered ? '#1B58A1' : '#91AECF'}
                            stroke={isLight ? '#ffffff' : '#0f172a'}
                            strokeWidth={isHovered ? 2 : 1}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 清洗分流快速透视: 放置于评论证据上方，实现与评价证据表格的即时联动 */}
      <div className={`p-2.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
        isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900/60 border-neutral-800'
      }`}>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className={`text-[11px] font-semibold flex items-center gap-1 mr-1 ${isLight ? 'text-[#090911]' : 'text-neutral-400'}`}>
            <SlidersHorizontal className="h-3 w-3 text-[#1B58A1]" />
            <span>清洗分流快速透视:</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#BCD7F5]/40 text-[#1B58A1] font-normal">支持多选组合</span>
          </span>

          {[
            { id: 'all', label: `全量原始留评 (${cleaningSummary.total})` },
            { id: 'valid', label: `有效评论 (${cleaningSummary.validCount})` },
            { id: 'hidden_negative', label: `五星/四星隐性差评 (${cleaningSummary.hiddenCount})` },
            { id: 'coins', label: `凑字评论 (${cleaningSummary.coinsCount})` },
            { id: 'default', label: `系统默认无字 (${cleaningSummary.defaultCount})` },
            { id: 'fake', label: `疑似集中刷单 (${cleaningSummary.fakeClusterCount})` },
            { id: 'low_star', label: `显性低星差评 1-3★ (${cleaningSummary.lowStarCount})` }
          ].map(btn => {
            const isAll = btn.id === 'all';
            const active = isAll 
              ? selectedCleaningSegments.length === 0 
              : selectedCleaningSegments.includes(btn.id);

            return (
              <button
                key={btn.id}
                onClick={() => toggleCleaningSegment(btn.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#1B58A1] text-white font-semibold shadow-xs'
                    : isLight
                      ? 'bg-[#F8FAFC] text-[#5A6E85] border border-[#91AECF]/40 hover:bg-[#BCD7F5]/30 hover:text-[#090911]'
                      : 'bg-neutral-800 text-neutral-300 border border-neutral-750 hover:bg-neutral-700'
                }`}
                title={isAll ? '点击查看全量原始留评' : `点击${active ? '取消选择' : '多选加入'}该分类`}
              >
                {!isAll && (
                  <span className={`w-3.5 h-3.5 rounded-xs flex items-center justify-center border text-[9px] transition-colors ${
                    active ? 'border-white bg-white/20 text-white font-bold' : 'border-[#91AECF]/60 opacity-60'
                  }`}>
                    {active ? '✓' : ''}
                  </span>
                )}
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>

        {selectedCleaningSegments.length > 0 && (
          <button
            onClick={() => setSelectedCleaningSegments([])}
            className="text-xs text-[#1B58A1] hover:underline flex items-center gap-1 font-medium ml-auto cursor-pointer px-2 py-1 rounded hover:bg-[#BCD7F5]/20"
            title="清空当前多选，恢复全量"
          >
            <RotateCcw className="h-3 w-3" />
            <span>重置多选 (已选 {selectedCleaningSegments.length} 项)</span>
          </button>
        )}
      </div>

      {/* 第六行：评论证据 · 原始数据打标、情感方向与评论拆分
          彻底消除水平滚动条，穿透详情列同一个页面放下！
      */}
      <div className={`p-4 rounded-xl border space-y-4 ${
        isLight ? 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-[#91AECF]/30">
          <div>
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-[#090911]' : 'text-white'}`}>
              <Layers className="h-4 w-4 text-[#1B58A1]" />
              <span>评论证据 · 原始数据打标、情感方向与评论拆分</span>
            </h2>
            <p className="text-[11px] opacity-60">
              当前展示前 100 条 (共 {filteredReviews.length} 条) · 适配桌面同屏呈现，无需横向滚动即可点击【穿透详情】
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#1B58A1] bg-[#F0F6FC] px-2 py-0.5 rounded border border-[#BCD7F5]">
              Google Translate 神经翻译引擎
            </span>
          </div>
        </div>

        {/* 紧凑型数据表格 (table-fixed, 保证最后一列穿透详情完全一屏展示，绝无横向滚动) */}
        <div className={`border rounded-lg overflow-hidden ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <thead>
              <tr className={`font-semibold border-b ${
                isLight ? 'bg-[#D8E4F0]/70 text-[#090911] border-[#91AECF]/40' : 'bg-neutral-950 text-neutral-400 border-neutral-800'
              }`}>
                {/* 1. ID / 时间 (固定 125px) 支持按时间最新 / 最晚排序 */}
                <th className="py-2.5 px-2.5 w-[125px]">
                  <div className="flex items-center justify-between gap-1">
                    <span>ID / 时间</span>
                    <button
                      onClick={() => setTimeSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className={`px-1.5 py-0.5 rounded border flex items-center gap-1 text-[10px] cursor-pointer transition-colors ${
                        isLight 
                          ? 'bg-white border-[#91AECF]/40 hover:bg-[#BCD7F5]/30 text-[#1B58A1]' 
                          : 'bg-neutral-900 border-neutral-750 hover:bg-neutral-800 text-sky-400'
                      }`}
                      title={`当前留评时间：${timeSortOrder === 'desc' ? '最新优先' : '最晚/最早优先'}（点击切换）`}
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="font-mono text-[9px] font-semibold">{timeSortOrder === 'desc' ? '最新' : '最晚'}</span>
                    </button>
                  </div>
                </th>

                {/* 2. 表面星级 (固定 75px) */}
                <th className="py-2.5 px-2 w-[75px]">
                  <div className="flex items-center gap-1">
                    <span>星级</span>
                    <select
                      value={selectedStar}
                      onChange={(e) => setSelectedStar(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className={`rounded px-1 py-0.5 text-[10px] border ${
                        isLight ? 'bg-white text-[#090911] border-[#91AECF]/40' : 'bg-neutral-900 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      <option value="all">全</option>
                      <option value={5}>5★</option>
                      <option value={4}>4★</option>
                      <option value={3}>3★</option>
                      <option value={2}>2★</option>
                      <option value={1}>1★</option>
                    </select>
                  </div>
                </th>

                {/* 3. 评价内容 (原文 & 中文释义) 自适应占据剩余全部宽度 */}
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">买家评价内容 (原文 & Google完整译文)</span>
                  </div>
                </th>

                {/* 4. SKU / 规格 (固定 115px) */}
                <th className="py-2.5 px-2 w-[115px]">
                  <div className="flex items-center gap-1">
                    <span>SKU规格</span>
                    <select
                      value={selectedVariant}
                      onChange={(e) => setSelectedVariant(e.target.value)}
                      className={`rounded px-1 py-0.5 text-[10px] max-w-[65px] truncate border ${
                        isLight ? 'bg-white text-[#090911] border-[#91AECF]/40' : 'bg-neutral-900 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      <option value="all">全部</option>
                      {allVariants.map((v, i) => (
                        <option key={i} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </th>

                {/* 5. 情感方向 (固定 105px) */}
                <th className="py-2.5 px-2 w-[105px]">
                  <div className="flex items-center gap-1">
                    <span>情感方向</span>
                    <button
                      onClick={() => setSentimentGuideOpen(true)}
                      className="text-[#1B58A1] hover:opacity-80 p-0.5 cursor-pointer"
                      title="点击查看情感判定标准与隐性差评逻辑"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </th>

                {/* 6. 匹配标签与痛点 (固定 135px) */}
                <th className="py-2.5 px-2 w-[135px]">匹配标签与痛点</th>

                {/* 7. 穿透详情 (固定 85px，必须同一屏放下) */}
                <th className="py-2.5 px-2 w-[85px] text-center">穿透详情</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-[#91AECF]/20' : 'divide-neutral-850'}`}>
              {displayReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center opacity-50">
                    未找到符合筛选条件的评价证据
                  </td>
                </tr>
              ) : (
                displayReviews.slice(0, 100).map((review) => {
                  const isExpanded = Boolean(expandedReviewIds[review.id]);
                  const isHiddenNeg = review.hiddenNegativeCheck.isHiddenNegative;
                  const sentiment = isHiddenNeg ? '五星隐性差评' : (review.hiddenNegativeCheck.realSentiment === 'positive' ? '正向' : (review.hiddenNegativeCheck.realSentiment === 'negative' ? '负向' : '中立'));
                  const isSuspiciousZh = !review.contentZh || 
                    !/[\u4e00-\u9fa5]/.test(review.contentZh) ||
                    review.contentZh.trim().length <= 4 ||
                    review.contentZh.includes('好 好') ||
                    review.contentZh.startsWith(',,, 但是');

                  const contentChinese = (!isSuspiciousZh && /[\u4e00-\u9fa5]/.test(review.contentZh))
                    ? review.contentZh
                    : translateToChinese(review.content, review.language);

                  return (
                    <tr 
                      key={review.id}
                      className={`transition-colors ${
                        isHiddenNeg 
                          ? (isLight ? 'bg-[#FFF5F5] hover:bg-[#FEE2E2]/60' : 'bg-rose-950/20 hover:bg-rose-900/30') 
                          : (isLight ? 'hover:bg-[#F0F6FC]' : 'hover:bg-neutral-850/50')
                      }`}
                    >
                      {/* 1. ID / 时间 (第一列仅保留 ID 和时间数据) */}
                      <td className="py-3 px-2.5 align-top font-mono text-[11px] truncate">
                        <div className="font-bold truncate text-[#090911]">{review.id}</div>
                        <div className="text-[10px] opacity-75 font-mono mt-1 text-[#1B58A1] font-semibold">{review.reviewTime}</div>
                      </td>

                      {/* 2. 表面星级 */}
                      <td className="py-3 px-2 align-top">
                        <div className="flex items-center gap-0.5 font-mono text-[#1B58A1] font-bold">
                          <span>{review.rating}</span>
                          <span className="text-xs">★</span>
                        </div>
                      </td>

                      {/* 3. 评价内容 (原文 & 中文释义) - 保证全部翻译为准确中文 */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1.5 max-w-xl">
                          {/* 原文 */}
                          <p className={`leading-relaxed text-xs ${isExpanded ? '' : 'line-clamp-2'} ${
                            isLight ? 'text-[#090911]' : 'text-neutral-200'
                          }`}>
                            {review.content}
                          </p>

                          {/* 中文释义 (根据原文翻译为标准中文) */}
                          <p className={`text-[11px] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'} ${
                            isLight ? 'text-[#5A6E85]' : 'text-neutral-400'
                          }`}>
                            {contentChinese}
                          </p>

                          {/* 买家晒图缩略图 (放置于买家内容区下方) */}
                          {review.imageUrls && review.imageUrls.length > 0 && (
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {review.imageUrls.map((url, imgIdx) => (
                                <button
                                  key={imgIdx}
                                  onClick={() => setPreviewImageModalUrl(url)}
                                  className="relative rounded border border-[#91AECF]/40 overflow-hidden h-7 w-7 hover:scale-110 transition-transform cursor-pointer"
                                  title="点击查看买家原图"
                                >
                                  <img src={url} alt="buyer upload" className="h-full w-full object-cover" />
                                </button>
                              ))}
                              {review.imageUrls.length > 3 && (
                                <span className="text-[9px] opacity-60 font-mono">+{review.imageUrls.length - 3}</span>
                              )}
                            </div>
                          )}

                          {/* 买家元数据 + 展开/收起 + 重新翻译至中文 */}
                          <div className="flex items-center gap-2 text-[10px] opacity-60 pt-0.5">
                            <span>买家: {review.buyerName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{review.languageLabel === '未知/英文' ? '未知' : (review.languageLabel || '未知')}</span>
                            
                            <button
                              onClick={() => toggleExpand(review.id)}
                              className="text-[#1B58A1] hover:underline cursor-pointer ml-auto"
                            >
                              {isExpanded ? '收起' : '展开全文'}
                            </button>

                            <button
                              onClick={() => handleManualReanalyze(review)}
                              disabled={retranslatingIds[review.id]}
                              className="text-[#1B58A1] hover:underline cursor-pointer flex items-center gap-1 font-semibold ml-2 px-1.5 py-0.5 rounded bg-[#F0F6FC] hover:bg-[#BCD7F5]/40 border border-[#BCD7F5]/80 transition-colors"
                              title="点击由后端大模型深度重新分析：同步刷新精准中文翻译、真实情感方向与匹配标签"
                            >
                              <Sparkles className={`h-3 w-3 ${retranslatingIds[review.id] ? 'animate-spin text-amber-500' : 'text-[#1B58A1]'}`} />
                              <span>{retranslatingIds[review.id] ? 'AI 分析中...' : '重新 AI 分析'}</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 4. SKU / 规格 */}
                      <td className="py-3 px-2 align-top text-[11px] font-mono break-words">
                        <span title={review.sku} className="text-[#090911]">{review.sku || '默认'}</span>
                      </td>

                      {/* 5. 情感方向 */}
                      <td className="py-3 px-2 align-top">
                        {review.customSentimentLabel ? (
                          <div className="space-y-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-0.5 ${
                              review.customSentimentLabel.includes('隐性差评') || review.customSentimentLabel.includes('差评') || review.customSentimentLabel.includes('不满')
                                ? 'bg-[#FFF5F5] text-[#E05D52] border-[#FCA5A5]'
                                : (review.customSentimentLabel.includes('正向') || review.customSentimentLabel.includes('满意')
                                    ? 'bg-[#F0F6FC] text-[#1B58A1] border-[#BCD7F5]'
                                    : 'bg-[#F8FAFC] text-[#5A6E85] border-[#91AECF]/30')
                            }`}>
                              {review.customSentimentLabel.includes('差评') || review.customSentimentLabel.includes('不满') ? (
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                              )}
                              <span>{review.customSentimentLabel}</span>
                            </span>
                            {review.analyzedModel && (
                              <div className="text-[9px] font-mono text-[#1B58A1] opacity-80 flex items-center gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" />
                                <span>{review.analyzedModel}</span>
                              </div>
                            )}
                          </div>
                        ) : isHiddenNeg ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFF5F5] text-[#E05D52] border border-[#FCA5A5] inline-flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>{review.rating >= 5 ? '五星隐性差评' : '四星隐性差评'}</span>
                          </span>
                        ) : sentiment === '正向' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F0F6FC] text-[#1B58A1] border border-[#BCD7F5] inline-flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>正向满意</span>
                          </span>
                        ) : sentiment === '负向' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FFF1F0] text-[#E05D52] border border-[#FCA5A5]">
                            {review.rating <= 2 ? '严重差评' : '负向不满'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F8FAFC] text-[#5A6E85] border border-[#91AECF]/30">
                            中立观望
                          </span>
                        )}
                      </td>

                      {/* 6. 匹配标签与痛点 */}
                      <td className="py-3 px-2 align-top">
                        <div className="space-y-1">
                          {review.topics.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {review.topics.map((t, idx) => (
                                <span key={idx} className={`px-1.5 py-0.2 rounded text-[10px] border ${
                                  isLight ? 'bg-[#F8FAFC] text-[#5A6E85] border-[#91AECF]/30' : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                }`}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {review.hiddenNegativeCheck.extractedGrievances.length > 0 && (
                            <div className="space-y-0.5">
                              {review.hiddenNegativeCheck.extractedGrievances.map((g, idx) => (
                                <div key={idx} className="text-[10px] text-[#E05D52] bg-[#FFF1F0] px-1 py-0.5 rounded border border-[#FCA5A5] leading-tight">
                                  痛点: {g}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 7. 穿透详情按钮 (同一页面放下，无需滑动) */}
                      <td className="py-3 px-2 align-top text-center">
                        <button
                          onClick={() => setActiveDrilldownReview(review)}
                          className="px-2 py-1 text-xs rounded bg-[#F0F6FC] hover:bg-[#1B58A1] text-[#1B58A1] hover:text-white border border-[#BCD7F5] transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>穿透</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 模态弹窗1：评论证据穿透详情 · 深度诊断 */}
      {activeDrilldownReview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-lg border ${
                  isLight ? 'bg-[#1B58A1]/10 text-[#1B58A1] border-[#BCD7F5]' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                }`}>
                  <Layers className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">评论证据穿透详情 · 深度诊断</h3>
                  <p className="text-xs opacity-60 font-mono">
                    ID: {activeDrilldownReview.id} · 来源: {activeDrilldownReview.platform.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDrilldownReview(null)}
                className="p-1.5 rounded hover:opacity-80 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 核心元信息条 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">表面评分</span>
                <div className={`text-sm font-bold font-mono flex items-center gap-1 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>
                  <span>{activeDrilldownReview.rating} 星</span>
                  <span>★</span>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">真实情感校准</span>
                <div className="text-xs font-bold">
                  {activeDrilldownReview.hiddenNegativeCheck.isHiddenNegative ? (
                    <span className="text-[#E05D52]">五星隐性差评</span>
                  ) : activeDrilldownReview.hiddenNegativeCheck.realSentiment === 'positive' ? (
                    <span className="text-[#1B58A1]">正向满意好评</span>
                  ) : (
                    <span className="opacity-80">中立/负向</span>
                  )}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">留评日期</span>
                <div className="text-xs font-mono opacity-80">
                  {activeDrilldownReview.reviewTime || '未知'}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">购买规格 (SKU)</span>
                <div className="text-xs font-mono opacity-80 truncate" title={activeDrilldownReview.sku}>
                  {activeDrilldownReview.sku || '默认'}
                </div>
              </div>
            </div>

            {/* 买家晒图实拍画廊 */}
            {activeDrilldownReview.imageUrls && activeDrilldownReview.imageUrls.length > 0 && (
              <div className="space-y-1.5">
                <div className={`flex items-center gap-1 text-xs font-semibold ${isLight ? 'text-[#1B58A1]' : 'text-sky-400'}`}>
                  <ImageIcon className="h-4 w-4" />
                  <span>买家评价实拍图片 ({activeDrilldownReview.imageUrls.length}张)</span>
                </div>
                <div className={`flex flex-wrap gap-2 p-3 rounded-lg border ${
                  isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950/40 border-neutral-800'
                }`}>
                  {activeDrilldownReview.imageUrls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewImageModalUrl(url)}
                      className={`h-20 w-20 rounded-lg border overflow-hidden hover:scale-105 transition-transform cursor-pointer ${
                        isLight ? 'border-[#91AECF]/40' : 'border-neutral-700'
                      }`}
                    >
                      <img src={url} alt="buyer upload" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 买家评价原文 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold opacity-80">
                <span>买家原始留评内容 (原文)</span>
                <span className="text-[10px] font-mono opacity-60">语言: {activeDrilldownReview.languageLabel === '未知/英文' ? '未知' : (activeDrilldownReview.languageLabel || '未知')}</span>
              </div>
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]' : 'bg-neutral-950 border-neutral-800'
              }`}>
                {activeDrilldownReview.content}
              </div>
            </div>

            {/* Google 完整逐句译文 */}
            <div className="space-y-1.5">
              <div className={`text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Google Translate 逐句完整译文</span>
              </div>
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isLight ? 'bg-[#F0F6FC] border-[#BCD7F5] text-[#090911]' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
              }`}>
                {activeDrilldownReview.contentZh || '无额外释义'}
              </div>
            </div>

            {/* 匹配标签与客诉痛点 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold opacity-80">命中的智能标签与痛点识别</div>
              <div className="flex flex-wrap gap-1.5">
                {activeDrilldownReview.topics.map((t, i) => (
                  <span key={i} className={`px-2 py-1 text-xs rounded border ${
                    isLight ? 'bg-[#F0F6FC] text-[#1B58A1] border-[#BCD7F5]' : 'bg-neutral-800 text-neutral-200 border-neutral-700'
                  }`}>
                    主题: {t}
                  </span>
                ))}
                {activeDrilldownReview.hiddenNegativeCheck.extractedGrievances.map((g, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded bg-[#FFF1F0] text-[#E05D52] border border-[#FCA5A5]">
                    客诉痛点: {g}
                  </span>
                ))}
              </div>
            </div>

            {/* 判定标准依据与运营应对建议 */}
            <div className={`p-3 rounded-lg border space-y-1.5 text-xs ${
              isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <div className={`font-semibold flex items-center gap-1.5 ${isLight ? 'text-[#1B58A1]' : 'text-sky-400'}`}>
                <ShieldAlert className="h-4 w-4" />
                <span>算法判定依据与建议策略</span>
              </div>
              <p className="opacity-80 leading-relaxed">
                {activeDrilldownReview.hiddenNegativeCheck.businessImpact}
              </p>
            </div>

            <div className={`flex justify-end pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <button
                onClick={() => setActiveDrilldownReview(null)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
              >
                关闭穿透窗口
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态弹窗2：原始表格数据明细全屏在线预览 (解决点击原始表格打开的需求) */}
      {previewRawTableRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl p-6 space-y-4 ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className={`h-5 w-5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`} />
                <div>
                  <h3 className="text-sm font-bold">原始导表全量明细预览 · {previewRawTableRecord.fileName}</h3>
                  <p className="text-xs opacity-60 font-mono">
                    共 {previewRawTableRecord.reviews.length} 行数据 · 导入时间: {previewRawTableRecord.importTime}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadOriginalExcel(previewRawTableRecord)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white font-medium transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>导出原Excel</span>
                </button>
                <button
                  onClick={() => setPreviewRawTableRecord(null)}
                  className="p-1.5 rounded hover:opacity-80 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 原始数据网格 */}
            <div className={`flex-1 overflow-auto border rounded-lg text-xs ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`font-medium border-b sticky top-0 ${
                    isLight ? 'bg-[#91AECF]/15 text-[#090911] border-[#91AECF]/30' : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                  }`}>
                    <th className="py-2.5 px-3 whitespace-nowrap">序号</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">评价ID</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">星级</th>
                    <th className="py-2.5 px-3 min-w-[280px]">评价原文</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">规格SKU</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">买家昵称</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">留评时间</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">图片链接</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isLight ? 'divide-[#91AECF]/20' : 'divide-neutral-850'}`}>
                  {previewRawTableRecord.reviews.map((r, idx) => (
                    <tr key={idx} className={isLight ? 'hover:bg-[#D8E4F0]/30' : 'hover:bg-neutral-850/50'}>
                      <td className="py-2.5 px-3 font-mono opacity-60">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono opacity-80 whitespace-nowrap">{r.id}</td>
                      <td className={`py-2.5 px-3 font-bold whitespace-nowrap ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>{r.rating}★</td>
                      <td className="py-2.5 px-3">{r.content}</td>
                      <td className="py-2.5 px-3 font-mono opacity-80 whitespace-nowrap">{r.sku}</td>
                      <td className="py-2.5 px-3 opacity-80 whitespace-nowrap">{r.buyerName}</td>
                      <td className="py-2.5 px-3 font-mono opacity-60 whitespace-nowrap">{r.reviewTime}</td>
                      <td className={`py-2.5 px-3 font-mono text-[10px] max-w-[120px] truncate ${isLight ? 'text-[#1B58A1]' : 'text-sky-400'}`}>
                        {r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`flex justify-between items-center pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <span className="text-xs opacity-60 font-mono">
                当前表格已完全在本地缓存，您可以随时切换或导出
              </span>
              <button
                onClick={() => setPreviewRawTableRecord(null)}
                className={`px-4 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                  isLight ? 'bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态弹窗3：单张买家晒图大图预览 */}
      {previewImageModalUrl && (
        <div 
          onClick={() => setPreviewImageModalUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-xl max-h-[85vh] rounded-xl overflow-hidden shadow-2xl border border-neutral-700" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImageModalUrl(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewImageModalUrl} alt="large view" className="max-h-[80vh] w-auto object-contain" />
          </div>
        </div>
      )}

      {/* 模态弹窗4：情感判定标准说明 */}
      {sentimentGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <Info className={`h-5 w-5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`} />
                <h3 className="text-sm font-bold">评价情感方向判定标准说明</h3>
              </div>
              <button onClick={() => setSentimentGuideOpen(false)} className="opacity-60 hover:opacity-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs opacity-90 leading-relaxed">
              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-[#1B58A1]' : 'text-emerald-400'}`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>1. 正向满意 (Positive)</span>
                </div>
                <p className="opacity-70">
                  买家给出 4~5 星，正文中包含明确的正向赞美词（如“安装方便、自重轻、动力强、发货快”等），且无任何质量抱怨或“但是/可惜”转折句型。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-[#FFF5F5] border-[#FCA5A5]/60' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-[#E05D52] flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>2. 五星/四星隐性差评 (Hidden Negative)</span>
                </div>
                <p className="opacity-70">
                  东南亚特色人情给分。买家表面给出 4~5 星高分（多为赚取平台金币、给快递员辛苦分或鼓励店家负责的售后态度），但在正文中使用了明确的转折连词（如但/可是/可惜/แต่/tapi）或直白指出了电池充不进电、BMS故障、链条易脱扣、卡扣脆裂等关键痛点。系统强制校准为负向不满。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-[#FFF5F5] border-[#FCA5A5]/60' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-[#E05D52] flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>3. 负向不满 (Negative)</span>
                </div>
                <p className="opacity-70">
                  显性低星差评（1~2 星），或正文中直接表达强烈的退货、投诉、货不对板、质量故障等严重不满。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-[#91AECF]' : 'text-yellow-500'}`}>
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>4. 中立观望 (Neutral)</span>
                </div>
                <p className="opacity-70">
                  买家给出 3 星，或评论仅描述客观签收事实（如“收到货了”、“刚开始用”），无明显正负情绪偏向。
                </p>
              </div>
            </div>

            <div className={`flex justify-end pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <button
                onClick={() => setSentimentGuideOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                我已了解
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态弹窗5：历史记录管理抽屉 */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <History className={`h-5 w-5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`} />
                <h3 className="text-sm font-bold">历史导入表格记录 (支持点击跳转打开原始表格)</h3>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="opacity-60 hover:opacity-100 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs opacity-70">
              点击任何一份历史表格的【查看原表】，可在线全量浏览原始导表字段；或点击【切换载入】切换至该表格进行全盘分析：
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {historyList.length === 0 ? (
                <div className="py-8 text-center text-xs opacity-50">
                  暂无历史记录，直接拖入 Excel 表格即可生成记录
                </div>
              ) : (
                historyList.map((item) => {
                  const isCurrent = item.fileName === currentFileName;
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${
                        isCurrent 
                          ? (isLight ? 'bg-[#F0F6FC] border-[#BCD7F5] ring-1 ring-[#1B58A1]' : 'bg-[#1B58A1]/10 border-[#1B58A1]/50 ring-1 ring-[#1B58A1]/30')
                          : (isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 hover:border-[#1B58A1]/40' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700')
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isCurrent ? (isLight ? 'text-[#1B58A1]' : 'text-amber-400') : 'opacity-50'}`} />
                          <button
                            onClick={() => {
                              setPreviewRawTableRecord(item);
                              setHistoryModalOpen(false);
                            }}
                            className={`text-xs font-semibold truncate max-w-[240px] text-left hover:underline cursor-pointer ${
                              isLight ? 'text-[#090911] hover:text-[#1B58A1]' : 'hover:text-amber-400'
                            }`}
                            title="点击打开此原始表格"
                          >
                            {item.fileName}
                          </button>
                          {isCurrent && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              isLight ? 'bg-[#1B58A1] text-white' : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                            }`}>
                              当前载入
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] opacity-70 font-mono">
                          <span>导入: {item.importTime}</span>
                          <span>数据量: {item.rowCount} 行</span>
                          <span>均星: {item.avgRating?.toFixed(1) || '-'} ★</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setPreviewRawTableRecord(item);
                            setHistoryModalOpen(false);
                          }}
                          className={`px-2 py-1 text-xs rounded border font-medium cursor-pointer ${
                            isLight 
                              ? 'border-[#91AECF]/40 bg-white text-[#1B58A1] hover:bg-[#D8E4F0]/30' 
                              : 'border-neutral-700 hover:bg-neutral-800 text-sky-400'
                          }`}
                        >
                          查看原表
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => {
                              onSelectHistory(item);
                              setHistoryModalOpen(false);
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white font-medium cursor-pointer shadow-xs"
                          >
                            切换载入
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteHistory(item.id)}
                          className="p-1 rounded opacity-60 hover:text-[#E05D52] transition-colors cursor-pointer"
                          title="删除该条历史"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={`flex justify-end pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态弹窗6：环形图点击某一维度动态放大透视弹窗 (实现点击某一维度可以放大该维度的图以及数据与动态效果) */}
      {zoomedRing && (() => {
        interface RingSlice {
          key: string;
          label: string;
          count: number;
          percentage: number;
          color: string;
          description: string;
        }

        let slices: RingSlice[] = [];

        if (zoomedRing.chartType === 'star_satisfaction') {
          const { positive, positivePercent, negative, negativePercent, neutral, neutralPercent } = dashboardData.satisfaction.byStar;
          slices = [
            { key: 'positive', label: '4-5星满意', count: positive, percentage: positivePercent, color: '#1B58A1', description: '表面评分给足 4~5 星的高满意度好评' },
            { key: 'negative', label: '1-2星差评', count: negative, percentage: negativePercent, color: '#E05D52', description: '表面评分仅为 1~2 星的强烈不满低星差评' },
            { key: 'neutral', label: '3星中立', count: neutral, percentage: neutralPercent, color: '#91AECF', description: '表面评分 3 星的观望或体验平平评价' },
          ];
        } else if (zoomedRing.chartType === 'content_satisfaction') {
          const { positive, positivePercent, negative, negativePercent, neutral, neutralPercent } = dashboardData.satisfaction.byContent;
          slices = [
            { key: 'positive', label: '真实满意好评', count: positive, percentage: positivePercent, color: '#1B58A1', description: '经过自然语言文本解析，无转折且全为正面肯定的真实口碑' },
            { key: 'negative', label: '不满/含隐性差评', count: negative, percentage: negativePercent, color: '#E05D52', description: '包含 1-2 星硬差评 + 五星/四星人情掩饰但文字痛骂的关键客诉' },
            { key: 'neutral', label: '中立观望评价', count: neutral, percentage: neutralPercent, color: '#91AECF', description: '文本仅描述到货或无明显情绪倾向的中立评价' },
          ];
        } else {
          slices = dashboardData.variants.map(v => ({
            key: v.variant,
            label: v.variant,
            count: v.count,
            percentage: v.percentage,
            color: v.color,
            description: `购买规格为 ${v.variant} 的买家留评结构`
          }));
        }

        const activeSlice = slices.find(s => s.key === zoomedRing.activeDimensionKey) || slices[0];

        // 筛选出匹配当前选中维度的真实评价样本
        const matchingReviews = reviews.filter(r => {
          if (zoomedRing.chartType === 'star_satisfaction') {
            if (activeSlice.key === 'positive') return r.rating >= 4;
            if (activeSlice.key === 'negative') return r.rating <= 2;
            return r.rating === 3;
          } else if (zoomedRing.chartType === 'content_satisfaction') {
            if (activeSlice.key === 'positive') return r.hiddenNegativeCheck.realSentiment === 'positive' && !r.hiddenNegativeCheck.isHiddenNegative;
            if (activeSlice.key === 'negative') return r.hiddenNegativeCheck.realSentiment === 'negative' || r.hiddenNegativeCheck.isHiddenNegative;
            return r.hiddenNegativeCheck.realSentiment === 'neutral' && !r.hiddenNegativeCheck.isHiddenNegative;
          } else {
            return r.sku === activeSlice.key || (r.rawRow && (r.rawRow['规格SKU'] === activeSlice.key || r.rawRow['Variation'] === activeSlice.key));
          }
        });

        // 动态大环形 SVG 参数
        const R = 85;
        const CIRC = 2 * Math.PI * R;
        let runningOffset = 0;

        // 该维度的平均星级
        const avgRatingOfDimension = matchingReviews.length > 0 
          ? (matchingReviews.reduce((sum, r) => sum + r.rating, 0) / matchingReviews.length).toFixed(1)
          : '-';

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className={`border rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden ${
              isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
            }`}>
              {/* 弹窗头部 */}
              <div className={`p-4 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg border ${
                    isLight ? 'bg-[#1B58A1]/10 text-[#1B58A1] border-[#BCD7F5]' : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                  }`}>
                    <PieChart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{zoomedRing.chartTitle}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        isLight ? 'bg-[#1B58A1] text-white' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}>
                        动态深度透视
                      </span>
                    </div>
                    <p className="text-xs opacity-60">
                      点击环形切片或上方标签可随时切换下钻维度，数据与买家评价实时联动
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setZoomedRing(null)}
                  className={`p-1.5 rounded-lg hover:opacity-80 transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-[#D8E4F0]/50 text-[#090911]' : 'hover:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 维度切换快速标签栏 */}
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 overflow-x-auto ${
                isLight ? 'bg-[#F0F6FC]/60 border-[#91AECF]/30' : 'bg-neutral-950/60 border-neutral-850'
              }`}>
                <span className="text-xs opacity-60 shrink-0 font-medium">切换透视维度:</span>
                {slices.map((s) => {
                  const isActive = s.key === activeSlice.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setZoomedRing({ ...zoomedRing, activeDimensionKey: s.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border ${
                        isActive
                          ? 'shadow-sm text-white font-bold'
                          : (isLight ? 'bg-white hover:bg-[#F8FAFC] text-[#090911] border-[#91AECF]/40' : 'bg-neutral-900 hover:bg-neutral-855 text-neutral-300 border-neutral-800')
                      }`}
                      style={isActive ? { backgroundColor: s.color, borderColor: s.color } : {}}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? '#ffffff' : s.color }} />
                      <span className="truncate max-w-[140px]">{s.label}</span>
                      <span className="font-mono text-[11px] opacity-80">({s.count}条 · {s.percentage}%)</span>
                    </button>
                  );
                })}
              </div>

              {/* 弹窗内容区：滚动容器 */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {/* 上半部：大尺寸动态环形图 + 核心指标深度透视 */}
                <div className={`p-5 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-6 items-center ${
                  isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30 shadow-xs' : 'bg-neutral-950/70 border-neutral-800'
                }`}>
                  {/* 左侧：动态高分辨率大尺寸环形图 */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-56 h-56 transform -rotate-90">
                        {/* 背景底圈 */}
                        <circle
                          cx="112"
                          cy="112"
                          r={R}
                          stroke={isLight ? '#D8E4F0' : '#1e293b'}
                          strokeWidth="22"
                          fill="none"
                        />
                        {/* 动态切片 */}
                        {slices.map((s, idx) => {
                          const strokeLen = (s.percentage / 100) * CIRC;
                          const offset = -runningOffset;
                          runningOffset += strokeLen;
                          const isActive = s.key === activeSlice.key;

                          return (
                            <circle
                              key={idx}
                              cx="112"
                              cy="112"
                              r={R}
                              stroke={s.color}
                              strokeWidth={isActive ? 30 : 20}
                              strokeDasharray={`${strokeLen} ${CIRC}`}
                              strokeDashoffset={offset}
                              fill="none"
                              className="transition-all duration-300 cursor-pointer hover:opacity-95"
                              style={{
                                filter: isActive ? `drop-shadow(0 0 8px ${s.color}88)` : 'none',
                                opacity: isActive ? 1 : 0.65
                              }}
                              onClick={() => setZoomedRing({ ...zoomedRing, activeDimensionKey: s.key })}
                            />
                          );
                        })}
                      </svg>

                      {/* 环心动态聚焦数据 */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none px-4">
                        <span className="text-3xl font-extrabold font-mono tracking-tight" style={{ color: activeSlice.color }}>
                          {activeSlice.percentage}%
                        </span>
                        <span className="text-xs font-bold mt-0.5 truncate max-w-[130px] leading-tight text-[#090911]" title={activeSlice.label}>
                          {activeSlice.label}
                        </span>
                        <span className="text-[11px] opacity-60 font-mono mt-0.5">
                          {activeSlice.count} 条买家评价
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] opacity-50 mt-2 font-mono">
                      * 可直接点击任意环形切片即时放大切换
                    </span>
                  </div>

                  {/* 右侧：该维度的深度洞察与动作 */}
                  <div className="md:col-span-7 space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: activeSlice.color }} />
                        <h4 className="text-base font-bold text-[#090911]">{activeSlice.label} · 维度全息穿透</h4>
                      </div>
                      <p className="text-xs opacity-70 mt-1 leading-relaxed">
                        {activeSlice.description}
                      </p>
                    </div>

                    {/* 关键统计指标卡 */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-[#91AECF]/30 shadow-xs' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">样本数量</div>
                        <div className={`text-lg font-bold font-mono mt-0.5 ${isLight ? 'text-[#1B58A1]' : 'text-sky-400'}`}>
                          {activeSlice.count} <span className="text-xs font-normal opacity-70">条</span>
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-[#91AECF]/30 shadow-xs' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">总体占比</div>
                        <div className={`text-lg font-bold font-mono mt-0.5 ${isLight ? 'text-[#090911]' : 'text-amber-400'}`}>
                          {activeSlice.percentage}%
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-[#91AECF]/30 shadow-xs' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">均星评分</div>
                        <div className={`text-lg font-bold font-mono mt-0.5 ${isLight ? 'text-[#1B58A1]' : 'text-emerald-400'}`}>
                          {avgRatingOfDimension} <span className="text-xs font-normal">★</span>
                        </div>
                      </div>
                    </div>

                    {/* 一键锁定筛选器 */}
                    <div className="pt-1 flex items-center justify-between gap-3">
                      <p className="text-[11px] opacity-60 leading-tight">
                        需要聚焦该维度进行全盘交叉分析？点击右侧即可将看板全局筛选器同步为此维度：
                      </p>
                      <button
                        onClick={() => {
                          if (zoomedRing.chartType === 'star_satisfaction') {
                            if (activeSlice.key === 'positive') setSelectedStar(5);
                            else if (activeSlice.key === 'negative') setSelectedStar(1);
                            else setSelectedStar(3);
                          } else if (zoomedRing.chartType === 'content_satisfaction') {
                            if (activeSlice.key === 'positive') setSelectedSentiment('positive');
                            else if (activeSlice.key === 'negative') setSelectedSentiment('negative');
                            else setSelectedSentiment('neutral');
                          } else {
                            setSelectedVariant(activeSlice.key);
                          }
                          setZoomedRing(null);
                        }}
                        className="px-3.5 py-1.5 text-xs rounded-lg font-semibold bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white shrink-0 transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Filter className="h-3.5 w-3.5" />
                        <span>锁定此维度筛选</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 下半部：该维度匹配的买家真实评价样本明细 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className={`h-3.5 w-3.5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`} />
                      <span>该维度匹配买家原始评价样本 (共 {matchingReviews.length} 条，展示代表性留评)</span>
                    </h4>
                    <span className="text-[11px] font-mono opacity-60">严格按原始数据渲染 · 杜绝编造</span>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {matchingReviews.length === 0 ? (
                      <div className="py-8 text-center text-xs opacity-50">
                        当前维度暂无匹配评价
                      </div>
                    ) : (
                      matchingReviews.slice(0, 15).map((r) => (
                        <div
                          key={r.id}
                          className={`p-3 rounded-lg border space-y-1.5 transition-colors ${
                            isLight ? 'bg-white border-[#91AECF]/30 hover:border-[#1B58A1]/40' : 'bg-neutral-950 border-neutral-850 hover:border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>{r.rating}★</span>
                              <span className="font-semibold">{r.buyerName}</span>
                              <span className="font-mono opacity-60 text-[10px]">规格: {r.sku || '默认'}</span>
                              <span className="font-mono opacity-50 text-[10px]">{r.reviewTime}</span>
                            </div>
                            <button
                              onClick={() => {
                                setActiveDrilldownReview(r);
                                setZoomedRing(null);
                              }}
                              className={`text-[11px] hover:underline flex items-center gap-0.5 cursor-pointer font-medium ${
                                isLight ? 'text-[#1B58A1]' : 'text-sky-400'
                              }`}
                            >
                              <Eye className="h-3 w-3" />
                              <span>穿透详情</span>
                            </button>
                          </div>

                          {/* 原文 */}
                          <p className={`text-xs leading-relaxed ${isLight ? 'text-[#090911]' : 'text-neutral-200'}`}>
                            {r.content}
                          </p>

                          {/* 译文 */}
                          {r.contentZh && (
                            <p className={`text-[11px] leading-relaxed pt-0.5 ${isLight ? 'text-[#5A6E85]' : 'text-neutral-400'}`}>
                              <span className={`font-medium ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>中文释义: </span>
                              {r.contentZh}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 弹窗底部 */}
              <div className={`p-3.5 border-t flex justify-end ${
                isLight ? 'bg-[#F8FAFC] border-[#91AECF]/30' : 'bg-neutral-950 border-neutral-800'
              }`}>
                <button
                  onClick={() => setZoomedRing(null)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    isLight ? 'bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  关闭透视窗口
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 模态弹窗3：批量直接粘贴评论语料 (合并自清洗模块) */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-lg border ${
                  isLight ? 'bg-[#1B58A1]/10 text-[#1B58A1] border-[#BCD7F5]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">批量直接粘贴评论语料 (即贴即分析)</h3>
                  <p className="text-xs opacity-60">支持从 Excel、飞书文档、TXT 复制多行评论直接粘贴分析</p>
                </div>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="p-1 rounded hover:opacity-80 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium opacity-80 block">
                评论文本内容 (每行一条；支持以 Tab 或逗号分隔：内容 \t 星级 \t 规格变体)：
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={"例如：\nBarang sangat bagus, cepat sampai\t5\t黑色升级款\nBagus tapi agak lambat\t4\t白色基础款\nKecewa banget bahannya tipis\t1\t红色"}
                rows={8}
                className={`w-full p-3 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#1B58A1]/50 ${
                  isLight ? 'bg-[#F8FAFC] border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
                }`}
              />
              <p className="text-[11px] opacity-60">
                系统将自动对粘贴文本进行东南亚多语言识别、智能清洗（剔除凑字废话与水军）以及大盘多维指标实时计算。
              </p>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <button
                onClick={() => setPasteModalOpen(false)}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                  isLight ? 'border-[#91AECF]/40 hover:bg-[#D8E4F0]/30 text-[#090911]' : 'border-neutral-700 hover:bg-neutral-800 text-white'
                }`}
              >
                取消
              </button>
              <button
                onClick={handlePastedData}
                disabled={!pastedText.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                解析并导入大盘分析
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态弹窗4：协同分享工作台 */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl ${
            isLight ? 'bg-white border-[#91AECF]/40 text-[#090911]' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-lg border ${
                  isLight ? 'bg-[#1B58A1]/10 text-[#1B58A1] border-[#BCD7F5]' : 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                }`}>
                  <Share2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">分享与协同分析工作台</h3>
                  <p className="text-xs opacity-60">将此分析控制台无缝共享给运营与产品同事</p>
                </div>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded hover:opacity-80 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-medium opacity-80 block">工作台直接访问链接：</span>
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                  isLight ? 'bg-[#F8FAFC] border-[#91AECF]/40' : 'bg-neutral-950 border-neutral-800'
                }`}>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="bg-transparent text-xs font-mono w-full focus:outline-none"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-1 text-xs font-semibold rounded bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white shrink-0 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedLink ? '已复制！' : '复制链接'}
                  </button>
                </div>
              </div>

              <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                isLight ? 'bg-[#F0F6FC] border-[#BCD7F5] text-[#090911]' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
              }`}>
                <div className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-[#1B58A1]' : 'text-amber-400'}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>同事协同使用常见方式：</span>
                </div>
                <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed opacity-90">
                  <li><strong>局域网共享：</strong>启动开发服务器时加入 <code>--host</code>，同办公网络下的同事可通过您的本机 IP 直接访问使用。</li>
                  <li><strong>云端/在线部署：</strong>可通过 GitHub 一键发布到 Vercel、Netlify 或 Docker 容器，生成团队永久访问域名。</li>
                  <li><strong>导出数据交接：</strong>点击右侧“导出全部清洗明细”，可将提炼好的清洗结果与高星差评报表直接发送给同事。</li>
                </ul>
              </div>
            </div>

            <div className={`flex justify-end pt-2 border-t ${isLight ? 'border-[#91AECF]/30' : 'border-neutral-800'}`}>
              <button
                onClick={() => setShareModalOpen(false)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isLight ? 'bg-[#1B58A1] hover:bg-[#1B58A1]/90 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                }`}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局悬浮 AI 状态提示条 (确保在页面任何位置点击重新 AI 分析都能第一时间清晰可见) */}
      {uploadToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="p-3.5 rounded-xl bg-[#090911]/95 text-white border border-[#1B58A1] shadow-2xl backdrop-blur-md flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-[#38BDF8] shrink-0 animate-pulse" />
            <div className="text-xs leading-relaxed">
              {uploadToast}
            </div>
            <button
              onClick={() => setUploadToast(null)}
              className="text-white/60 hover:text-white text-xs ml-2 cursor-pointer p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
