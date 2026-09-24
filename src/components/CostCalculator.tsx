import React, { useState, useMemo } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, TrendingDown, Clock, ShieldCheck, DollarSign } from 'lucide-react';

export const CostCalculator: React.FC = () => {
  const [skuCount, setSkuCount] = useState<number>(10);
  const [reviewsPerSku, setReviewsPerSku] = useState<number>(500);

  const totalMonthlyReviews = useMemo(() => {
    return skuCount * reviewsPerSku;
  }, [skuCount, reviewsPerSku]);

  // 计算各方案成本与耗时
  const calculation = useMemo(() => {
    // 方案A: 飞书多维表原生 (免费额度按每月 1000 次AI字段算，超额购买约 0.05元/次)
    const feishuFreeQuota = 1000;
    const feishuOverQuota = Math.max(0, totalMonthlyReviews - feishuFreeQuota);
    const feishuCost = Math.round(feishuOverQuota * 0.05);
    const feishuHours = Math.round((totalMonthlyReviews * 2.5) / 3600); // 飞书逐行队列排队耗时

    // 方案B: 本地工作台 (0元，耗时几乎为0)
    const localCost = 0;
    const localHours = Math.max(0.5, Math.round((skuCount * 2) / 60)); // 仅拖拽点击耗时

    // 方案C: Codex脚本 + 中转站API (DeepSeek按 0.0015元/条算)
    const apiCost = Math.round(totalMonthlyReviews * 0.0015);
    const apiHours = 2; // 维护脚本与环境耗时

    // 方案E: 纯大模型手动复制粘贴
    const manualHours = Math.round((totalMonthlyReviews / 100) * 0.4); // 每次粘贴100条耗时25分钟

    return {
      feishuCost,
      feishuOverQuota,
      feishuHours,
      localCost,
      localHours,
      apiCost,
      apiHours,
      manualHours
    };
  }, [totalMonthlyReviews, skuCount]);

  return (
    <div className="space-y-6">
      {/* 顶部标题与参数调整滑块 */}
      <div className="p-5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-emerald-400" />
              跨境团队方案落地投入产出比 (ROI) 动态测算器
            </span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="text-xs text-neutral-400">单人 / 小型跨境团队成本敏感模型</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            月度评论分析规模与五大方案成本耗时测算
          </h1>
          <p className="text-xs text-neutral-400 max-w-3xl leading-relaxed">
            拖动下方滑块调整你店铺的实际业务规模，系统将实时动态计算五套方案在资金成本、人工耗时与额度超标风险上的表现。
          </p>
        </div>

        {/* 动态滑块控制区 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-neutral-800">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">每月需分析的 SKU / 商品数:</span>
              <span className="font-mono text-amber-400 font-bold tabular-nums text-sm">{skuCount} 款</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={skuCount}
              onChange={(e) => setSkuCount(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
              <span>1款 (单品测款)</span>
              <span>25款 (腰部精品)</span>
              <span>50款 (多店铺矩阵)</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">单商品平均提取评论条数:</span>
              <span className="font-mono text-amber-400 font-bold tabular-nums text-sm">{reviewsPerSku} 条/款</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={reviewsPerSku}
              onChange={(e) => setReviewsPerSku(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-600 font-mono">
              <span>100条 (新品测款)</span>
              <span>1,000条 (主推爆款)</span>
              <span>2,000条 (大类目竞品对标)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded bg-neutral-950 border border-neutral-800 text-xs">
          <span className="text-neutral-400">
            📊 测算基准总量：月处理评论数据 <strong className="font-mono text-amber-400 text-sm">{totalMonthlyReviews.toLocaleString()}</strong> 条
          </span>
          <span className="text-neutral-500 text-[11px]">
            数据规模：{totalMonthlyReviews <= 5000 ? '中小规模 (轻量)' : (totalMonthlyReviews <= 20000 ? '中等规模 (精品卖家)' : '大规模 (大卖/铺货)')}
          </span>
        </div>
      </div>

      {/* 5套方案实时测算对比卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 方案B: 本地工作台方案 (高亮推荐) */}
        <div className="p-4 rounded-lg bg-neutral-900 border-2 border-emerald-500/60 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              方案 B: 本地工作台 (本系统)
            </span>
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded font-semibold">
              架构师首选
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-500">每月资金花费 (API费用):</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              ¥0 <span className="text-xs font-normal text-neutral-400">/ 完全免费</span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-neutral-800 text-xs text-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-500">月耗人工工时:</span>
              <span className="font-mono text-neutral-200">{calculation.localHours} 小时 (即拖即看)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">代码/环境门槛:</span>
              <span className="text-emerald-400 font-semibold">零代码 · 免安装</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">五星差评识别:</span>
              <span className="text-emerald-400 font-semibold">内置毫秒级规则</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            纯本地执行，数据不上传第三方服务器，无额度超标风险，单人团队零预算的最佳落地点。
          </p>
        </div>

        {/* 方案A: 飞书多维表原生 */}
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
              方案 A: 飞书多维表原生
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              AI 字段模式
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-500">每月预计 AI 额度花费:</div>
            <div className="text-2xl font-bold font-mono text-sky-400 tabular-nums">
              ¥{calculation.feishuCost} <span className="text-xs font-normal text-neutral-400">/ 月</span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-neutral-800 text-xs text-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-500">超出免费额度:</span>
              <span className="font-mono text-rose-400 font-semibold">
                {calculation.feishuOverQuota > 0 ? `超额 ${calculation.feishuOverQuota} 次` : '免费额度内'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">后台排队耗时:</span>
              <span className="font-mono text-neutral-200">约 {calculation.feishuHours} 小时/月</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">团队协同性:</span>
              <span className="text-sky-400 font-semibold">极高 (飞书原生生态)</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            超过每月1000条后飞书免费AI额度将被耗尽，适合用工作台预洗后导入，规避超额费用。
          </p>
        </div>

        {/* 方案C: Codex脚本 + 中转站API */}
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
              方案 C: Codex脚本 + 中转站
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Python 并发
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-500">中转站 Token 成本:</div>
            <div className="text-2xl font-bold font-mono text-neutral-200 tabular-nums">
              ¥{calculation.apiCost} <span className="text-xs font-normal text-neutral-400">/ 月 (极低)</span>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-neutral-800 text-xs text-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-500">脚本维护耗时:</span>
              <span className="font-mono text-neutral-200">约 {calculation.apiHours} 小时/月</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">环境依赖:</span>
              <span className="text-rose-400 font-semibold">需 Python / API Key</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">抗并发能力:</span>
              <span className="text-emerald-400 font-semibold">极强 (多线程并发)</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            调用成本极低，但运营人员需面对 API 充值、脚本报错、网络波动等技术运维琐事。
          </p>
        </div>
      </div>

      {/* 方案E人工成本对比警告 */}
      <div className="p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-neutral-300">
          <div className="font-semibold text-neutral-200">
            为什么坚决不建议单人团队采用「方案 E: 纯对话大模型手动投喂」？
          </div>
          <p className="text-neutral-400 leading-relaxed">
            按当前 <strong className="text-neutral-200 font-mono">{totalMonthlyReviews.toLocaleString()}</strong> 条的月处理规模，
            若采用人工分批复制粘贴到网页端（每次约100条），每月将浪费约 <strong className="text-rose-400 font-mono font-bold">{calculation.manualHours} 小时</strong> 的机械劳动！
            不仅极易遗漏“五星差评”，而且单次对话长上下文极易产生幻觉与规则遗忘，耗费大量宝贵的运营精力。
          </p>
        </div>
      </div>
    </div>
  );
};
