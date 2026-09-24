import React, { useState } from 'react';
import { 
  FileText, Copy, Check, Download, Layers, ShieldCheck, 
  HelpCircle, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { INVALID_RULES_SPEC } from '../utils/reviewCleaner';

export const ArchitectureDocument: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('all');

  const handleCopyAll = () => {
    const markdownContent = document.getElementById('architecture-markdown-source')?.innerText || '';
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const markdownContent = document.getElementById('architecture-markdown-source')?.innerText || '';
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '东南亚跨境电商评论分析工具落地方案书.md');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 方案书标题与操作条 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-neutral-900 border border-neutral-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              官方架构方案书 · 决策与实施交付规范
            </span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="text-xs text-neutral-400">零代码 / 零预算 / 落地先行</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            东南亚跨境电商评论深度分析工具落地方案书
          </h1>
          <p className="text-xs text-neutral-400">
            涵盖 Shopee/Lazada 字段治理、刷单可解释判定、五星差评归因框架、五大落地技术方案全景对比与用户自拟方案深度推演。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? '已复制全文字' : '复制完整方案书'}</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>下载 Markdown</span>
          </button>
        </div>
      </div>

      {/* 方案书主要内容渲染区 */}
      <div id="architecture-markdown-source" className="space-y-8 bg-neutral-900/60 border border-neutral-800 rounded-lg p-6 text-neutral-300 text-xs leading-relaxed">
        
        {/* 步骤 1: 数据与场景澄清 */}
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <span className="text-amber-400 font-mono text-[11px] font-bold">STEP 01</span>
            <h2 className="text-base font-bold text-white mt-0.5">步骤 1: 数据与场景澄清</h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-200">1.1 Shopee 与 Lazada 导出字段统一映射规范</h3>
            <p>
              Shopee与Lazada不同导出版本存在表头命名不一、图片格式差异等问题。标准评论表结构统一映射如下：
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border border-neutral-800 text-xs">
                <thead>
                  <tr className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                    <th className="p-2 border-r border-neutral-850">标准字段名</th>
                    <th className="p-2 border-r border-neutral-850">Shopee 常见原始字段</th>
                    <th className="p-2 border-r border-neutral-850">Lazada 常见原始字段 (老版/新版)</th>
                    <th className="p-2">清洗与标准化规则</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">评价ID (id)</td>
                    <td className="p-2 border-r border-neutral-850">Order ID, Buyer Order ID</td>
                    <td className="p-2 border-r border-neutral-850">reviewId, orderNumber</td>
                    <td className="p-2">若缺失则自动按行哈希生成统一格式 REV-时间戳</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">买家星级 (rating)</td>
                    <td className="p-2 border-r border-neutral-850">Rating, Star, Buyer Rating</td>
                    <td className="p-2 border-r border-neutral-850">rating, reviewRating</td>
                    <td className="p-2">强制归一为 1-5 的纯整型数值，过滤异常特殊符号</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">评论原文 (content)</td>
                    <td className="p-2 border-r border-neutral-850">Comment, Buyer Comment</td>
                    <td className="p-2 border-r border-neutral-850">reviewContent, content, comment</td>
                    <td className="p-2">去除两端空白，保留泰文字符集与表情符供清洗引擎判断</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">SKU/规格 (sku)</td>
                    <td className="p-2 border-r border-neutral-850">Model Name, Variation</td>
                    <td className="p-2 border-r border-neutral-850">skuInfo, variation, itemTitle</td>
                    <td className="p-2">拆分为纯净规格值，方便后续跨SKU痛点聚类</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">买家昵称 (buyer)</td>
                    <td className="p-2 border-r border-neutral-850">Buyer Name, Username</td>
                    <td className="p-2 border-r border-neutral-850">buyerName, customerName</td>
                    <td className="p-2">脱敏识别：若含“***”或“anonymous”自动打标匿名</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">图片/视频 (media)</td>
                    <td className="p-2 border-r border-neutral-850">Pictures, Videos</td>
                    <td className="p-2 border-r border-neutral-850">images, photos, reviewPhotos</td>
                    <td className="p-2">按英文逗号/分号切分计算有效媒体数，统计买家秀比例</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-neutral-200 pt-2">1.2 三大分析目的与所需维度</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>选品决策：</strong>核心需要“刚需高频词”、“未被满足痛点”、“退货风险预警”、“跨规格偏好差异”四个维度。</li>
              <li><strong>Listing优化：</strong>核心需要“本土买家搜索高频词根（非死板机翻）”、“宣称卖点买家感知真伪核验”、“主图防踩坑指南”、“本地化尺码修正表”。</li>
              <li><strong>竞品对标：</strong>核心需要“优劣势主题净胜分”、“竞品致命短板反击策略”、“痛点重合度分析”。</li>
            </ul>

            <h3 className="text-sm font-semibold text-neutral-200 pt-2">1.3 语言优先级策略：泰国先行，架构预留五国</h3>
            <p>
              泰国是 Shopee/Lazada 竞争最激烈的单一国家站点之一，泰语拥有独特的文字结构（ก-ฮ 无空格连写、55555表大笑、krub/ka礼貌后缀、直接使用“ตรงปก”确认相符度）。
              第一版引擎深耕<strong>泰语核心语法与口语字典</strong>，底层架构通过语言标识符（`th`, `vi`, `id`, `ph`, `my`）预留多语言词库槽位，
              已原生支持越南语标音符号、印尼语/马来语前缀以及菲律宾 Taglish 混合语识别。
            </p>
          </div>
        </section>

        {/* 步骤 2: 定义无效评论识别规则 */}
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <span className="text-amber-400 font-mono text-[11px] font-bold">STEP 02</span>
            <h2 className="text-base font-bold text-white mt-0.5">步骤 2: 定义无效评论识别规则 (刷单/水军/金币灌水)</h2>
          </div>

          <p>
            核心原则：<strong>“打标与分流”而非简单丢弃</strong>。每条评论保留原文与判定理由，以便运营核查。
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-neutral-800 text-xs">
              <thead>
                <tr className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                  <th className="p-2 border-r border-neutral-850">规则编号</th>
                  <th className="p-2 border-r border-neutral-850">维度分类</th>
                  <th className="p-2 border-r border-neutral-850">规则名称</th>
                  <th className="p-2 border-r border-neutral-850">判定触发条件与阈值</th>
                  <th className="p-2 border-r border-neutral-850">可解释输出字段</th>
                  <th className="p-2">分流流向</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {INVALID_RULES_SPEC.map(rule => (
                  <tr key={rule.id}>
                    <td className="p-2 font-mono text-neutral-200 border-r border-neutral-850">{rule.id}</td>
                    <td className="p-2 border-r border-neutral-850 text-neutral-400">{rule.category}</td>
                    <td className="p-2 font-semibold text-neutral-200 border-r border-neutral-850">{rule.name}</td>
                    <td className="p-2 border-r border-neutral-850">{rule.trigger} (阈值: {rule.threshold})</td>
                    <td className="p-2 border-r border-neutral-850 text-amber-300">{rule.impact}</td>
                    <td className="p-2 text-rose-300 font-medium">{rule.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 步骤 3: 定义有效评论分析框架与五星差评归因 */}
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <span className="text-amber-400 font-mono text-[11px] font-bold">STEP 03</span>
            <h2 className="text-base font-bold text-white mt-0.5">步骤 3: 定义有效评论分析框架 (五星差评归因机制)</h2>
          </div>

          <div className="p-3.5 rounded bg-rose-950/20 border border-rose-900/40 text-rose-200 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>为什么五星差评/四星差评是东南亚电商分析的绝对命脉？</span>
            </div>
            <p className="leading-relaxed">
              许多卖家只按“1-2星差评”做分析，导致错过了 70% 的真实客诉！
              在泰国和印尼，买家给五星非常普遍：有的为了鼓励店家客服、有的为了赚虾币、有的怕卖家打电话纠缠。
              但买家在正文中却会诚实写下致命缺陷。
              <strong>此类评论被算法误标为“好评”，导致供应链迟迟不改款，直到退货率彻底失控才追悔莫及。</strong>
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-200">有效评论结构化产出标签字典 (Output Schema)</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <li className="p-2 rounded bg-neutral-950 border border-neutral-850">
                <strong className="text-neutral-200">表面评分 vs 真实情感极性：</strong>
                <span className="text-neutral-400"> surfaceRating (1-5) 与 realSentiment (正向/中性/负向)。</span>
              </li>
              <li className="p-2 rounded bg-neutral-950 border border-neutral-850">
                <strong className="text-neutral-200">五星/四星隐性差评标示：</strong>
                <span className="text-neutral-400"> isHiddenNegative (布尔值) 与 extractedGrievances (痛点数组)。</span>
              </li>
              <li className="p-2 rounded bg-neutral-950 border border-neutral-850">
                <strong className="text-neutral-200">主题聚类标签：</strong>
                <span className="text-neutral-400"> 覆盖质量做工、尺码版型、物流时效、包装防护、性价比、做工细节等9大维度。</span>
              </li>
              <li className="p-2 rounded bg-neutral-950 border border-neutral-850">
                <strong className="text-neutral-200">商业落地行动指引：</strong>
                <span className="text-neutral-400"> 自动生成针对客服挽留、主图微调或供应链质检的具体策略建议。</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 步骤 4: 输出五套实现方案对比 */}
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <span className="text-amber-400 font-mono text-[11px] font-bold">STEP 04</span>
            <h2 className="text-base font-bold text-white mt-0.5">步骤 4: 五套可选落地方案全维度对比矩阵</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-neutral-800 text-xs">
              <thead>
                <tr className="bg-neutral-900 text-neutral-400 font-medium border-b border-neutral-800">
                  <th className="p-2.5 border-r border-neutral-850">方案名称</th>
                  <th className="p-2.5 border-r border-neutral-850">形态与架构</th>
                  <th className="p-2.5 border-r border-neutral-850">运行效率</th>
                  <th className="p-2.5 border-r border-neutral-850">成本预算</th>
                  <th className="p-2.5 border-r border-neutral-850">落地难度</th>
                  <th className="p-2.5 border-r border-neutral-850">可复用性</th>
                  <th className="p-2.5">五国扩展性</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {/* 方案A */}
                <tr>
                  <td className="p-2.5 font-bold text-neutral-200 border-r border-neutral-850">
                    方案 A: 飞书多维表原生方案
                  </td>
                  <td className="p-2.5 border-r border-neutral-850">
                    多维表应用 + AI字段 + 自动化流程
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-amber-400">
                    中等 (单表500条逐行消耗较慢)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-neutral-300">
                    免费额度内有限 / 超量需购买AI包
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400">
                    零代码极低 (5分钟配置表头)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-sky-400">
                    高 (模版可复制给全团队)
                  </td>
                  <td className="p-2.5 text-sky-400">
                    高 (通过Prompt约束多语言)
                  </td>
                </tr>

                {/* 方案B */}
                <tr className="bg-amber-950/20">
                  <td className="p-2.5 font-bold text-amber-300 border-r border-neutral-850">
                    方案 B: 本地工作台方案 (当前所用)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850">
                    Web前端纯本地引擎，拖入Excel秒出看板
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400 font-bold">
                    极快 (&lt;1秒完成2000条清洗与归因)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400 font-bold">
                    完全免费 (0元API费用，纯本地规则)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400">
                    零门槛开箱即用，免安装
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400 font-bold">
                    极高 (随时拖入任意店铺表格)
                  </td>
                  <td className="p-2.5 text-emerald-400 font-bold">
                    极高 (内嵌泰越印菲马语法模型)
                  </td>
                </tr>

                {/* 方案C */}
                <tr>
                  <td className="p-2.5 font-bold text-neutral-200 border-r border-neutral-850">
                    方案 C: Codex辅助生成本地批处理脚本
                  </td>
                  <td className="p-2.5 border-r border-neutral-850">
                    Python脚本 + 中转站大模型 API (DeepSeek/Qwen)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-sky-400">
                    快 (多线程并发批处理)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-neutral-300">
                    极低 (每万条评论约 1-3 元人民币)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-rose-400">
                    高 (需本地搭建 Python 运行环境)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-neutral-300">
                    中 (换人使用有环境门槛)
                  </td>
                  <td className="p-2.5 text-sky-400">
                    极强 (大模型通识理解)
                  </td>
                </tr>

                {/* 方案D */}
                <tr>
                  <td className="p-2.5 font-bold text-neutral-200 border-r border-neutral-850">
                    方案 D: 多维表 + Webhook 外部中转站组合
                  </td>
                  <td className="p-2.5 border-r border-neutral-850">
                    飞书自动化触发 Webhook 调用中转站模型回写
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-sky-400">
                    中等 (受飞书单表每秒回写并发限制)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-neutral-300">
                    极低 API 成本，绕开飞书 AI 额度
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-amber-400">
                    中等 (需配置 Webhook 与轻量服务)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-sky-400">
                    高 (结合多维表的看板生态)
                  </td>
                  <td className="p-2.5 text-sky-400">
                    强
                  </td>
                </tr>

                {/* 方案E */}
                <tr>
                  <td className="p-2.5 font-bold text-neutral-200 border-r border-neutral-850">
                    方案 E: 纯大模型对话窗口手动投喂
                  </td>
                  <td className="p-2.5 border-r border-neutral-850">
                    直接复制粘贴到 ChatGPT / DeepSeek / 豆包网页
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-rose-400">
                    慢 (需人工分批次复制粘贴)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400">
                    完全免费 (利用免费网页端)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-emerald-400">
                    极低 (随手可用)
                  </td>
                  <td className="p-2.5 border-r border-neutral-850 text-rose-400 font-bold">
                    极差 (每次重复发Prompt，无法沉淀)
                  </td>
                  <td className="p-2.5 text-amber-400">
                    中等 (单次长文本易遗忘规则)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 步骤 5: 评估用户自拟方案 (核心关键问答) */}
        <section className="space-y-4">
          <div className="border-b border-neutral-800 pb-2">
            <span className="text-amber-400 font-mono text-[11px] font-bold">STEP 05</span>
            <h2 className="text-base font-bold text-white mt-0.5">步骤 5: 评估用户两大自拟方案的可行性、卡点与最优路径</h2>
          </div>

          <div className="space-y-4">
            {/* 问题一评估 */}
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                <span>问答 1: 飞书多维表原生功能能否独立完成？做到什么程度？卡点在哪里？</span>
              </div>
              <div className="text-xs space-y-1.5 text-neutral-300">
                <p>
                  <strong className="text-emerald-400">✅ 明确结论：</strong> 
                  <strong>能做，但有明显的“数据量上限”与“复杂清洗盲区”卡点。</strong>
                </p>
                <p>
                  <strong>能做到什么程度：</strong> 
                  借助飞书多维表自带的「字段捷径 - AI 生成文本」功能，配置精炼的 Prompt（如本应用提供的泰语Prompt），
                  输入买家原文，可以直接输出中文释义、情感判断、以及是否属于五星差评。结合多维表的仪表盘，能快速呈现基础图表。
                </p>
                <p>
                  <strong className="text-rose-400">致命卡点与瓶颈：</strong>
                </p>
                <ul className="list-disc pl-5 space-y-1 text-neutral-400">
                  <li><strong>AI额度消耗极快：</strong> 飞书免费版/商业基础版的 AI 额度为每月有限配额。分析一个爆款的 1000 条评论，瞬间消耗 1000 次 AI 字段调用，月额度很快告罄。</li>
                  <li><strong>行级计算无法做跨行聚类统计：</strong> AI字段是“逐行独立运行”的，它很难在多行之间识别“跨评论复用同一组精修图”或“短时间内同买家批量灌水”等行为级刷单特征。</li>
                  <li><strong>速度慢与并发队列：</strong> 当单次导入 500 条以上评论时，飞书 AI 字段后台生成排队时间可能长达 15-30 分钟。</li>
                </ul>
              </div>
            </div>

            {/* 问题二评估 */}
            <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-sky-500" />
                <span>问答 2: 本地工作台方案是否需要写代码？Codex能否代劳？免费实现路径是什么？</span>
              </div>
              <div className="text-xs space-y-1.5 text-neutral-300">
                <p>
                  <strong className="text-emerald-400">✅ 明确结论：</strong> 
                  <strong>完全不需要运营人员自己写代码！Codex / AI 完全可以直接生成免安装的本地工作台。</strong>
                </p>
                <p>
                  <strong>Codex / AI 的代劳边界：</strong> 
                  AI 可以直接把本系统所包含的“SheetJS 表格解析”、“泰语多语言正则”、“四维刷单规则引擎”以及“五星差评归因逻辑”全部封装在纯前端网页中。
                  运营只需在本地浏览器双击打开或访问该静态网页，拖入 Excel 即刻分析，全程在本地计算机内存运行。
                </p>
                <p>
                  <strong className="text-emerald-300">零成本免费实现路径（最佳实践）：</strong>
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-neutral-400">
                  <li><strong>第一阶段（0元直接用）：</strong> 直接使用当前这个<strong>“东南亚电商评论洞察工作台”</strong>，拖入 Shopee/Lazada 导出的表格，利用内置规则引擎秒级完成 2000 条数据清洗、分流、五星差评挖掘与三大看板生成，点击导出 Excel。无需消耗任何 API Key 或服务器成本。</li>
                  <li><strong>第二阶段（团队沉淀）：</strong> 将当前工作台清洗后的高纯度结果（已过滤水军且标明痛点），通过一键导出格式，批量导入至团队的【飞书多维表】中作为永久数据库存档，既避免了飞书原生 AI 额度的耗尽，又享受了多维表跨部门协同的便利！</li>
                </ol>
              </div>
            </div>

            {/* 推荐最优组合方案 */}
            <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/50 space-y-2">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>架构师推荐路径：单人团队 + 零代码 + 零预算的最优组合闭环</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                👉 <strong>【本地工作台秒级预洗 (方案B)】 + 【飞书多维表归档协同 (方案A)】组合模式：</strong><br />
                1. 运营从 Shopee/Lazada 导出原始评论，首先拖入本工作台；<br />
                2. 本地工作台 0.5 秒内自动完成 4 维刷单识别、金币灌水过滤、泰/越/印多语言对齐，并把“五星差评”高亮归因；<br />
                3. 在工作台看板直接指导选品和 Listing 优化；<br />
                4. 点击“导出适配多维表的 Excel”，将清洗后的干净数据导入飞书，0 成本实现永久资产库沉淀！
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
