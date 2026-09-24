import React, { useState } from 'react';
import { 
  Sparkles, CheckCircle2, AlertCircle, TrendingUp, Layers, 
  Target, Swords, ArrowRight, ShieldCheck, HelpCircle, Check, Copy,
  Info, Cpu, BookOpen, SlidersHorizontal
} from 'lucide-react';
import { ScenarioInsights as ScenarioInsightsType } from '../types';

interface ScenarioInsightsProps {
  insights: ScenarioInsightsType;
  theme?: 'dark' | 'light';
}

export const ScenarioInsights: React.FC<ScenarioInsightsProps> = ({ 
  insights,
  theme = 'dark'
}) => {
  const [activeScenario, setActiveScenario] = useState<'selection' | 'listing' | 'competitor'>('selection');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // 竞品对标角色切换：当前数据是竞品还是我品
  const [competitorMode, setCompetitorMode] = useState<'competitor_weakness' | 'self_diagnostic'>('competitor_weakness');
  const [showCompetitorExplainer, setShowCompetitorExplainer] = useState<boolean>(true);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isLight = theme === 'light';

  return (
    <div className="space-y-6">
      {/* 顶部场景切换分段控制器 */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
      }`}>
        <div className="space-y-0.5">
          <div className="text-xs text-amber-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>智能商业决策推演系统</span>
          </div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            评论大数据赋能跨境电商三大核心业务决策
          </h2>
          <p className="text-xs opacity-60">
            品类自动识别：{insights.productCategory === 'tools_hardware' ? '⚙️ 电动工具与五金设备' : (insights.productCategory === 'apparel_fashion' ? '👗 服饰箱包' : '📦 通用跨境商品')} · 100%基于原始数据动态提炼
          </p>
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-lg border ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-neutral-950 border-neutral-800'
        }`}>
          <button
            onClick={() => setActiveScenario('selection')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeScenario === 'selection' 
                ? 'bg-amber-600 text-white font-semibold shadow-sm' 
                : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-white')
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>1. 选品决策看板</span>
          </button>

          <button
            onClick={() => setActiveScenario('listing')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeScenario === 'listing' 
                ? 'bg-amber-600 text-white font-semibold shadow-sm' 
                : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-white')
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            <span>2. Listing优化看板</span>
          </button>

          <button
            onClick={() => setActiveScenario('competitor')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeScenario === 'competitor' 
                ? 'bg-amber-600 text-white font-semibold shadow-sm' 
                : (isLight ? 'text-slate-600 hover:text-slate-900' : 'text-neutral-400 hover:text-white')
            }`}
          >
            <Swords className="h-3.5 w-3.5" />
            <span>3. 竞品对标看板</span>
          </button>
        </div>
      </div>

      {/* 场景 1: 选品决策 */}
      {activeScenario === 'selection' && (
        <div className="space-y-6">
          {/* 高频刚需与未满足痛点 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 高频刚需 */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isLight ? 'text-slate-800' : 'text-neutral-200'
                }`}>
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span>当地买家高频期待特征 (Must-have Features)</span>
                </h3>
                <span className="text-[11px] opacity-60 font-mono">买家赞誉频次</span>
              </div>

              <div className="space-y-2.5">
                {insights.selectionSignals.highFrequencyDemands.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border space-y-1 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{item.keyword}</span>
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="opacity-70">{item.count}次提及</span>
                        <span className="text-emerald-500 font-semibold">{item.sentimentScore}% 满意</span>
                      </div>
                    </div>
                    <p className="text-[11px] opacity-70 leading-relaxed">
                      💡 选品建议: {item.suggestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 未满足诉求 (纯真实数据聚类，彻底去除面料相关文本) */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span>未满足的痛点与改良商机 (Differentiating Gaps)</span>
                </h3>
                <span className="text-[11px] opacity-60 font-mono">客诉抱怨率</span>
              </div>

              <div className="space-y-2.5">
                {insights.selectionSignals.unmetNeeds.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border space-y-1.5 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-500">{item.need}</span>
                      <span className="font-mono text-rose-500 font-semibold text-[11px]">{item.mentionRate}</span>
                    </div>
                    <p className="text-[11px] opacity-70 leading-relaxed">
                      🛠️ 解决方案: {item.solution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SKU 规格表现差异 */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
              📊 SKU 变体梯队分析 (保留优势、淘汰落后)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.selectionSignals.skuPreferenceDiff.map((sku, i) => (
                <div key={i} className={`p-3 rounded-lg border space-y-2 text-xs ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold truncate max-w-[140px]" title={sku.sku}>{sku.sku}</span>
                    <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      sku.positiveRatio >= 80 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'
                    }`}>
                      {sku.positiveRatio}% 好评
                    </span>
                  </div>
                  <div className="text-[11px] opacity-70">
                    <span className="opacity-50">主要抱怨: </span>
                    <span className="text-rose-400">{sku.complaintPoint}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 供应链与选品避坑警示 */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              <span>供应链品控与选品防踩坑警示</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-amber-200/90 leading-relaxed">
              {insights.selectionSignals.riskWarnings.map((warn, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{warn}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 场景 2: Listing优化 */}
      {activeScenario === 'listing' && (
        <div className="space-y-6">
          {/* 本土买家高频词根 (真实提炼，绝无硬编码面料) */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isLight ? 'text-slate-800' : 'text-neutral-200'
                }`}>
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>东南亚本土买家原声高频词根 (拒绝生硬死板机翻)</span>
                </h3>
                <p className="text-[11px] opacity-60">
                  可直接复制植入 Shopee / Lazada 标题、五点描述与后台搜索词 Search Terms
                </p>
              </div>
              <span className="text-[11px] opacity-60 font-mono">共推荐 {insights.listingSignals.authenticBuyerKeywords.length} 组本土词</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.listingSignals.authenticBuyerKeywords.map((kw, i) => (
                <div key={i} className={`p-3 rounded-lg border space-y-2 text-xs relative ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-amber-500 font-bold text-sm">{kw.original}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-neutral-800 text-neutral-300">
                      建议植入: {kw.targetPosition === 'title' ? '标题首部' : (kw.targetPosition === 'bullet' ? '五点描述' : '搜索词')}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium opacity-90">
                    中文含义: {kw.zh}
                  </div>
                  <p className="text-[11px] opacity-60 leading-relaxed">
                    💡 使用场景: {kw.usageScenario}
                  </p>
                  <button
                    onClick={() => handleCopy(kw.original)}
                    className="absolute bottom-2.5 right-2.5 p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    title="复制该买家原生词"
                  >
                    {copiedText === kw.original ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 卖点感知核验 */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
              🔍 Listing 核心卖点“买家实际感知真伪核验”
            </h3>
            <div className="space-y-2.5">
              {insights.listingSignals.valueClaimsAudit.map((claim, i) => (
                <div key={i} className={`p-3 rounded-lg border space-y-1.5 text-xs ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{claim.claim}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      claim.customerPerception === 'verified' 
                        ? 'bg-emerald-500/20 text-emerald-500' 
                        : 'bg-rose-500/20 text-rose-500'
                    }`}>
                      {claim.customerPerception === 'verified' ? '买家感知一致' : '疑似过度宣传/买家吐槽'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-70 leading-relaxed">
                    🗣️ 买家原声证据: {claim.buyerVoice}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 主图方向与品类自适应的防踩坑参数规范 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                🖼️ 主图与 A+ 详情页实拍方向修正
              </h3>
              <ul className="space-y-2 text-xs">
                {insights.listingSignals.imageGuidance.map((img, i) => (
                  <li key={i} className={`p-2.5 rounded-lg border space-y-1 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                  }`}>
                    <div className="font-semibold text-amber-500">{img.advice}</div>
                    <div className="text-[11px] opacity-70 leading-relaxed">{img.reason}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 品类自适应：电锯展示工具规格规范，非服装尺码 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                {insights.productCategory === 'tools_hardware' 
                  ? '⚙️ 电动工具规格与配件参数防踩坑建议' 
                  : (insights.productCategory === 'apparel_fashion' ? '📏 东南亚本土尺码表修正防踩坑建议' : '📦 规格参数与尺寸防踩坑建议')}
              </h3>
              <ul className="space-y-2 text-xs">
                {insights.listingSignals.specCorrections.map((sc, i) => (
                  <li key={i} className={`p-2.5 rounded-lg border leading-relaxed text-[11px] ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                  }`}>
                    {sc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 场景 3: 竞品对标 (增加详细作用解释与模式切换) */}
      {activeScenario === 'competitor' && (
        <div className="space-y-6">
          {/* 竞品对标作用说明卡片 (回答用户“作用是什么，当前并没有上传我方商品”的疑问) */}
          {showCompetitorExplainer && (
            <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Info className="h-4 w-4 shrink-0" />
                  <span>【竞品对标看板】业务价值与使用说明</span>
                </div>
                <button 
                  onClick={() => setShowCompetitorExplainer(false)}
                  className="text-xs text-sky-400 opacity-60 hover:opacity-100"
                >
                  收起说明
                </button>
              </div>

              <div className="text-xs text-sky-200/90 space-y-1.5 leading-relaxed">
                <p>
                  <strong>💡 为什么需要这个看板？</strong> 跨境电商在 Shopee / Lazada 运营中，卖家往往会通过插件或爬虫导出【同行热卖竞品】的原始评价数据进行分析。
                </p>
                <p>
                  <strong>🎯 核心战术：</strong> “用竞品被买家骂得最狠的痛点，做我方产品的差异化卖点”。例如：竞品电池充不进电、BMS烧坏、链条易滑脱，我方在写 Listing 和选品时，就重点主打【配品牌A品电芯+智能BMS保护板+加粗防脱链】，从而截流竞品买家！
                </p>
              </div>

              {/* 模式切换器 */}
              <div className="flex items-center gap-2 pt-1 border-t border-sky-900/40 text-xs">
                <span className="text-sky-300 font-semibold">当前分析数据归属模式:</span>
                <button
                  onClick={() => setCompetitorMode('competitor_weakness')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    competitorMode === 'competitor_weakness'
                      ? 'bg-sky-500 text-white font-bold'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  ① 当前导入的是【同行竞品数据】(拆解竞品短板，做我方截流打法)
                </button>

                <button
                  onClick={() => setCompetitorMode('self_diagnostic')}
                  className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    competitorMode === 'self_diagnostic'
                      ? 'bg-sky-500 text-white font-bold'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  ② 当前导入的是【我方自营数据】(自我弱项体检，防止被同行反打)
                </button>
              </div>
            </div>
          )}

          {/* 竞品致命短板与反击策略 */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
          }`}>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                <Swords className="h-4 w-4 text-rose-500" />
                <span>
                  {competitorMode === 'competitor_weakness' 
                    ? '竞品被吐槽最多的致命短板 ➔ 我方差异化截流策略' 
                    : '我方自营产品高频客诉点 ➔ 急需加固的防守短板'}
                </span>
              </h3>
              <p className="text-[11px] opacity-60">
                深挖负向留评共性缺陷，作为主图与五点描述的直接截流或防御核心武器
              </p>
            </div>

            <div className="space-y-3">
              {insights.competitorSignals.competitorWeaknesses.map((item, i) => (
                <div key={i} className={`p-3.5 rounded-lg border space-y-2 text-xs ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-500 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {item.theme}
                    </span>
                    <span className="text-[11px] opacity-60 font-mono">
                      {competitorMode === 'competitor_weakness' ? '截流机会点' : '急需整改'}
                    </span>
                  </div>
                  <div className={`p-2 rounded text-[11px] ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-neutral-900 text-neutral-300'}`}>
                    <strong>买家集中吐槽现象:</strong> {item.failurePoint}
                  </div>
                  <div className={`p-2 rounded border text-[11px] leading-relaxed ${
                    isLight 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                  }`}>
                    <strong>🎯 我方反击截流打法:</strong> {item.counterStrategy}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 优势主题与价格敏感度 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isLight ? 'text-slate-800' : 'text-neutral-200'
              }`}>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>市场认可度高的高光特征 (可加固为品牌护城河)</span>
              </h3>
              <div className="space-y-2">
                {insights.competitorSignals.ourAdvantages.map((adv, i) => (
                  <div key={i} className={`p-3 rounded-lg border space-y-1 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
                  }`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{adv.theme}</span>
                      <span className="font-mono text-emerald-500 font-bold">优势指数 +{adv.netScore}</span>
                    </div>
                    <p className="text-[11px] opacity-70 leading-relaxed">{adv.remark}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-4 rounded-xl border space-y-3 ${
              isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-neutral-900 border-neutral-800'
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                💰 价格与运费敏感度洞察
              </h3>
              <p className="text-xs opacity-80 leading-relaxed">
                {insights.competitorSignals.priceSensitivity}
              </p>
              <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-850'
              }`}>
                <span className="font-semibold text-amber-500">运营落地建议:</span>
                <p className="text-[11px] opacity-70">
                  针对本土买家习惯，合理设置【加价购配件 (如备用链条/第二块电池)】可有效拉升客单价，并稀释长途跨境物流的头程运费。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
