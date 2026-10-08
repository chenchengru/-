import React, { useState } from 'react';
import { 
  Settings, Shield, Code, Palette, Check, Sun, Moon, 
  Layers, Lock, UserCheck, Eye, Download, FileSpreadsheet,
  Cpu, Database, Sparkles, Terminal, Info, Server, RefreshCw
} from 'lucide-react';

interface SettingsManagementProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  tableDensity?: 'compact' | 'comfortable';
  setTableDensity?: (d: 'compact' | 'comfortable') => void;
}

export const SettingsManagement: React.FC<SettingsManagementProps> = ({
  theme,
  setTheme,
  tableDensity = 'comfortable',
  setTableDensity
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'theme' | 'tech_stack' | 'rbac'>('theme');
  const [currentRole, setCurrentRole] = useState<'admin' | 'specialist' | 'qc' | 'viewer'>('admin');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('sea_studio_theme', newTheme);
    setSaveToast(`工作台外观风格已切换为【${newTheme === 'dark' ? '深色黑底沉浸模式' : '商务明亮白底模式'}】！`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题与子导航 */}
      <div className={`p-5 rounded-xl border transition-all ${
        theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className={`text-base font-bold flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-[#090911]'
            }`}>
              <Settings className="h-5 w-5 text-[#1B58A1]" />
              <span>系统设置与技术权限中心 (System Settings & Tech Center)</span>
            </h1>
            <p className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>
              全栈架构解析、工作台外观风格切换与企业级多角色权限管理
            </p>
          </div>

          <div className={`flex items-center gap-1.5 p-1 rounded-lg border text-xs flex-wrap ${
            theme === 'dark' ? 'bg-neutral-950/40 border-neutral-800' : 'bg-[#F0F6FC] border-[#91AECF]/40'
          }`}>
            <button
              onClick={() => setActiveSubTab('theme')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'theme'
                  ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-[#5A6E85] hover:text-[#090911]')
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>工作台设置</span>
            </button>

            <button
              onClick={() => setActiveSubTab('tech_stack')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'tech_stack'
                  ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-[#5A6E85] hover:text-[#090911]')
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>技术栈架构解释</span>
            </button>

            <button
              onClick={() => setActiveSubTab('rbac')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'rbac'
                  ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-[#5A6E85] hover:text-[#090911]')
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>后台权限管理</span>
            </button>
          </div>
        </div>

        {saveToast && (
          <div className="mt-3 p-2.5 rounded bg-[#F0F6FC] border border-[#BCD7F5] text-xs text-[#1B58A1] flex items-center gap-2">
            <Check className="h-4 w-4 text-[#1B58A1] shrink-0" />
            <span>{saveToast}</span>
          </div>
        )}
      </div>

      {/* 模块1：外观风格与工作台设置 */}
      {activeSubTab === 'theme' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 主题色系切换 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-[#91AECF]/30">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-[#090911]'
              }`}>
                <Palette className="h-4 w-4 text-[#1B58A1]" />
                <span>工作台整体色彩风格 (Theme Mode)</span>
              </h2>
              <span className="text-[11px] font-mono text-[#1B58A1] font-semibold">
                当前：{theme === 'dark' ? '黑底暗黑模式' : '蓝色系简约商务模式'}
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>
              遵循现代 SaaS 后台管理规范，以深蓝 #1B58A1、灰蓝 #91AECF 与浅蓝 #BCD7F5 为统一基准色，高对比度护眼商务呈现。
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* 黑底模式卡片 */}
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-neutral-950 border-[#1B58A1] ring-2 ring-[#1B58A1]/30 shadow-lg'
                    : 'bg-neutral-900 border-neutral-800 opacity-70 hover:opacity-100'
                }`}
              >
                {theme === 'dark' && (
                  <span className="absolute top-2.5 right-2.5 p-1 rounded-full bg-[#1B58A1] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="h-4 w-4 text-[#91AECF]" />
                  <span className="text-xs font-bold text-white">深色黑底沉浸风</span>
                </div>
                <div className="h-12 rounded bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-between text-[10px] text-neutral-400">
                  <div className="space-y-1">
                    <div className="h-1.5 w-12 bg-[#1B58A1] rounded" />
                    <div className="h-1.5 w-16 bg-neutral-700 rounded" />
                  </div>
                  <div className="h-6 w-6 rounded-full border border-[#1B58A1]/40 bg-neutral-800" />
                </div>
                <span className="block mt-2 text-[10px] text-neutral-400">长时间盯屏、护眼夜间模式</span>
              </button>

              {/* 白底模式卡片 */}
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer ${
                  theme === 'light'
                    ? 'bg-[#F0F6FC] border-[#1B58A1] ring-2 ring-[#BCD7F5] shadow-sm'
                    : 'bg-white border-[#91AECF]/40 opacity-70 hover:opacity-100'
                }`}
              >
                {theme === 'light' && (
                  <span className="absolute top-2.5 right-2.5 p-1 rounded-full bg-[#1B58A1] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4 text-[#1B58A1]" />
                  <span className="text-xs font-bold text-[#090911]">现代SaaS商务蓝白风</span>
                </div>
                <div className="h-12 rounded bg-white border border-[#91AECF]/40 p-2 flex items-center justify-between text-[10px] text-[#5A6E85]">
                  <div className="space-y-1">
                    <div className="h-1.5 w-12 bg-[#1B58A1] rounded" />
                    <div className="h-1.5 w-16 bg-[#BCD7F5] rounded" />
                  </div>
                  <div className="h-6 w-6 rounded-full border border-[#1B58A1]/40 bg-[#F0F6FC]" />
                </div>
                <span className="block mt-2 text-[10px] text-[#5A6E85]">标准配色：#1B58A1 主色 · 清爽商务</span>
              </button>
            </div>
          </div>

          {/* 翻译与性能配置 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${theme === 'dark' ? 'border-neutral-800' : 'border-[#91AECF]/30'}`}>
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-[#090911]'
              }`}>
                <RefreshCw className="h-4 w-4 text-[#1B58A1]" />
                <span>翻译引擎与本地缓存配置</span>
              </h2>
              <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                theme === 'dark' 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                  : 'text-[#1B58A1] bg-[#F0F6FC] border-[#BCD7F5]'
              }`}>
                双通道加速已激活
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-lg border ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]'
              }`}>
                <div className={`font-semibold mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-sky-400' : 'text-[#1B58A1]'}`}>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Google 神经机器翻译引擎通道</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'opacity-80' : 'text-[#5A6E85]'}`}>
                  内置 <code>/api/translate</code> 智能代理，采用 Google Translate 原文整段直译，支持长文本逐句忠实转译并自动本地写入双级缓存。
                </p>
              </div>

              <div className={`p-3 rounded-lg border ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]'
              }`}>
                <div className={`font-semibold mb-1 flex items-center gap-1 ${theme === 'dark' ? 'text-amber-400' : 'text-[#1B58A1]'}`}>
                  <Database className="h-3.5 w-3.5" />
                  <span>本地离线垂直词典保障</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'opacity-80' : 'text-[#5A6E85]'}`}>
                  搭载五金电锯、3C数码、日用百货等行业词根库（如 BMS保护板、链条防脱、门体材质等），在断网环境下亦能提供精准释义。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 模块2：技术栈架构解释 */}
      {activeSubTab === 'tech_stack' && (
        <div className={`p-6 rounded-xl border space-y-6 ${
          theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]'
        }`}>
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-[#090911]'
            }`}>
              <Code className="h-4 w-4 text-[#1B58A1]" />
              <span>东南亚评论洞察工作台 · 全栈技术栈与设计哲学解释</span>
            </h2>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>
              专为跨境电商“零预算、高时效、强隐私”诉求打造的轻量级纯客户端数据诊断方案
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* 核心1：前端渲染与状态机 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]'
            }`}>
              <div className={`flex items-center gap-2 font-bold ${theme === 'dark' ? 'text-amber-400' : 'text-[#1B58A1]'}`}>
                <Terminal className="h-4 w-4" />
                <span>1. 前端高性能渲染栈</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'
              }`}>
                <li>• <strong>React 19 + TypeScript：</strong>利用强类型约束确保原始导表解析与数据大盘零运行时崩溃。</li>
                <li>• <strong>Tailwind CSS 4.0：</strong>极简原子化样式，毫秒级主题切换响应。</li>
                <li>• <strong>Vite 8.0：</strong>亚秒级冷启动与轻量打包。</li>
              </ul>
            </div>

            {/* 核心2：多语言与翻译引擎 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]'
            }`}>
              <div className={`flex items-center gap-2 font-bold ${theme === 'dark' ? 'text-sky-400' : 'text-[#1B58A1]'}`}>
                <Server className="h-4 w-4" />
                <span>2. 语义直译与双模驱动</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'
              }`}>
                <li>• <strong>Google Translate 代理：</strong>通过内置 <code>/api/translate</code> 服务端中间件，保障长评论完全按谷歌翻译模型高保真逐句直译。</li>
                <li>• <strong>自适应分词词根：</strong>深度融合泰语（TH）、越南语（VN）、印尼语（ID）电商口语俗语库。</li>
              </ul>
            </div>

            {/* 核心3：零数据泄露隐私安全 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-[#F8FAFC] border-[#91AECF]/30 text-[#090911]'
            }`}>
              <div className={`flex items-center gap-2 font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>
                <Shield className="h-4 w-4" />
                <span>3. 本地离线隐私沙箱</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'
              }`}>
                <li>• <strong>数据不上传三方：</strong>导入的 Excel 原始销售与评论文件仅在浏览器内存及本地 localStorage 中解析计算。</li>
                <li>• <strong>商业机密绝对隔离：</strong>避免将核心出单 SKU、客单价或竞品评论泄露给外部公网。</li>
              </ul>
            </div>
          </div>

          {/* 算法逻辑流程图解 */}
          <div className={`p-4 rounded-xl border space-y-2 text-xs ${
            theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-[#F8FAFC] border-[#91AECF]/30'
          }`}>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-neutral-200' : 'text-[#090911]'}`}>
              全流程算法数据流转逻辑 (Pipeline)
            </h3>
            <div className={`p-3 rounded font-mono text-[11px] border overflow-x-auto ${
              theme === 'dark' ? 'bg-neutral-900 text-neutral-300 border-neutral-800' : 'bg-[#F0F6FC] text-[#090911] border-[#BCD7F5]'
            }`}>
              [原始导表 Excel/CSV] 
              ➔ [通用表头多语言自动映射器 (fileParser)] 
              ➔ [水军与凑字刷单过滤 (reviewCleaner)] 
              ➔ [五星差评与转折语义挖掘 (sentimentAndHiddenReview)] 
              ➔ [Google Translate 完整转译 (translator)] 
              ➔ [三大决策场景聚合输出 (scenarioAnalyzer)]
            </div>
          </div>
        </div>
      )}

      {/* 模块3：后台权限管理 (RBAC) */}
      {activeSubTab === 'rbac' && (
        <div className={`p-6 rounded-xl border space-y-6 ${
          theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-[#91AECF]/30 shadow-[0_2px_8px_rgba(27,88,161,0.04)]'
        }`}>
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
            theme === 'dark' ? 'border-neutral-800' : 'border-[#91AECF]/30'
          }`}>
            <div>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-[#090911]'
              }`}>
                <Shield className="h-4 w-4 text-[#1B58A1]" />
                <span>企业级角色权限管理矩阵 (RBAC Permission Center)</span>
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>
                支持多岗位协同，依据岗位职能划分数据查看、脱敏、分析与导出权限
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>切换模拟角色体验:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className={`text-xs rounded px-2.5 py-1 font-mono font-medium border focus:outline-none cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-neutral-950 text-amber-400 border-neutral-700' 
                    : 'bg-[#F8FAFC] text-[#1B58A1] border-[#BCD7F5] shadow-xs'
                }`}
              >
                <option value="admin">超级管理员 (Admin)</option>
                <option value="specialist">品类运营专家 (Specialist)</option>
                <option value="qc">供应链与质检专家 (QC)</option>
                <option value="viewer">数据查看者 (Viewer)</option>
              </select>
            </div>
          </div>

          {/* 角色说明卡片 */}
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
            theme === 'dark'
              ? (currentRole === 'admin' 
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' 
                  : (currentRole === 'specialist' ? 'bg-sky-950/20 border-sky-500/40 text-sky-300' : 'bg-neutral-950 border-neutral-800 text-neutral-300'))
              : 'bg-[#F0F6FC] border-[#BCD7F5] text-[#090911]'
          }`}>
            <div className="flex items-center gap-2.5">
              <UserCheck className={`h-5 w-5 shrink-0 ${theme === 'dark' ? '' : 'text-[#1B58A1]'}`} />
              <div>
                <span className={`font-bold ${theme === 'dark' ? '' : 'text-[#1B58A1]'}`}>
                  当前处于【{
                    currentRole === 'admin' ? '超级管理员' : (currentRole === 'specialist' ? '品类运营专家' : (currentRole === 'qc' ? '供应链质检专家' : '访客查看者'))
                  }】视图
                </span>
                <p className={`text-[11px] mt-0.5 ${theme === 'dark' ? 'opacity-80' : 'text-[#5A6E85]'}`}>
                  {currentRole === 'admin' && '拥有全量权限：原始评论查看、敏感买家昵称脱敏解封、指标钻取、一键全量 Excel 导出、清洗规则参数定制。'}
                  {currentRole === 'specialist' && '重点赋能选品与 Listing 优化：可查看词频标签、买家本土原声与差异化卖点，买家个人信息自动脱敏。'}
                  {currentRole === 'qc' && '重点赋能品质监控：聚焦于五星隐性差评、退货痛点、电芯与塑料结构件缺陷分析。'}
                  {currentRole === 'viewer' && '只读受限视图：仅可浏览综合大盘统计与聚合图表，无法导出明细或修改任何数据源。'}
                </p>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border uppercase font-semibold shrink-0 ${
              theme === 'dark' 
                ? 'border-neutral-700' 
                : 'bg-[#1B58A1] text-white border-[#1B58A1]'
            }`}>
              {currentRole}
            </span>
          </div>

          {/* 权限矩阵表 */}
          <div className={`border rounded-lg overflow-hidden text-xs ${
            theme === 'dark' ? 'border-neutral-800' : 'border-[#91AECF]/30'
          }`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`font-medium border-b ${
                  theme === 'dark' ? 'bg-neutral-950 text-neutral-400 border-neutral-800' : 'bg-[#91AECF]/15 text-[#090911] border-[#91AECF]/30'
                }`}>
                  <th className="py-2.5 px-3">业务模块 / 功能权限项</th>
                  <th className="py-2.5 px-3 text-center">超级管理员</th>
                  <th className="py-2.5 px-3 text-center">品类运营专家</th>
                  <th className="py-2.5 px-3 text-center">供应链与质检</th>
                  <th className="py-2.5 px-3 text-center">访客只读</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-neutral-850' : 'divide-[#91AECF]/20'}`}>
                <tr className={theme === 'dark' ? '' : 'hover:bg-[#D8E4F0]/20'}>
                  <td className="py-2.5 px-3 font-medium">原始数据导入与多维清洗配置</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 全部权限</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 支持导入</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-[#5A6E85]/50'}`}>-</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-[#5A6E85]/50'}`}>-</td>
                </tr>
                <tr className={theme === 'dark' ? '' : 'hover:bg-[#D8E4F0]/20'}>
                  <td className="py-2.5 px-3 font-medium">买家原始评价完整穿透与原文字段</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 完整穿透</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 脱敏穿透</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 痛点穿透</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-[#5A6E85]'}`}>仅统计聚合</td>
                </tr>
                <tr className={theme === 'dark' ? '' : 'hover:bg-[#D8E4F0]/20'}>
                  <td className="py-2.5 px-3 font-medium">五星/四星隐性差评深度挖掘专区</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 深度归因</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 卖点反打</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 批次召回</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-500' : 'text-[#5A6E85]'}`}>只读数量</td>
                </tr>
                <tr className={theme === 'dark' ? '' : 'hover:bg-[#D8E4F0]/20'}>
                  <td className="py-2.5 px-3 font-medium">选品 · Listing · 竞品决策三大看板</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 完整决策</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 核心应用</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>弱相关</td>
                  <td className={`py-2.5 px-3 text-center ${theme === 'dark' ? 'text-neutral-400' : 'text-[#5A6E85]'}`}>受限预览</td>
                </tr>
                <tr className={theme === 'dark' ? '' : 'hover:bg-[#D8E4F0]/20'}>
                  <td className="py-2.5 px-3 font-medium">诊断分析成果 Excel 全量导出</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 允许导出</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 允许导出</td>
                  <td className={`py-2.5 px-3 text-center font-bold ${theme === 'dark' ? 'text-emerald-400' : 'text-[#1B58A1]'}`}>✓ 允许导出</td>
                  <td className="py-2.5 px-3 text-center text-[#E05D52] font-bold">✕ 禁止导出</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
