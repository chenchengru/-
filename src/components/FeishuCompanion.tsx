import React, { useState } from 'react';
import { 
  Cpu, Copy, Check, Table, Sparkles, ExternalLink, 
  HelpCircle, ArrowRight, Layers, FileCode
} from 'lucide-react';

export const FeishuCompanion: React.FC = () => {
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const FEISHU_PROMPT_ALL_IN_ONE = `你是一位精通东南亚跨境电商（Shopee/Lazada）多语言评论诊断与刷单识别的资深运营专家。
请对输入的买家评论原文进行深度结构化解构，严格按照以下 JSON 格式输出，不要包含任何额外的客套话或 Markdown 标记。

输入字段：
- 评价原文：[评论原文]
- 表面评分：[买家星级]
- 涉及SKU：[SKU规格]

分析要求：
1. 识别评论语言（泰语/越南语/印尼语/菲律宾语/中文/英文/混合语）。
2. 将原文准确翻译为中文，特别注意泰语常见口语：如“ตรงปก”翻译为“实物与图片相符”、“ส่งช้า”翻译为“发货极慢”、“55555”解释为“哈哈哈哈哈”。
3. 识别是否为【五星差评】或【四星差评】：若买家打分在4-5星，但正文中包含任何不满（如破损、尺码偏小、色差、发错货、少配件、不耐用），必须将其判定为 is_hidden_negative = true，并抽取具体痛点。
4. 识别是否为【无效/刷单/灌水】：若为纯表情、纯字符循环(aaaaa)、平台默认模板、或全5星长文溢美图文并茂刷单特征，判定为 is_invalid = true 并说明原因。
5. 归属核心主题（质量做工、尺码版型、物流时效、包装防护、客服沟通、性价比）。

输出 JSON 格式模板：
{
  "language": "泰语",
  "translation_zh": "中文通顺释义",
  "is_hidden_negative": true,
  "hidden_grievances": ["外箱压烂", "尺码偏小"],
  "is_invalid": false,
  "invalid_reason": "",
  "primary_topic": "尺码版型",
  "seller_action": "建议在Listing第2张主图注明尺码偏小1码，提醒拍大"
}`;

  const FEISHU_PROMPT_HIDDEN_NEGATIVE = `请严格审查以下东南亚电商评论：
【评论原文】: [评论原文]
【买家星级】: [买家星级]

请重点回答：该评论是否存在“明褒暗贬”或“五星差评/四星差评”现象？
在东南亚文化中，买家习惯给5星或4星以示礼貌（例如“给5星鼓励”、“5星给快递员”），但文字里写出了商品缺陷。
若存在，请输出：
【隐性不满痛点】: (1-2句话精炼总结，如：外箱被压扁，内部碎了1个)
【运营改进建议】: (如：加厚气泡柱包装)
若完全无不满且为真正好评，仅输出：【真实好评】`;

  return (
    <div className="space-y-6">
      {/* 顶部介绍 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-lg bg-neutral-900 border border-neutral-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-sky-400" />
              飞书生态深度协同工具箱
            </span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="text-xs text-neutral-400">一键配置多维表字段与AI Prompt</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            飞书多维表 (Bitable) 字段字典与 AI 提示词配置器
          </h1>
          <p className="text-xs text-neutral-400 max-w-3xl">
            提供经过东南亚五国语料验证的工业级【飞书 AI 字段提示词】，支持直接复制至飞书多维表。
            配合标准表头结构，可快速在飞书中复刻评论诊断流水线。
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleCopyPrompt(FEISHU_PROMPT_ALL_IN_ONE, 'all-in-one')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors whitespace-nowrap"
          >
            {copiedPromptId === 'all-in-one' ? <Check className="h-3.5 w-3.5 text-white" /> : <Copy className="h-3.5 w-3.5" />}
            <span>复制飞书多维表通用 AI Prompt</span>
          </button>
        </div>
      </div>

      {/* 提示词复制专区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 提示词 1: 全功能 JSON 结构化抽取 Prompt */}
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-sky-400" />
                <span>Prompt A: 飞书多维表「全功能诊断」提示词</span>
              </div>
              <div className="text-[11px] text-neutral-400">适合生成纯净结构化数据，供多维表公式字段二次提取</div>
            </div>
            <button
              onClick={() => handleCopyPrompt(FEISHU_PROMPT_ALL_IN_ONE, 'all-in-one')}
              className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
            >
              {copiedPromptId === 'all-in-one' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>复制</span>
            </button>
          </div>

          <pre className="p-3 rounded bg-neutral-950 border border-neutral-850 text-[11px] font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {FEISHU_PROMPT_ALL_IN_ONE}
          </pre>
        </div>

        {/* 提示词 2: 五星差评专门狙击 Prompt */}
        <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileCode className="h-4 w-4 text-rose-400" />
                <span>Prompt B: 「五星差评/隐性不满」专项识别提示词</span>
              </div>
              <div className="text-[11px] text-neutral-400">专门用于揪出人情给5星但在正文痛骂的隐性差评</div>
            </div>
            <button
              onClick={() => handleCopyPrompt(FEISHU_PROMPT_HIDDEN_NEGATIVE, 'hidden-negative')}
              className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
            >
              {copiedPromptId === 'hidden-negative' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>复制</span>
            </button>
          </div>

          <pre className="p-3 rounded bg-neutral-950 border border-neutral-850 text-[11px] font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
            {FEISHU_PROMPT_HIDDEN_NEGATIVE}
          </pre>
        </div>
      </div>

      {/* 标准飞书多维表字段架构配置规范表 */}
      <div className="p-5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Table className="h-4 w-4 text-sky-400" />
              <span>标准飞书多维表 (Bitable) 字段字典推荐结构</span>
            </h2>
            <p className="text-xs text-neutral-400">
              在飞书多维表中新建数据表时，建议依次创建以下字段以实现全流程无缝流转：
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border border-neutral-800 text-xs">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                <th className="p-2.5 border-r border-neutral-850">序号</th>
                <th className="p-2.5 border-r border-neutral-850">飞书字段名称</th>
                <th className="p-2.5 border-r border-neutral-850">字段类型</th>
                <th className="p-2.5 border-r border-neutral-850">字段取值或公式/Prompt来源</th>
                <th className="p-2.5">业务用途与说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850">
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">1</td>
                <td className="p-2.5 font-semibold text-neutral-200 border-r border-neutral-850">评价ID</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">单行文本</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">Order ID 或自动生成</td>
                <td className="p-2.5 text-neutral-400">唯一主键，用于追溯Shopee/Lazada订单</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">2</td>
                <td className="p-2.5 font-semibold text-neutral-200 border-r border-neutral-850">买家星级</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">数字 / 评分</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">1 ~ 5</td>
                <td className="p-2.5 text-neutral-400">买家在平台打出的表面星级</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">3</td>
                <td className="p-2.5 font-semibold text-neutral-200 border-r border-neutral-850">评论原文</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">多行文本</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">泰文/英文/越文原始文本</td>
                <td className="p-2.5 text-neutral-400">作为飞书 AI 字段的主要输入参数</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">4</td>
                <td className="p-2.5 font-semibold text-sky-300 border-r border-neutral-850">AI中文释义与诊断</td>
                <td className="p-2.5 text-sky-400 border-r border-neutral-850">AI 字段 (生成文本)</td>
                <td className="p-2.5 border-r border-neutral-850 text-neutral-300">引用 Prompt A，入参绑定 [评论原文]</td>
                <td className="p-2.5 text-neutral-400">自动完成本土俚语翻译与痛点提取</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">5</td>
                <td className="p-2.5 font-semibold text-rose-300 border-r border-neutral-850">是否五星差评</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">单选 / 复选框</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">是 / 否</td>
                <td className="p-2.5 text-neutral-400">用于配置飞书视图过滤，一键筛选出高星隐性差评列表</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">6</td>
                <td className="p-2.5 font-semibold text-neutral-200 border-r border-neutral-850">涉及SKU/款式</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">单选 / 单行文本</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">例如：法式白 / L码</td>
                <td className="p-2.5 text-neutral-400">多维表看板按规格聚合分析退换痛点</td>
              </tr>
              <tr>
                <td className="p-2.5 font-mono text-neutral-400 border-r border-neutral-850">7</td>
                <td className="p-2.5 font-semibold text-emerald-300 border-r border-neutral-850">运营跟进状态</td>
                <td className="p-2.5 text-neutral-300 border-r border-neutral-850">单选</td>
                <td className="p-2.5 border-r border-neutral-850 font-mono text-neutral-400">待跟进 / 已联系买家 / Listing已修正 / 供应链已改版</td>
                <td className="p-2.5 text-neutral-400">形成团队协作闭环，记录行动进展</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
