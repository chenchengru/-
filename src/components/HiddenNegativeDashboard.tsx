import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, HeartHandshake, Package, Scissors, 
  Palette, Truck, Zap, Download, ChevronRight, Copy, Check, Sparkles, RefreshCw,
  ImageIcon
} from 'lucide-react';
import { StandardReview } from '../types';
import { translateWithGoogleApi } from '../utils/translator';

interface HiddenNegativeDashboardProps {
  reviews: StandardReview[];
  onExport: () => void;
  theme?: 'dark' | 'light';
}

export const HiddenNegativeDashboard: React.FC<HiddenNegativeDashboardProps> = ({
  reviews,
  onExport,
  theme = 'dark'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, string>>({});

  // 筛选出所有高星隐性差评 (五星差评 + 四星差评)
  const hiddenNegatives = reviews.filter(r => r.hiddenNegativeCheck.isHiddenNegative);
  const fiveStarNegatives = hiddenNegatives.filter(r => r.rating === 5);
  const fourStarNegatives = hiddenNegatives.filter(r => r.rating === 4);

  // 按具体痛点分类统计
  const categoryStats: Record<string, number> = {};
  hiddenNegatives.forEach(r => {
    const cat = r.hiddenNegativeCheck.primaryCategory || '其他细节';
    categoryStats[cat] = (categoryStats[cat] || 0) + 1;
  });

  const filteredItems = selectedCategory === 'all'
    ? hiddenNegatives
    : hiddenNegatives.filter(r => r.hiddenNegativeCheck.primaryCategory === selectedCategory);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleForceRetranslate = async (review: StandardReview) => {
    setTranslatingId(review.id);
    try {
      const full = await translateWithGoogleApi(review.content, review.language || 'auto');
      if (full) {
        setDynamicTranslations(prev => ({ ...prev, [review.id]: full }));
      }
    } catch (e) {}
    setTranslatingId(null);
  };

  const isLight = theme === 'light';

  return (
    <div className="space-y-6">
      {/* 专区核心警示 Banner */}
      <div className={`p-5 rounded-xl border relative overflow-hidden ${
        isLight 
          ? 'bg-rose-50 border-rose-200 text-slate-900' 
          : 'bg-neutral-900 border-rose-900/40 text-white'
      }`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                最高优先级专项诊断 · 隐性不满雷区
              </span>
              <span aria-hidden="true" className={isLight ? 'text-slate-300' : 'text-neutral-600'}>·</span>
              <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                共捕获 <strong className="text-rose-500 font-mono text-sm">{hiddenNegatives.length}</strong> 条高星人情差评
              </span>
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              五星差评 / 四星差评深度穿透专区
            </h1>
            <p className={`text-xs max-w-3xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
              东南亚（泰国、印尼等）普遍存在“人情评价”、“给5星鼓励”、“怕被骚扰”或“为领Shopee金币随手点满星”的本土习惯。
              表面上综合评分看似高达 4.8★，但在评论正文中却充斥着“电池充不进电”、“链条易脱落”、“塑料护罩折断”等致命缺陷。
              若不单独剔除深挖，将直接导致隐性退货暴增与自然复购归零！
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>五星鼓励差评</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-rose-500">
                {fiveStarNegatives.length} <span className="text-xs font-normal opacity-70">条</span>
              </div>
            </div>
            <div className={`h-8 w-px ${isLight ? 'bg-slate-300' : 'bg-neutral-800'}`} />
            <div className="text-right">
              <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>四星扣分差评</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-500">
                {fourStarNegatives.length} <span className="text-xs font-normal opacity-70">条</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 东南亚三大文化心理成因对照 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-4 rounded-xl border space-y-2 text-xs ${
          isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            <HeartHandshake className="h-4 w-4 text-amber-500" />
            <span>1. 泰国人情面子文化 (Kreng Jai)</span>
          </div>
          <p className="opacity-70 leading-relaxed text-[11px]">
            典型买家口吻：“<span className="font-medium text-amber-600">ให้ 5 ดาวเป็นกำลังใจค่ะ แต่...</span>”（打五星是给店家鼓励，但是电池充不了电）。
            买家习惯性保持礼貌友善，对卖家售后态度好表示感谢，但在文字中一五一十写满硬伤。
          </p>
        </div>

        <div className={`p-4 rounded-xl border space-y-2 text-xs ${
          isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            <Zap className="h-4 w-4 text-sky-500" />
            <span>2. 平台金币羊毛党 (Shopee Coins)</span>
          </div>
          <p className="opacity-70 leading-relaxed text-[11px]">
            买家为了领取满评金币，随手打5星并长文吐槽。如果不细读文本，单纯看星级就会被高评分彻底麻痹，错失黄金改良期。
          </p>
        </div>

        <div className={`p-4 rounded-xl border space-y-2 text-xs ${
          isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4 text-rose-500" />
            <span>3. 快递辛苦分与产品混淆</span>
          </div>
          <p className="opacity-70 leading-relaxed text-[11px]">
            五星打给当地派件快递员辛苦送货，而正文却在怒批“导板反装”、“链条脱扣”。系统通过自然语言处理将其强制校准为负向不满。
          </p>
        </div>
      </div>

      {/* 痛点分类过滤器 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-amber-600 text-white font-semibold'
              : (isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800')
          }`}
        >
          全部痛点 ({hiddenNegatives.length})
        </button>

        {Object.entries(categoryStats).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-rose-600 text-white font-semibold'
                : (isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800')
            }`}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      {/* 隐性差评深度穿透卡片列表 */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className={`p-12 text-center rounded-xl border opacity-60 text-xs ${
            isLight ? 'bg-white border-slate-200' : 'bg-neutral-900 border-neutral-800'
          }`}>
            暂无该分类下的隐性差评数据
          </div>
        ) : (
          filteredItems.map((review) => {
            const isFiveStar = review.rating === 5;
            const currentZh = dynamicTranslations[review.id] || review.contentZh;

            return (
              <div 
                key={review.id}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900/90 border-neutral-800'
                }`}
              >
                {/* 头部：表面星级 vs 真实痛点 */}
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b ${
                  isLight ? 'border-slate-200' : 'border-neutral-850'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                      isFiveStar ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-neutral-800 text-neutral-300'
                    }`}>
                      表面评分: {review.rating} ★
                    </span>
                    <span className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      真实情感: 负向不满 (核心痛点: {review.hiddenNegativeCheck.primaryCategory})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs opacity-60 font-mono">
                    <span>{review.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{review.platform.toUpperCase()}</span>
                    <span aria-hidden="true">·</span>
                    <span>SKU: {review.sku}</span>
                  </div>
                </div>

                {/* 核心内容对比：原文 vs Google 逐句翻译 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* 买家原文 */}
                  <div className="space-y-1">
                    <div className="opacity-60 flex items-center justify-between">
                      <span>买家原文 ({review.languageLabel}):</span>
                      <button
                        onClick={() => handleCopy(review.content, `${review.id}-raw`)}
                        className="text-[11px] opacity-70 hover:opacity-100 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === `${review.id}-raw` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>复制原文</span>
                      </button>
                    </div>
                    <div className={`p-3 rounded-lg border leading-relaxed font-sans ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-neutral-950 border-neutral-850 text-neutral-200'
                    }`}>
                      {review.content}
                    </div>
                  </div>

                  {/* Google 完整逐句译文 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between opacity-60">
                      <span className="flex items-center gap-1 text-amber-500 font-semibold">
                        <Sparkles className="h-3 w-3" />
                        <span>Google Translate 逐句完整译文:</span>
                      </span>
                      <button
                        onClick={() => handleForceRetranslate(review)}
                        disabled={translatingId === review.id}
                        className="text-[11px] text-sky-500 hover:underline flex items-center gap-1 cursor-pointer"
                        title="重新请求谷歌翻译引擎完整转译"
                      >
                        <RefreshCw className={`h-3 w-3 ${translatingId === review.id ? 'animate-spin' : ''}`} />
                        <span>{translatingId === review.id ? '正在翻译...' : '重新翻译'}</span>
                      </button>
                    </div>
                    <div className={`p-3 rounded-lg border leading-relaxed ${
                      isLight 
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
                        : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                    }`}>
                      {currentZh || '无额外释义'}
                    </div>
                  </div>
                </div>

                {/* 提取的不满点与针对性改进策略 */}
                <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  isLight ? 'bg-rose-50 border-rose-200' : 'bg-rose-950/20 border-rose-900/30'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="text-rose-500 font-semibold shrink-0">提取具体痛点：</span>
                    <span className="font-medium text-rose-600 dark:text-rose-200">
                      {review.hiddenNegativeCheck.extractedGrievances.join('；')}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 font-semibold shrink-0">运营反制指引：</span>
                    <span className="opacity-90 leading-relaxed">
                      {review.hiddenNegativeCheck.businessImpact}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
