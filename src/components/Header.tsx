import React, { useState } from 'react';
import { 
  Download, Layers, ShieldCheck, HeartPulse, Compass, 
  LayoutDashboard, Share2, Check, Copy, ExternalLink, FileSpreadsheet,
  Settings, Sun, Moon, Shield
} from 'lucide-react';

export type MainTabType = 'executive_dashboard' | 'hidden_negative' | 'scenarios' | 'settings';

interface HeaderProps {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  onExport: () => void;
  hiddenCount: number;
  currentFileName?: string;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExport,
  hiddenCount,
  currentFileName,
  theme,
  setTheme
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareClick = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('sea_studio_theme', next);
  };

  const isLight = theme === 'light';

  return (
    <header className={`sticky top-0 z-40 w-full border-b transition-colors ${
      isLight 
        ? 'border-[#91AECF]/30 bg-white/95 text-[#090911] backdrop-blur-md shadow-[0_2px_8px_rgba(27,88,161,0.04)]' 
        : 'border-neutral-800 bg-[#090911]/90 text-white backdrop-blur-md'
    }`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <a 
          href="#dashboard" 
          onClick={(e) => { e.preventDefault(); setActiveTab('executive_dashboard'); }}
          className={`flex items-center gap-2.5 text-base font-semibold tracking-tight transition-colors whitespace-nowrap ${
            isLight ? 'text-[#090911] hover:text-[#1B58A1]' : 'text-white hover:text-sky-400'
          }`}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B58A1] text-white shadow-xs">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="font-bold">东南亚电商评论全景看板</span>
        </a>

        {/* 当前表格指示徽章 */}
        {currentFileName && (
          <div className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono ${
            isLight 
              ? 'bg-[#D8E4F0]/50 border-[#91AECF]/40 text-[#090911]' 
              : 'bg-neutral-900 border-neutral-800 text-neutral-300'
          }`}>
            <FileSpreadsheet className="h-3 w-3 text-[#1B58A1] shrink-0" />
            <span className="opacity-60">数据源:</span>
            <span className="font-semibold max-w-[180px] truncate">{currentFileName}</span>
          </div>
        )}

        {/* Zone 2: 纯粹专注于业务运营的核心导航 (强化为显眼的分段控制胶囊栏) */}
        <nav className={`hidden md:flex items-center p-1 rounded-xl border text-xs font-medium transition-all ${
          isLight ? 'bg-[#F0F6FC] border-[#BCD7F5]/80 shadow-[0_1px_3px_rgba(27,88,161,0.06)]' : 'bg-neutral-900 border-neutral-800'
        }`}>
          {/* 1. 综合分析看板 (全景大盘) */}
          <button
            onClick={() => setActiveTab('executive_dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'executive_dashboard' 
                ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                : (isLight ? 'text-[#090911] hover:text-[#1B58A1] hover:bg-white/80' : 'text-neutral-300 hover:text-white hover:bg-neutral-800')
            }`}
            title="查看评论全景穿透看板与大盘趋势"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>综合分析看板</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'executive_dashboard' ? 'bg-white/20 text-white' : (isLight ? 'bg-[#D8E4F0] text-[#1B58A1]' : 'bg-neutral-800 text-neutral-400')
            }`}>大盘</span>
          </button>

          {/* 2. 五星隐性差评 (东南亚独有痛点挖掘) */}
          <button
            onClick={() => setActiveTab('hidden_negative')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'hidden_negative' 
                ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                : (isLight ? 'text-[#090911] hover:text-[#E05D52] hover:bg-white/80' : 'text-neutral-300 hover:text-rose-400 hover:bg-neutral-800')
            }`}
            title="透视高星人情分下的隐形痛点"
          >
            <HeartPulse className={`h-3.5 w-3.5 ${activeTab === 'hidden_negative' ? 'text-white' : 'text-[#E05D52]'}`} />
            <span>五星隐性差评</span>
            {hiddenCount > 0 ? (
              <span className={`font-mono text-[10px] font-bold tabular-nums px-1.5 py-0.2 rounded-full ${
                activeTab === 'hidden_negative' ? 'bg-[#E05D52] text-white shadow-xs' : 'bg-[#FEE2E2] text-[#C53030]'
              }`}>
                {hiddenCount}
              </span>
            ) : (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'hidden_negative' ? 'bg-white/20 text-white' : (isLight ? 'bg-[#FEE2E2] text-[#C53030]' : 'bg-neutral-800 text-rose-400')
              }`}>排查</span>
            )}
          </button>

          {/* 3. 三大决策看板 (选品/Listing/竞品) */}
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'scenarios' 
                ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                : (isLight ? 'text-[#090911] hover:text-[#1B58A1] hover:bg-white/80' : 'text-neutral-300 hover:text-white hover:bg-neutral-800')
            }`}
            title="运营、开发、选品业务决策视角"
          >
            <Compass className="h-3.5 w-3.5" />
            <span>三大决策看板</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'scenarios' ? 'bg-white/20 text-white' : (isLight ? 'bg-[#D8E4F0] text-[#1B58A1]' : 'bg-neutral-800 text-neutral-400')
            }`}>决策</span>
          </button>

          {/* 4. 导航栏板块：技术栈解释 · 本地运行与分享 · 设置 · 后台权限管理 */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-[#1B58A1] text-white font-bold shadow-xs'
                : (isLight ? 'text-[#090911] hover:text-[#1B58A1] hover:bg-white/80' : 'text-neutral-300 hover:text-white hover:bg-neutral-800')
            }`}
            title="技术栈说明、团队权限管理与运行配置"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>系统设置与部署指南</span>
          </button>
        </nav>

        {/* Zone 3: 顶层操作按钮区 (含一键深浅色切换、分享与导出) */}
        <div className="flex items-center gap-2">
          {/* 快捷主题黑白底切换按钮 */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
              isLight 
                ? 'bg-white text-[#090911] border-[#91AECF]/40 hover:bg-[#D8E4F0]/50' 
                : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
            }`}
            title={`切换为${isLight ? '深色黑底模式' : '商务明亮蓝白模式'}`}
          >
            {isLight ? <Moon className="h-4 w-4 text-[#1B58A1]" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          {/* 分享链接按钮 */}
          <button
            onClick={handleShareClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap border cursor-pointer ${
              isLight 
                ? 'bg-white text-[#1B58A1] border-[#91AECF]/40 hover:bg-[#BCD7F5]/20' 
                : 'text-sky-400 bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/60'
            }`}
            title="一键复制工作台公网分享链接"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? '链接已复制' : '分享'}</span>
          </button>

          {/* 导出诊断结果 */}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#1B58A1] hover:bg-[#154680] rounded-lg transition-colors whitespace-nowrap shadow-xs cursor-pointer font-semibold"
            title="导出全量诊断分析 Excel"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">导出诊断 Excel</span>
          </button>
        </div>
      </div>
    </header>
  );
};
