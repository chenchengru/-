import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, RotateCcw, AlertTriangle, CheckCircle2, ChevronDown, 
  ChevronUp, Star, Sparkles, Filter, Eye, Calendar, Layers, 
  Tag, ShieldAlert, Upload, FileSpreadsheet, History, Clock, Trash2, X,
  Info, ExternalLink, HelpCircle, ArrowRight, ShieldCheck, Check,
  ImageIcon, ShieldX, SlidersHorizontal, Download, Maximize2, PieChart, ChevronRight,
  Share2, Copy, BarChart3, TrendingUp, FileText, Zap, MessageSquare
} from 'lucide-react';
import { StandardReview, DatasetSummary } from '../types';
import { extractExecutiveDashboardData, matchReviewWithTag } from '../utils/dashboardExtractor';
import { DatasetRecord } from '../utils/datasetStorage';
import { translateWithGoogleApi } from '../utils/translator';
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
  theme = 'dark'
}) => {
  // 筛选器状态
  const [selectedStar, setSelectedStar] = useState<number | 'all'>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'negative' | 'hidden_negative' | 'neutral'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [cleaningSegment, setCleaningSegment] = useState<'all' | 'valid' | 'hidden_negative' | 'coins' | 'default' | 'fake' | 'low_star'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyValidFilter, setOnlyValidFilter] = useState<boolean>(false);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [retranslatingIds, setRetranslatingIds] = useState<Record<string, boolean>>({});

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

  // 单条精准调用谷歌翻译刷新
  const handleManualRetranslate = async (review: StandardReview) => {
    setRetranslatingIds(prev => ({ ...prev, [review.id]: true }));
    try {
      const fullTrans = await translateWithGoogleApi(review.content, review.language || 'auto');
      if (fullTrans) {
        setReviews(prev => prev.map(r => r.id === review.id ? { ...r, contentZh: fullTrans } : r));
        setUploadToast(`已更新评价 ${review.id} 的谷歌高精度逐句译文！`);
        setTimeout(() => setUploadToast(null), 3000);
      }
    } catch (e) {
      console.error('Manual retranslate failed', e);
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
          if (fullTrans && fullTrans !== r.contentZh) {
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
      // 0. 清洗分段过滤 (继承自清洗模块)
      if (cleaningSegment === 'valid' && r.invalidCheck.isInvalid) return false;
      if (cleaningSegment === 'hidden_negative' && !r.hiddenNegativeCheck.isHiddenNegative) return false;
      if (cleaningSegment === 'coins' && r.invalidCheck.category !== 'text_coins_farming') return false;
      if (cleaningSegment === 'default' && (r.invalidCheck.category !== 'system_default' && r.invalidCheck.category !== 'text_template' && r.invalidCheck.category !== 'text_irrelevant' && r.content.trim().length > 0)) return false;
      if (cleaningSegment === 'fake' && r.invalidCheck.category !== 'rating_fake_cluster') return false;
      if (cleaningSegment === 'low_star' && r.rating > 3) return false;

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
  }, [reviews, cleaningSegment, selectedStar, selectedVariant, selectedSentiment, selectedTagFilter, searchQuery, onlyValidFilter]);

  // 核心业务大盘聚合计算 (联动随 filteredReviews 实时计算)
  const dashboardData = useMemo(() => {
    return extractExecutiveDashboardData(filteredReviews);
  }, [filteredReviews]);

  // 重置筛选
  const handleResetFilters = () => {
    setSelectedStar('all');
    setSelectedVariant('all');
    setSelectedSentiment('all');
    setSelectedTagFilter(null);
    setCleaningSegment('all');
    setOnlyValidFilter(false);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedStar !== 'all' || selectedVariant !== 'all' || selectedSentiment !== 'all' || selectedTagFilter !== null || cleaningSegment !== 'all' || onlyValidFilter || searchQuery.trim().length > 0;

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

  // 辅助渲染：星级满意度 Donut (支持切片交互与点击放大)
  const renderStarDonut = () => {
    const { positivePercent, negativePercent, neutralPercent } = dashboardData.satisfaction.byStar;
    const r = 36;
    const circ = 2 * Math.PI * r;
    const posStroke = (positivePercent / 100) * circ;
    const negStroke = (negativePercent / 100) * circ;
    const neuStroke = (neutralPercent / 100) * circ;

    return (
      <svg className="w-24 h-24 transform -rotate-90 cursor-pointer select-none">
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeWidth="12" fill="none" />
        <circle
          cx="48" cy="48" r={r} stroke="#3b82f6" strokeWidth={hoveredSlice === 'star_pos' ? 16 : 12} fill="none"
          strokeDasharray={`${posStroke} ${circ}`} strokeDashoffset={0}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('star_pos')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('star_satisfaction', 'positive'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#f97316" strokeWidth={hoveredSlice === 'star_neg' ? 16 : 12} fill="none"
          strokeDasharray={`${negStroke} ${circ}`} strokeDashoffset={-posStroke}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('star_neg')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('star_satisfaction', 'negative'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#eab308" strokeWidth={hoveredSlice === 'star_neu' ? 16 : 12} fill="none"
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
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeWidth="12" fill="none" />
        <circle
          cx="48" cy="48" r={r} stroke="#10b981" strokeWidth={hoveredSlice === 'content_pos' ? 16 : 12} fill="none"
          strokeDasharray={`${posStroke} ${circ}`} strokeDashoffset={0}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('content_pos')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('content_satisfaction', 'positive'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#f43f5e" strokeWidth={hoveredSlice === 'content_neg' ? 16 : 12} fill="none"
          strokeDasharray={`${negStroke} ${circ}`} strokeDashoffset={-posStroke}
          className="transition-all duration-200 hover:opacity-90 cursor-pointer"
          onMouseEnter={() => setHoveredSlice('content_neg')}
          onMouseLeave={() => setHoveredSlice(null)}
          onClick={(e) => { e.stopPropagation(); openZoomedRing('content_satisfaction', 'negative'); }}
        />
        <circle
          cx="48" cy="48" r={r} stroke="#eab308" strokeWidth={hoveredSlice === 'content_neu' ? 16 : 12} fill="none"
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
        <circle cx="48" cy="48" r={r} stroke={isLight ? '#e2e8f0' : '#1e293b'} strokeWidth="12" fill="none" />
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
            ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30' 
            : (isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800')
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                <span>当前分析原始表格</span>
              </span>
              <span aria-hidden="true" className={isLight ? 'text-slate-400' : 'text-neutral-600'}>·</span>
              
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
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors flex items-center gap-1 cursor-pointer ${
                  isLight 
                    ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300' 
                    : 'text-white bg-neutral-800 border-neutral-700 hover:bg-neutral-750 hover:text-amber-300'
                }`}
                title="点击直接在页面内打开查看原始表格数据明细"
              >
                <span>{currentFileName || '未载入表格 (请拖入原始 Excel)'}</span>
                <ExternalLink className="h-3 w-3 opacity-70" />
              </button>

              {importTime && (
                <span className={`text-xs font-mono flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  <Clock className="h-3 w-3 opacity-70" />
                  <span>导入时间: {importTime}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span className={isLight ? 'text-slate-600' : 'text-neutral-400'}>
                全量样本: <strong className={isLight ? 'text-slate-900 font-mono' : 'text-white font-mono'}>{reviews.length}</strong> 条
              </span>
              <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-slate-600' : 'text-neutral-400'}>
                清洗后有效: <strong className="text-emerald-500 font-mono">{cleaningSummary.validCount}</strong> 条 ({cleaningSummary.cleanRate}%)
              </span>
              <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-slate-600' : 'text-neutral-400'}>
                剔除无效水军: <strong className="text-rose-400 font-mono">{cleaningSummary.invalidCount}</strong> 条
              </span>
              <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-neutral-700'}>|</span>
              <span className={isLight ? 'text-slate-600' : 'text-neutral-400'}>
                当前参与计算: <strong className="text-amber-500 font-mono font-bold">{filteredReviews.length}</strong> 条
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 展开清洗与水军排查抽屉按钮 */}
            <button
              onClick={() => setCleaningDrawerOpen(!cleaningDrawerOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border whitespace-nowrap ${
                cleaningDrawerOpen
                  ? 'bg-amber-500 text-neutral-950 border-amber-600 font-bold'
                  : (isLight ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700')
              }`}
              title="查看水军识别、凑字刷单过滤等清洗详情"
            >
              <ShieldX className="h-3.5 w-3.5" />
              <span>数据清洗排查 ({cleaningSummary.invalidCount})</span>
              {cleaningDrawerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* 粘贴文本按钮 (合并自清洗模块) */}
            <button
              onClick={() => setPasteModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border whitespace-nowrap ${
                isLight 
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="直接粘贴文本语料进行快速分析"
            >
              <FileText className="h-3.5 w-3.5 text-amber-500" />
              <span>粘贴文本</span>
            </button>

            {/* 分享工作台按钮 */}
            <button
              onClick={() => setShareModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border whitespace-nowrap ${
                isLight 
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
              title="协同分享此分析工作台"
            >
              <Share2 className="h-3.5 w-3.5 text-sky-400" />
              <span>分享工作台</span>
            </button>

            {/* 查看历史记录按钮 */}
            <button
              onClick={() => setHistoryModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors border whitespace-nowrap ${
                isLight 
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
              }`}
            >
              <History className="h-3.5 w-3.5 text-amber-500" />
              <span>历史表格 ({historyList.length})</span>
            </button>

            {/* 拖入/选择本地表格按钮 */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded cursor-pointer transition-colors shadow-sm whitespace-nowrap">
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
          <div className={`mt-3 pt-3 border-t space-y-3 ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>数据清洗与水军识别控制台（已深度无缝整合）</span>
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={onlyValidFilter}
                  onChange={(e) => setOnlyValidFilter(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  仅分析清洗后真实有效评论（自动剔除 {cleaningSummary.invalidCount} 条无效与水军废话）
                </span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block">真实有效评论</span>
                <span className="text-sm font-bold font-mono text-emerald-500">{cleaningSummary.validCount} 条</span>
                <span className="text-[10px] opacity-60 block">占比 {cleaningSummary.cleanRate}%</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block">虾币/金币凑字废话</span>
                <span className="text-sm font-bold font-mono text-amber-500">{cleaningSummary.coinsCount} 条</span>
                <span className="text-[10px] opacity-60 block">“555/kfjds/凑字”</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block">疑似集中刷单好评</span>
                <span className="text-sm font-bold font-mono text-rose-400">{cleaningSummary.fakeClusterCount} 条</span>
                <span className="text-[10px] opacity-60 block">全5星长文模板</span>
              </div>

              <div className={`p-2.5 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-70 block">系统默认无字评价</span>
                <span className="text-sm font-bold font-mono text-sky-400">{cleaningSummary.defaultCount} 条</span>
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

      {/* 综合筛选控制条 */}
      <div className={`p-4 rounded-xl border space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
            isLight ? 'text-slate-800' : 'text-white'
          }`}>
            <Filter className="h-3.5 w-3.5 text-amber-500" />
            <span>大盘多维数据钻取与联动</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {selectedTagFilter && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 font-mono text-[11px]">
                <span>标签锁定: {selectedTagFilter}</span>
                <button onClick={() => setSelectedTagFilter(null)} className="hover:opacity-80">×</button>
              </span>
            )}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>重置所有筛选</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
          {/* 星级下拉 */}
          <div className={`flex items-center gap-2 border rounded px-2.5 py-1.5 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
          }`}>
            <span className="text-xs opacity-60 shrink-0">星级:</span>
            <select
              value={selectedStar}
              onChange={(e) => setSelectedStar(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent text-xs focus:outline-none w-full cursor-pointer"
            >
              <option value="all">全部星级 ({reviews.length})</option>
              <option value={5}>5 星好评</option>
              <option value={4}>4 星评价</option>
              <option value={3}>3 星中立</option>
              <option value={2}>2 星差评</option>
              <option value={1}>1 星极差</option>
            </select>
          </div>

          {/* 变体/规格下拉 */}
          <div className={`flex items-center gap-2 border rounded px-2.5 py-1.5 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
          }`}>
            <span className="text-xs opacity-60 shrink-0">变体:</span>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              className="bg-transparent text-xs focus:outline-none w-full cursor-pointer truncate"
            >
              <option value="all">全部变体/规格</option>
              {allVariants.map((v, i) => (
                <option key={i} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* 情感方向下拉 */}
          <div className={`flex items-center gap-2 border rounded px-2.5 py-1.5 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
          }`}>
            <span className="text-xs opacity-60 shrink-0">情感:</span>
            <select
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value as any)}
              className="bg-transparent text-xs focus:outline-none w-full cursor-pointer"
            >
              <option value="all">全部情感方向</option>
              <option value="positive">满意好评 (正向)</option>
              <option value="negative">不满差评 (负向)</option>
              <option value="hidden_negative">五星/四星隐性差评</option>
              <option value="neutral">中立评价</option>
            </select>
          </div>

          {/* 搜索框 */}
          <div className={`flex items-center gap-2 border rounded px-2.5 py-1.5 ${
            isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
          }`}>
            <Search className="h-3.5 w-3.5 opacity-50 shrink-0" />
            <input
              type="text"
              placeholder="搜索原文/完整译文/痛点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs focus:outline-none w-full placeholder:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* 顶端7大核心指标卡片 (原“数据导入与清洗”模块顶端指标与刷单分类全面拆分，置顶于客户满意度上方) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {/* 指标1: 评论总量 */}
        <div 
          onClick={() => { setCleaningSegment('all'); setSelectedStar('all'); setSelectedSentiment('all'); }}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            cleaningSegment === 'all' && selectedSentiment === 'all'
              ? 'ring-2 ring-sky-500/50'
              : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
          }`}
          title="点击重置为全量样本"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            评论总量 (Total)
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {reviews.length}
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            全量原始留评总数
          </div>
        </div>

        {/* 指标2: 有效真实评论 */}
        <div 
          onClick={() => setCleaningSegment(cleaningSegment === 'valid' ? 'all' : 'valid')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            cleaningSegment === 'valid' ? 'ring-2 ring-emerald-500/50 bg-emerald-500/5' : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-emerald-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-emerald-800/60'
          }`}
          title="点击筛选仅查看有效真实评论"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            有效真实评论 (Valid)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-500">
            {cleaningSummary.validCount}
            <span className={`text-[10px] font-normal ml-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              ({cleaningSummary.cleanRate}%)
            </span>
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            自然买家真实留评
          </div>
        </div>

        {/* 指标3: 虾币/金币凑字废话 (独立拆分卡片1) */}
        <div 
          onClick={() => setCleaningSegment(cleaningSegment === 'coins' ? 'all' : 'coins')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            cleaningSegment === 'coins' ? 'ring-2 ring-amber-500/50 bg-amber-500/5' : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-amber-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-amber-800/60'
          }`}
          title="点击筛选查看虾币/金币凑字废话评价"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            虾币/金币凑字废话
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-500">
            {cleaningSummary.coinsCount}
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            “555/kfjds/凑字”
          </div>
        </div>

        {/* 指标4: 系统默认无字评价 (独立拆分卡片2) */}
        <div 
          onClick={() => setCleaningSegment(cleaningSegment === 'default' ? 'all' : 'default')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            cleaningSegment === 'default' ? 'ring-2 ring-sky-500/50 bg-sky-500/5' : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-sky-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-sky-800/60'
          }`}
          title="点击筛选查看系统默认无字评价"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            系统默认无字评价
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-400">
            {cleaningSummary.defaultCount}
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            平台超时默认好评
          </div>
        </div>

        {/* 指标5: 疑似集中刷单好评 (独立拆分卡片3) */}
        <div 
          onClick={() => setCleaningSegment(cleaningSegment === 'fake' ? 'all' : 'fake')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            cleaningSegment === 'fake' ? 'ring-2 ring-rose-500/50 bg-rose-500/5' : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-rose-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-rose-800/60'
          }`}
          title="点击筛选查看疑似集中刷单模板好评"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            疑似集中刷单好评
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-400">
            {cleaningSummary.fakeClusterCount}
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            批量机器模板号
          </div>
        </div>

        {/* 指标6: 五星/四星隐性差评 (重点突出，支持点击直达穿透专区) */}
        <div 
          onClick={onNavigateToHiddenNegatives ? onNavigateToHiddenNegatives : () => setCleaningSegment('hidden_negative')}
          className={`p-3 rounded-xl border transition-all cursor-pointer group ${
            cleaningSegment === 'hidden_negative' ? 'ring-2 ring-rose-500/50 bg-rose-500/10' : ''
          } ${
            isLight 
              ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400 hover:shadow-sm' 
              : 'bg-neutral-900/90 border-rose-900/60 hover:border-rose-500/80'
          }`}
          title="点击直接跳转至【五星差评/四星差评深度穿透专区】"
        >
          <div className="flex items-center justify-between text-[11px] text-rose-500 mb-1 font-medium">
            <span className="font-semibold flex items-center gap-0.5 truncate">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span className="truncate">五星/四星隐性差评</span>
            </span>
            <ChevronRight className="h-3 w-3 text-rose-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-rose-500">
            {cleaningSummary.hiddenCount}
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-rose-600/80' : 'text-rose-400/80'}`}>
            高星人情·文字痛骂
          </div>
        </div>

        {/* 指标7: 真实净满意度 (NPS) */}
        <div 
          onClick={() => setSelectedSentiment(selectedSentiment === 'positive' ? 'all' : 'positive')}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            selectedSentiment === 'positive' ? 'ring-2 ring-sky-500/50 bg-sky-500/5' : ''
          } ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-sky-300' : 'bg-neutral-900/90 border-neutral-800 hover:border-sky-800/60'
          }`}
          title="点击筛选真实正向满意好评"
        >
          <div className={`text-[11px] mb-1 font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            真实净满意度 (NPS)
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-500">
            {dashboardData.satisfaction.byContent.positivePercent}
            <span className={`text-[10px] font-normal ml-0.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>%</span>
          </div>
          <div className={`text-[10px] mt-1 truncate ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
            表星: {dashboardData.avgRating} ★
          </div>
        </div>
      </div>

      {/* 快捷清洗分段过滤条 (继承合并自数据导入与清洗模块) */}
      <div className={`p-2.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-900/60 border-neutral-800'
      }`}>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className={`text-[11px] font-semibold flex items-center gap-1 mr-1 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
            <SlidersHorizontal className="h-3 w-3 text-amber-500" />
            <span>清洗分流快速透视:</span>
          </span>

          {[
            { id: 'all', label: `全量原始留评 (${cleaningSummary.total})` },
            { id: 'valid', label: `真实有效 (${cleaningSummary.validCount})` },
            { id: 'hidden_negative', label: `五星/四星隐性差评 (${cleaningSummary.hiddenCount})` },
            { id: 'coins', label: `虾币/金币废话 (${cleaningSummary.coinsCount})` },
            { id: 'default', label: `系统默认无字 (${cleaningSummary.defaultCount})` },
            { id: 'fake', label: `疑似集中刷单 (${cleaningSummary.fakeClusterCount})` },
            { id: 'low_star', label: `显性低星差评 1-3★ (${cleaningSummary.lowStarCount})` }
          ].map(btn => {
            const active = cleaningSegment === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => setCleaningSegment(btn.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-600 text-white font-bold shadow-sm'
                    : isLight
                      ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                      : 'bg-neutral-800 text-neutral-300 border border-neutral-750 hover:bg-neutral-700'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {cleaningSegment !== 'all' && (
          <button
            onClick={() => setCleaningSegment('all')}
            className="text-xs text-amber-500 hover:underline flex items-center gap-0.5 font-medium ml-auto cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>恢复查看全量</span>
          </button>
        )}
      </div>

      {/* 第一行看板：
          第1框: 客户满意度 (按星级计算)
          第2框: 客户满意度 (按实际内容测算)
          第3框: 变体分布 (无滑动条紧凑排版)
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 第1框: 客户满意度 (按星级计算) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-slate-800' : 'text-white'
              }`}>
                <Star className="h-3.5 w-3.5 text-amber-500" />
                <span>客户满意度 (按星级计算)</span>
              </h2>
              <button 
                onClick={() => openZoomedRing('star_satisfaction', 'positive')}
                className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5 font-medium"
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
                <span className={`text-base font-bold font-mono leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {dashboardData.satisfaction.byStar.positivePercent}%
                </span>
                <span className="text-[10px] opacity-60">表面好评</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1 pl-4">
              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'positive')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看4-5星满意维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span>4-5星满意</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byStar.positive} ({dashboardData.satisfaction.byStar.positivePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'negative')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看1-2星差评维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span>1-2星差评</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byStar.negative} ({dashboardData.satisfaction.byStar.negativePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('star_satisfaction', 'neutral')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看3星中立维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span>3星中立</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byStar.neutral} ({dashboardData.satisfaction.byStar.neutralPercent}%)
                </span>
              </div>
            </div>
          </div>

          <div className={`p-2 rounded border text-[11px] flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-neutral-950 border-neutral-850 text-neutral-400'
          }`}>
            <div>
              <span className="opacity-70">总样本: </span>
              <strong className="font-mono font-bold">{dashboardData.satisfaction.total}</strong> 条评价
            </div>
            <span className="text-[10px] text-sky-500 font-medium">🔍 点击维度可深度透视</span>
          </div>
        </div>

        {/* 第2框: 客户满意度 (按实际内容测算) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-slate-800' : 'text-white'
              }`}>
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>客户满意度 (按实际内容测算)</span>
              </h2>
              <button 
                onClick={() => openZoomedRing('content_satisfaction', 'negative')}
                className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5 font-medium"
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
                <span className="text-base font-bold font-mono text-emerald-500 leading-tight">
                  {dashboardData.satisfaction.byContent.positivePercent}%
                </span>
                <span className="text-[10px] opacity-60">净满意度</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1 pl-4">
              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'positive')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看真实满意维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>真实满意好评</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byContent.positive} ({dashboardData.satisfaction.byContent.positivePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'negative')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看不满/含隐性差评维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span>不满/含隐性差评</span>
                </div>
                <span className="font-mono text-rose-500 font-semibold">
                  {dashboardData.satisfaction.byContent.negative} ({dashboardData.satisfaction.byContent.negativePercent}%)
                </span>
              </div>

              <div 
                onClick={() => openZoomedRing('content_satisfaction', 'neutral')}
                className={`flex items-center justify-between p-1 rounded cursor-pointer transition-colors ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-neutral-800/60'
                }`}
                title="点击放大查看中立观望维度"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                  <span>中立观望评价</span>
                </div>
                <span className="font-mono opacity-80 font-semibold">
                  {dashboardData.satisfaction.byContent.neutral} ({dashboardData.satisfaction.byContent.neutralPercent}%)
                </span>
              </div>
            </div>
          </div>

          <div className={`p-2 rounded border text-[11px] space-y-0.5 ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-neutral-950 border-neutral-850 text-neutral-400'
          }`}>
            {dashboardData.satisfaction.hiddenCount > 0 ? (
              <p className="text-rose-500 text-[11px] leading-tight font-medium">
                ⚠️ 检出 <strong>{dashboardData.satisfaction.hiddenCount}</strong> 条五星/四星隐性差评，真实满意率较表面星级下修 <strong>{dashboardData.satisfaction.hiddenDisparityRate}%</strong>。
              </p>
            ) : (
              <p className="text-emerald-500 text-[11px] leading-tight font-medium">
                ✅ 文本情感与星级吻合良好，未见明显的人情掩饰差评。
              </p>
            )}
          </div>
        </div>

        {/* 第3框: 变体分布 (彻底消除内部滚动条，优雅紧凑排版) */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-white'}`}>
                变体分布
              </h2>
              <button
                onClick={() => openZoomedRing('variant_distribution', dashboardData.variants[0]?.variant || 'all')}
                className="text-[10px] text-sky-500 hover:underline flex items-center gap-0.5 font-medium"
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
                <span className={`text-base font-bold font-mono leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
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
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200' 
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
                      <div className={`w-full h-1 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-neutral-800'}`}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${v.percentage}%`, backgroundColor: v.color }} />
                      </div>
                    </div>
                  ))}

                  {dashboardData.variants.length > 3 && (
                    <button
                      onClick={() => openZoomedRing('variant_distribution', dashboardData.variants[3].variant)}
                      className={`w-full text-center py-1 rounded text-[11px] font-medium border transition-colors flex items-center justify-center gap-1 ${
                        isLight 
                          ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' 
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
                      }`}
                    >
                      <Maximize2 className="h-3 w-3 text-sky-400" />
                      <span>查看其余 {dashboardData.variants.length - 3} 种规格 (点击放大)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={`text-[10px] pt-1 border-t opacity-60 flex items-center justify-between ${isLight ? 'border-slate-200' : 'border-neutral-850'}`}>
            <span>* 依据导表中实际抓取的买家购买规格自动聚合</span>
            <span className="text-sky-500 font-medium">🔍 点击维度可放大透视</span>
          </div>
        </div>
      </div>

      {/* 第二行看板：正反馈 (优势) + 负反馈 (风险与隐性差评) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 正反馈 */}
        <div className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-sky-500 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-sky-500" />
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
                    <span>{item.text}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="opacity-70">{item.count}</span>
                      <span className="text-sky-500 text-[11px] font-semibold">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-neutral-950'}`}>
                    <div 
                      className="bg-sky-500 h-2 rounded-full transition-all duration-500" 
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
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
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
                    <span>{item.text}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="opacity-70">{item.count}</span>
                      <span className="text-rose-500 text-[11px] font-semibold">{item.percentage}%</span>
                    </div>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-neutral-950'}`}>
                    <div 
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(8, item.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 第三行看板：未满足需求与改进空间 + 星级真实分布 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 未被满足的需求与改进空间 */}
        <div className={`p-4 rounded-xl border space-y-3 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500" />
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
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium leading-relaxed">{need.text}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                      need.urgency === 'high' 
                        ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30 font-bold'
                        : 'bg-neutral-800 text-neutral-400'
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

        {/* 星级真实分布 */}
        <div className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-white'}`}>
                星级真实分布
              </h2>
              <span className="text-[11px] opacity-60 font-mono">1星 ~ 5星</span>
            </div>
            <p className="text-[11px] opacity-60 mt-0.5">
              直观查看评价等级梯度分布
            </p>
          </div>

          <div className="flex items-end justify-between gap-2 h-44 pt-2 px-4">
            {dashboardData.starDistribution.map((item) => {
              const maxCount = Math.max(1, ...dashboardData.starDistribution.map(s => s.count));
              const heightPct = Math.max(12, Math.round((item.count / maxCount) * 100));

              return (
                <div key={item.star} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="font-mono text-xs opacity-80 font-bold">{item.count}</span>
                  <div className={`w-10 rounded-t h-28 flex items-end justify-center ${isLight ? 'bg-slate-100' : 'bg-neutral-950'}`}>
                    <div 
                      className={`w-full rounded-t transition-all duration-500 ${
                        item.star >= 4 ? 'bg-amber-500' : (item.star === 3 ? 'bg-yellow-600' : 'bg-rose-500')
                      }`} 
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs opacity-70 font-medium">{item.star}星 ({item.percentage}%)</span>
                </div>
              );
            })}
          </div>

          <div className={`text-[10px] pt-1 border-t opacity-60 ${isLight ? 'border-slate-200' : 'border-neutral-850'}`}>
            * 样本基于当前筛选范围内的真实留评总数
          </div>
        </div>
      </div>

      {/* 第四行看板：智能评论标签库 (基于真实词频与情感打标 · 点击标签快速筛选) */}
      <div className={`p-4 rounded-xl border space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Tag className="h-4 w-4 text-amber-500" />
              <span>智能评论标签库 (基于真实词频与情感打标 · 点击标签快速筛选)</span>
            </h2>
            <p className="text-[11px] opacity-60">
              全宽铺满展现，涵盖正向优势卖点、负向客诉痛点与隐性差评，点击任意标签实时全看板联动
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] opacity-70 font-mono">共提取 {availableTags.length} 个高频特征</span>
            {selectedTagFilter && (
              <button
                onClick={() => setSelectedTagFilter(null)}
                className="text-xs text-amber-500 hover:text-amber-400 font-medium flex items-center gap-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>清除标签透视</span>
              </button>
            )}
          </div>
        </div>

        {/* 激活标签透视提示条 */}
        {selectedTagFilter && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-amber-400 font-medium">
                已激活标签深度透视: <strong>【{selectedTagFilter}】</strong>
              </span>
              <span className="opacity-70 font-mono">
                (左右两端看板指标与数据已全部联动更新，当前命中了 <strong>{filteredReviews.length}</strong> 条留评)
              </span>
            </div>
            <button
              onClick={() => setSelectedTagFilter(null)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold underline cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>退出联动</span>
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {availableTags.length === 0 ? (
            <div className="py-6 text-center text-xs opacity-50 w-full">
              暂无足够词频提取标签
            </div>
          ) : (
            availableTags.map((tag, i) => {
              let badgeClass = isLight 
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400'
                : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:border-neutral-500';

              if (tag.type === 'positive') {
                badgeClass = isLight
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60';
              } else if (tag.type === 'negative') {
                badgeClass = isLight
                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60';
              } else if (tag.type === 'hidden_negative') {
                badgeClass = isLight
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60';
              }

              const isSelected = selectedTagFilter === tag.tag;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedTagFilter(isSelected ? null : tag.tag)}
                  className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-all cursor-pointer ${badgeClass} ${
                    isSelected ? 'ring-2 ring-amber-500 font-bold shadow-md scale-105' : ''
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
      </div>

      {/* 第五行看板：留评时间趋势 (按月聚合：柱状图+折线图；按日聚合：精准折线图) */}
      <div className={`p-4 rounded-xl border space-y-3 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Calendar className="h-4 w-4 text-sky-500" />
              <span>留评时间趋势分析</span>
            </h2>
            <p className="text-[11px] opacity-60">
              {timelineMode === 'monthly' 
                ? '按月聚合呈现留评总量柱状分布与真实好评率双轴走势' 
                : '按日聚合高精度呈现留评波形与爆发周期'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 月度 / 日度 聚合切换按键 */}
            <div className={`flex items-center p-0.5 rounded-lg border ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <button
                onClick={() => setTimelineMode('monthly')}
                className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  timelineMode === 'monthly'
                    ? 'bg-sky-600 text-white font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                <span>按月聚合 (柱状图+折线图)</span>
              </button>
              <button
                onClick={() => setTimelineMode('daily')}
                className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  timelineMode === 'daily'
                    ? 'bg-sky-600 text-white font-bold shadow-sm'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-white'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>按日聚合 (走势折线图)</span>
              </button>
            </div>

            <span className="text-[11px] opacity-60 font-mono hidden sm:inline">
              {timelineMode === 'monthly' 
                ? `共 ${dashboardData.monthlyComboTrends?.length || dashboardData.timelineTrends.length} 个月份节点` 
                : `共 ${dashboardData.dailyTrends?.length || 0} 个日节点`}
            </span>
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

          // SVG 布局尺寸
          const W = 800;
          const H = 190;
          const padL = 40;
          const padR = 45;
          const padT = 25;
          const padB = 30;
          const graphW = W - padL - padR;
          const graphH = H - padT - padB;
          const n = comboData.length;
          const slotW = graphW / Math.max(1, n);
          const barW = Math.max(14, Math.min(42, slotW * 0.55));

          // 计算各柱和折线坐标
          const points = comboData.map((d, i) => {
            const centerX = padL + i * slotW + slotW / 2;
            const barH = (d.count / maxCount) * graphH;
            const barY = padT + graphH - barH;
            // 真实好评率折线 (0% - 100%)
            const rate = typeof d.positiveRate === 'number' ? d.positiveRate : 80;
            const lineY = padT + (1 - Math.min(100, Math.max(0, rate)) / 100) * graphH;

            return {
              ...d,
              centerX,
              barX: centerX - barW / 2,
              barY,
              barH,
              lineY
            };
          });

          const polylinePoints = points.map(p => `${p.centerX},${p.lineY}`).join(' ');

          return (
            <div className="space-y-2 pt-1">
              {/* 图例与实时 Hover 信息 */}
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-sky-500 inline-block" />
                    <span className="opacity-80">留评总量 (柱)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3.5 bg-amber-400 inline-block rounded-full" />
                    <span className="h-2 w-2 rounded-full bg-amber-400 border border-white inline-block" />
                    <span className="opacity-80">真实好评率走势 (线)</span>
                  </span>
                </div>

                {hoveredItem ? (
                  <div className="flex items-center gap-3 text-xs bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded font-mono">
                    <span className="font-bold text-amber-400">{hoveredItem.month}</span>
                    <span>总量: <strong>{hoveredItem.count}</strong> 条</span>
                    <span className="text-emerald-400">好评率: <strong>{hoveredItem.positiveRate}%</strong></span>
                    <span className="opacity-70">评分: <strong>{hoveredItem.avgRating}★</strong></span>
                  </div>
                ) : (
                  <span className="text-[11px] opacity-50">鼠标悬浮任意月份查看双轴精准数值</span>
                )}
              </div>

              {/* 组合图表 SVG */}
              <div className={`rounded-xl border p-2 overflow-x-auto ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 select-none">
                  {/* 背景参考线 */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = padT + pct * graphH;
                    const countVal = Math.round(maxCount * (1 - pct));
                    const rateVal = Math.round(100 * (1 - pct));
                    return (
                      <g key={idx}>
                        <line 
                          x1={padL} 
                          y1={y} 
                          x2={W - padR} 
                          y2={y} 
                          stroke={isLight ? '#e2e8f0' : '#262626'} 
                          strokeDasharray="4 4" 
                        />
                        {/* 左轴: 评论量 */}
                        <text 
                          x={padL - 6} 
                          y={y + 3} 
                          fill={isLight ? '#64748b' : '#737373'} 
                          fontSize="9" 
                          textAnchor="end" 
                          fontFamily="monospace"
                        >
                          {countVal}
                        </text>
                        {/* 右轴: 好评率 */}
                        <text 
                          x={W - padR + 6} 
                          y={y + 3} 
                          fill="#f59e0b" 
                          fontSize="9" 
                          textAnchor="start" 
                          fontFamily="monospace"
                        >
                          {rateVal}%
                        </text>
                      </g>
                    );
                  })}

                  {/* 柱状图：留评总量 */}
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
                          height={Math.max(3, p.barH)}
                          rx="3"
                          fill={isHovered ? '#38bdf8' : '#0284c7'}
                          className="transition-all duration-300"
                        />
                        {/* 柱顶数字 */}
                        <text
                          x={p.centerX}
                          y={p.barY - 4}
                          fill={isLight ? '#334155' : '#e2e8f0'}
                          fontSize="10"
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
                          fill={isHovered ? (isLight ? '#0f172a' : '#ffffff') : (isLight ? '#64748b' : '#a3a3a3')}
                          fontSize="10"
                          textAnchor="middle"
                          fontWeight={isHovered ? 'bold' : 'normal'}
                          fontFamily="monospace"
                        >
                          {p.month}
                        </text>
                      </g>
                    );
                  })}

                  {/* 折线图：真实好评率 (覆盖在柱状图之上) */}
                  <polyline
                    points={polylinePoints}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* 折线数据节点与悬停圆圈 */}
                  {points.map((p, i) => {
                    const isHovered = hoveredMonthlyIndex === i;
                    return (
                      <g 
                        key={`line-point-${i}`}
                        onMouseEnter={() => setHoveredMonthlyIndex(i)}
                        onMouseLeave={() => setHoveredMonthlyIndex(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={p.centerX}
                          cy={p.lineY}
                          r={isHovered ? 6 : 4}
                          fill="#f59e0b"
                          stroke={isLight ? '#ffffff' : '#171717'}
                          strokeWidth="2"
                          className="transition-all duration-200"
                        />
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
                  <div className="flex items-center gap-3 text-xs bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 rounded font-mono">
                    <span className="font-bold text-sky-400">{hoveredDaily.date}</span>
                    <span>当天留评: <strong>{hoveredDaily.count}</strong> 条</span>
                    <span className="text-emerald-400">真实好评: <strong>{hoveredDaily.positiveRate}%</strong></span>
                    <span className="text-rose-400">差评: <strong>{hoveredDaily.negativeCount}</strong></span>
                    <span className="opacity-70">评分: <strong>{hoveredDaily.avgRating}★</strong></span>
                  </div>
                ) : (
                  <span className="text-[11px] opacity-50">鼠标悬浮折线节点查看当日真实统计</span>
                )}
              </div>

              <div className={`rounded-xl border p-2 overflow-x-auto ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 select-none">
                  <defs>
                    <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
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
                          stroke={isLight ? '#e2e8f0' : '#262626'} 
                          strokeDasharray="4 4" 
                        />
                        <text 
                          x={padL - 6} 
                          y={y + 3} 
                          fill={isLight ? '#64748b' : '#737373'} 
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
                    stroke="#0ea5e9"
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
                          fill={isLight ? '#64748b' : '#a3a3a3'}
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
                          fill={isHovered ? '#38bdf8' : '#0284c7'}
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

      {/* 第六行：评论证据 · 原始数据打标、情感方向与评论拆分
          彻底消除水平滚动条，穿透详情列同一个页面放下！
      */}
      <div className={`p-4 rounded-xl border space-y-4 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-neutral-800">
          <div>
            <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <Layers className="h-4 w-4 text-amber-500" />
              <span>评论证据 · 原始数据打标、情感方向与评论拆分</span>
            </h2>
            <p className="text-[11px] opacity-60">
              当前展示前 100 条 (共 {filteredReviews.length} 条) · 适配桌面同屏呈现，无需横向滚动即可点击【穿透详情】
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Google Translate 神经翻译引擎
            </span>
          </div>
        </div>

        {/* 紧凑型数据表格 (table-fixed, 保证最后一列穿透详情完全一屏展示，绝无横向滚动) */}
        <div className={`border rounded-lg overflow-hidden ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
          <table className="w-full text-left border-collapse text-xs table-fixed">
            <thead>
              <tr className={`font-medium border-b ${
                isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-neutral-950 text-neutral-400 border-neutral-800'
              }`}>
                {/* 1. ID / 平台 (固定 110px) */}
                <th className="py-2.5 px-2.5 w-[110px]">ID / 平台</th>

                {/* 2. 表面星级 (固定 75px) */}
                <th className="py-2.5 px-2 w-[75px]">
                  <div className="flex items-center gap-1">
                    <span>星级</span>
                    <select
                      value={selectedStar}
                      onChange={(e) => setSelectedStar(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      className={`rounded px-1 py-0.5 text-[10px] border ${
                        isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-neutral-900 text-neutral-300 border-neutral-800'
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
                        isLight ? 'bg-white text-slate-800 border-slate-300' : 'bg-neutral-900 text-neutral-300 border-neutral-800'
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
                      className="text-amber-500 hover:opacity-80 p-0.5"
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
            <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-850'}`}>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center opacity-50">
                    未找到符合筛选条件的评价证据
                  </td>
                </tr>
              ) : (
                filteredReviews.slice(0, 100).map((review) => {
                  const isExpanded = Boolean(expandedReviewIds[review.id]);
                  const isHiddenNeg = review.hiddenNegativeCheck.isHiddenNegative;
                  const sentiment = isHiddenNeg ? '五星隐性差评' : (review.hiddenNegativeCheck.realSentiment === 'positive' ? '正向' : (review.hiddenNegativeCheck.realSentiment === 'negative' ? '负向' : '中立'));

                  return (
                    <tr 
                      key={review.id}
                      className={`transition-colors ${
                        isHiddenNeg 
                          ? (isLight ? 'bg-rose-50/70 hover:bg-rose-100/50' : 'bg-rose-950/20 hover:bg-rose-900/30') 
                          : (isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50')
                      }`}
                    >
                      {/* 1. ID / 平台 */}
                      <td className="py-3 px-2.5 align-top font-mono text-[11px] truncate">
                        <div className="font-semibold truncate">{review.id}</div>
                        <div className="text-[10px] opacity-60 uppercase truncate">{review.platform} · {review.reviewTime}</div>
                        {/* 买家晒图缩略图 */}
                        {review.imageUrls && review.imageUrls.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {review.imageUrls.slice(0, 2).map((url, imgIdx) => (
                              <button
                                key={imgIdx}
                                onClick={() => setPreviewImageModalUrl(url)}
                                className="relative rounded border border-neutral-700 overflow-hidden h-6 w-6 hover:scale-110 transition-transform"
                                title="点击查看买家原图"
                              >
                                <img src={url} alt="buyer upload" className="h-full w-full object-cover" />
                              </button>
                            ))}
                            {review.imageUrls.length > 2 && (
                              <span className="text-[9px] opacity-60 font-mono">+{review.imageUrls.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 2. 表面星级 */}
                      <td className="py-3 px-2 align-top">
                        <div className="flex items-center gap-0.5 font-mono text-amber-500 font-bold">
                          <span>{review.rating}</span>
                          <span className="text-xs">★</span>
                        </div>
                      </td>

                      {/* 3. 评价内容 (原文 & 中文释义) - 严格对齐数据导入与清洗模块的呈现架构 */}
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1 max-w-xl">
                          {/* 原文 */}
                          <p className={`leading-relaxed text-xs ${isExpanded ? '' : 'line-clamp-2'} ${
                            isLight ? 'text-slate-800' : 'text-neutral-200'
                          }`}>
                            {review.content}
                          </p>

                          {/* 中文释义 (参考数据导入与清洗模块的呈现架构，自然排版并与原文高度配对) */}
                          {review.contentZh && (
                            <p className={`text-[11px] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'} ${
                              isLight ? 'text-slate-600' : 'text-neutral-400'
                            }`}>
                              {review.contentZh}
                            </p>
                          )}

                          {/* 买家元数据 + 展开/收起 + 谷歌重译 */}
                          <div className="flex items-center gap-2 text-[10px] opacity-60 pt-0.5">
                            <span>买家: {review.buyerName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{review.languageLabel}</span>
                            
                            <button
                              onClick={() => toggleExpand(review.id)}
                              className="text-sky-500 hover:underline cursor-pointer ml-auto"
                            >
                              {isExpanded ? '收起' : '展开全文'}
                            </button>

                            <button
                              onClick={() => handleManualRetranslate(review)}
                              disabled={retranslatingIds[review.id]}
                              className="text-amber-500 hover:underline cursor-pointer flex items-center gap-0.5 font-medium ml-2"
                              title="调用 Google Translate 重新精准翻译此条评价"
                            >
                              <Sparkles className={`h-3 w-3 ${retranslatingIds[review.id] ? 'animate-spin' : ''}`} />
                              <span>{retranslatingIds[review.id] ? '翻译中...' : '重新翻译'}</span>
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* 4. SKU / 规格 */}
                      <td className="py-3 px-2 align-top text-[11px] font-mono break-words">
                        <span title={review.sku}>{review.sku || '默认'}</span>
                      </td>

                      {/* 5. 情感方向 */}
                      <td className="py-3 px-2 align-top">
                        {isHiddenNeg ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/40 inline-flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>隐性差评</span>
                          </span>
                        ) : sentiment === '正向' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 inline-flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span>正向满意</span>
                          </span>
                        ) : sentiment === '负向' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/30">
                            负向不满
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
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
                                  isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                }`}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {review.hiddenNegativeCheck.extractedGrievances.length > 0 && (
                            <div className="space-y-0.5">
                              {review.hiddenNegativeCheck.extractedGrievances.map((g, idx) => (
                                <div key={idx} className="text-[10px] text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 leading-tight">
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
                          className="px-2 py-1 text-xs rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 border border-sky-500/30 transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
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
                className="p-1.5 rounded hover:opacity-80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 核心元信息条 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">表面评分</span>
                <div className="text-sm font-bold font-mono text-amber-500 flex items-center gap-1">
                  <span>{activeDrilldownReview.rating} 星</span>
                  <span>★</span>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">真实情感校准</span>
                <div className="text-xs font-bold">
                  {activeDrilldownReview.hiddenNegativeCheck.isHiddenNegative ? (
                    <span className="text-rose-500">五星隐性差评</span>
                  ) : activeDrilldownReview.hiddenNegativeCheck.realSentiment === 'positive' ? (
                    <span className="text-emerald-500">正向满意好评</span>
                  ) : (
                    <span className="opacity-80">中立/负向</span>
                  )}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">留评日期</span>
                <div className="text-xs font-mono opacity-80">
                  {activeDrilldownReview.reviewTime || '未知'}
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border space-y-0.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'}`}>
                <span className="text-[10px] opacity-60">购买规格 (SKU)</span>
                <div className="text-xs font-mono opacity-80 truncate" title={activeDrilldownReview.sku}>
                  {activeDrilldownReview.sku || '默认'}
                </div>
              </div>
            </div>

            {/* 买家晒图实拍画廊 */}
            {activeDrilldownReview.imageUrls && activeDrilldownReview.imageUrls.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1 text-xs font-semibold text-sky-500">
                  <ImageIcon className="h-4 w-4" />
                  <span>买家评价实拍图片 ({activeDrilldownReview.imageUrls.length}张)</span>
                </div>
                <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-neutral-950/40 border-neutral-800">
                  {activeDrilldownReview.imageUrls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setPreviewImageModalUrl(url)}
                      className="h-20 w-20 rounded-lg border border-neutral-700 overflow-hidden hover:scale-105 transition-transform"
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
                <span className="text-[10px] font-mono opacity-60">语言: {activeDrilldownReview.languageLabel}</span>
              </div>
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
              }`}>
                {activeDrilldownReview.content}
              </div>
            </div>

            {/* Google 完整逐句译文 */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Google Translate 逐句完整译文</span>
              </div>
              <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
              }`}>
                {activeDrilldownReview.contentZh || '无额外释义'}
              </div>
            </div>

            {/* 匹配标签与客诉痛点 */}
            <div className="space-y-2">
              <div className="text-xs font-semibold opacity-80">命中的智能标签与痛点识别</div>
              <div className="flex flex-wrap gap-1.5">
                {activeDrilldownReview.topics.map((t, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded border bg-neutral-800 text-neutral-200 border-neutral-700">
                    主题: {t}
                  </span>
                ))}
                {activeDrilldownReview.hiddenNegativeCheck.extractedGrievances.map((g, i) => (
                  <span key={i} className="px-2 py-1 text-xs rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                    客诉痛点: {g}
                  </span>
                ))}
              </div>
            </div>

            {/* 判定标准依据与运营应对建议 */}
            <div className={`p-3 rounded-lg border space-y-1.5 text-xs ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
            }`}>
              <div className="font-semibold flex items-center gap-1.5 text-sky-500">
                <ShieldAlert className="h-4 w-4" />
                <span>算法判定依据与建议策略</span>
              </div>
              <p className="opacity-80 leading-relaxed">
                {activeDrilldownReview.hiddenNegativeCheck.businessImpact}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveDrilldownReview(null)}
                className="px-4 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors cursor-pointer"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
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
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>导出原Excel</span>
                </button>
                <button
                  onClick={() => setPreviewRawTableRecord(null)}
                  className="p-1.5 rounded hover:opacity-80"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 原始数据网格 */}
            <div className="flex-1 overflow-auto border rounded-lg border-neutral-800 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800 sticky top-0">
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
                <tbody className="divide-y divide-neutral-850">
                  {previewRawTableRecord.reviews.map((r, idx) => (
                    <tr key={idx} className="hover:bg-neutral-850/50">
                      <td className="py-2.5 px-3 font-mono opacity-60">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono opacity-80 whitespace-nowrap">{r.id}</td>
                      <td className="py-2.5 px-3 text-amber-500 font-bold whitespace-nowrap">{r.rating}★</td>
                      <td className="py-2.5 px-3">{r.content}</td>
                      <td className="py-2.5 px-3 font-mono opacity-80 whitespace-nowrap">{r.sku}</td>
                      <td className="py-2.5 px-3 opacity-80 whitespace-nowrap">{r.buyerName}</td>
                      <td className="py-2.5 px-3 font-mono opacity-60 whitespace-nowrap">{r.reviewTime}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-sky-400 max-w-[120px] truncate">
                        {r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls.join(', ') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs opacity-60 font-mono">
                当前表格已完全在本地缓存，您可以随时切换或导出
              </span>
              <button
                onClick={() => setPreviewRawTableRecord(null)}
                className="px-4 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold">评价情感方向判定标准说明</h3>
              </div>
              <button onClick={() => setSentimentGuideOpen(false)} className="opacity-60 hover:opacity-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs opacity-90 leading-relaxed">
              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-emerald-500 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>1. 正向满意 (Positive)</span>
                </div>
                <p className="opacity-70">
                  买家给出 4~5 星，正文中包含明确的正向赞美词（如“安装方便、自重轻、动力强、发货快”等），且无任何质量抱怨或“但是/可惜”转折句型。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-rose-500 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>2. 五星/四星隐性差评 (Hidden Negative)</span>
                </div>
                <p className="opacity-70">
                  东南亚特色人情给分。买家表面给出 4~5 星高分（多为赚取平台金币、给快递员辛苦分或鼓励店家负责的售后态度），但在正文中使用了明确的转折连词（如但/可是/可惜/แต่/tapi）或直白指出了电池充不进电、BMS故障、链条易脱扣、卡扣脆裂等关键痛点。系统强制校准为负向不满。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>3. 负向不满 (Negative)</span>
                </div>
                <p className="opacity-70">
                  显性低星差评（1~2 星），或正文中直接表达强烈的退货、投诉、货不对板、质量故障等严重不满。
                </p>
              </div>

              <div className={`p-3 rounded-lg border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'}`}>
                <div className="font-bold text-yellow-500 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>4. 中立观望 (Neutral)</span>
                </div>
                <p className="opacity-70">
                  买家给出 3 星，或评论仅描述客观签收事实（如“收到货了”、“刚开始用”），无明显正负情绪偏向。
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSentimentGuideOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors cursor-pointer"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold">历史导入表格记录 (支持点击跳转打开原始表格)</h3>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="opacity-60 hover:opacity-100">
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
                          ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/20' 
                          : (isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700')
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-amber-500' : 'opacity-50'}`} />
                          <button
                            onClick={() => {
                              setPreviewRawTableRecord(item);
                              setHistoryModalOpen(false);
                            }}
                            className="text-xs font-semibold truncate max-w-[240px] text-left hover:underline hover:text-amber-500"
                            title="点击打开此原始表格"
                          >
                            {item.fileName}
                          </button>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40">
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
                          className="px-2 py-1 text-xs rounded border border-neutral-700 hover:bg-neutral-800 text-sky-400 font-medium"
                        >
                          查看原表
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => {
                              onSelectHistory(item);
                              setHistoryModalOpen(false);
                            }}
                            className="px-2.5 py-1 text-xs rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
                          >
                            切换载入
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteHistory(item.id)}
                          className="p-1 rounded opacity-60 hover:text-rose-400 transition-colors"
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

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors cursor-pointer"
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
            { key: 'positive', label: '4-5星满意', count: positive, percentage: positivePercent, color: '#3b82f6', description: '表面评分给足 4~5 星的高满意度好评' },
            { key: 'negative', label: '1-2星差评', count: negative, percentage: negativePercent, color: '#f97316', description: '表面评分仅为 1~2 星的强烈不满低星差评' },
            { key: 'neutral', label: '3星中立', count: neutral, percentage: neutralPercent, color: '#eab308', description: '表面评分 3 星的观望或体验平平评价' },
          ];
        } else if (zoomedRing.chartType === 'content_satisfaction') {
          const { positive, positivePercent, negative, negativePercent, neutral, neutralPercent } = dashboardData.satisfaction.byContent;
          slices = [
            { key: 'positive', label: '真实满意好评', count: positive, percentage: positivePercent, color: '#10b981', description: '经过自然语言文本解析，无转折且全为正面肯定的真实口碑' },
            { key: 'negative', label: '不满/含隐性差评', count: negative, percentage: negativePercent, color: '#f43f5e', description: '包含 1-2 星硬差评 + 五星/四星人情掩饰但文字痛骂的关键客诉' },
            { key: 'neutral', label: '中立观望评价', count: neutral, percentage: neutralPercent, color: '#eab308', description: '文本仅描述到货或无明显情绪倾向的中立评价' },
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
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
            }`}>
              {/* 弹窗头部 */}
              <div className={`p-4 border-b flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <PieChart className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{zoomedRing.chartTitle}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30">
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
                  className={`p-1.5 rounded-lg hover:opacity-80 transition-colors ${
                    isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-neutral-800 text-neutral-400'
                  }`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* 维度切换快速标签栏 */}
              <div className={`px-4 py-2.5 border-b flex items-center gap-2 overflow-x-auto ${
                isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-neutral-950/60 border-neutral-850'
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
                          ? 'shadow-sm text-white'
                          : (isLight ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' : 'bg-neutral-900 hover:bg-neutral-855 text-neutral-300 border-neutral-800')
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
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950/70 border-neutral-800'
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
                          stroke={isLight ? '#e2e8f0' : '#1e293b'}
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
                        <span className="text-xs font-bold mt-0.5 truncate max-w-[130px] leading-tight" title={activeSlice.label}>
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
                        <h4 className="text-base font-bold">{activeSlice.label} · 维度全息穿透</h4>
                      </div>
                      <p className="text-xs opacity-70 mt-1 leading-relaxed">
                        {activeSlice.description}
                      </p>
                    </div>

                    {/* 关键统计指标卡 */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">样本数量</div>
                        <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
                          {activeSlice.count} <span className="text-xs font-normal opacity-70">条</span>
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">总体占比</div>
                        <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                          {activeSlice.percentage}%
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border text-center ${
                        isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
                      }`}>
                        <div className="text-[11px] opacity-60">均星评分</div>
                        <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
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
                        className="px-3.5 py-1.5 text-xs rounded-lg font-semibold bg-sky-600 hover:bg-sky-500 text-white shrink-0 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
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
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
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
                            isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-neutral-950 border-neutral-850 hover:border-neutral-800'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-amber-500">{r.rating}★</span>
                              <span className="font-semibold">{r.buyerName}</span>
                              <span className="font-mono opacity-60 text-[10px]">规格: {r.sku || '默认'}</span>
                              <span className="font-mono opacity-50 text-[10px]">{r.reviewTime}</span>
                            </div>
                            <button
                              onClick={() => {
                                setActiveDrilldownReview(r);
                                setZoomedRing(null);
                              }}
                              className="text-[11px] text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                            >
                              <Eye className="h-3 w-3" />
                              <span>穿透详情</span>
                            </button>
                          </div>

                          {/* 原文 */}
                          <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                            {r.content}
                          </p>

                          {/* 译文 */}
                          {r.contentZh && (
                            <p className={`text-[11px] leading-relaxed pt-0.5 ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                              <span className="text-amber-500 font-medium">中文释义: </span>
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
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
              }`}>
                <button
                  onClick={() => setZoomedRing(null)}
                  className="px-4 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors cursor-pointer"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">批量直接粘贴评论语料 (即贴即分析)</h3>
                  <p className="text-xs opacity-60">支持从 Excel、飞书文档、TXT 复制多行评论直接粘贴分析</p>
                </div>
              </div>
              <button
                onClick={() => setPasteModalOpen(false)}
                className="p-1 rounded hover:opacity-80 transition-colors"
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
                className={`w-full p-3 rounded-lg border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-neutral-950 border-neutral-800 text-neutral-200'
                }`}
              />
              <p className="text-[11px] opacity-60">
                系统将自动对粘贴文本进行东南亚多语言识别、智能清洗（剔除凑字废话与水军）以及大盘多维指标实时计算。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-neutral-700 hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handlePastedData}
                disabled={!pastedText.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-neutral-900 border-neutral-800 text-neutral-100'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  <Share2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">分享与协同分析工作台</h3>
                  <p className="text-xs opacity-60">将此分析控制台无缝共享给运营与产品同事</p>
                </div>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="p-1 rounded hover:opacity-80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-medium opacity-80 block">工作台直接访问链接：</span>
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-neutral-950 border-neutral-800'
                }`}>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? window.location.href : ''}
                    className="bg-transparent text-xs font-mono w-full focus:outline-none"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="px-3 py-1 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedLink ? '已复制！' : '复制链接'}
                  </button>
                </div>
              </div>

              <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                isLight ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
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

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
