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
        ? 'border-slate-200 bg-white/95 text-slate-800 backdrop-blur-md shadow-xs' 
        : 'border-neutral-800 bg-neutral-950/90 text-white backdrop-blur-md'
    }`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <a 
          href="#dashboard" 
          onClick={(e) => { e.preventDefault(); setActiveTab('executive_dashboard'); }}
          className={`flex items-center gap-2 text-base font-semibold tracking-tight transition-colors whitespace-nowrap ${
            isLight ? 'text-slate-900 hover:text-amber-600' : 'text-white hover:text-amber-400'
          }`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span>东南亚电商评论全景看板</span>
        </a>

        {/* 当前表格指示徽章 */}
        {currentFileName && (
          <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
            isLight 
              ? 'bg-slate-100 border-slate-200 text-slate-700' 
              : 'bg-neutral-900 border-neutral-800 text-neutral-300'
          }`}>
            <FileSpreadsheet className="h-3 w-3 text-amber-500 shrink-0" />
            <span className="opacity-50">数据源:</span>
            <span className="font-semibold max-w-[180px] truncate">{currentFileName}</span>
          </div>
        )}

        {/* Zone 2: 纯粹专注于业务运营的核心导航 */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
          {/* 1. 综合分析看板 (内置导入清洗与历史穿透) */}
          <button
            onClick={() => setActiveTab('executive_dashboard')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'executive_dashboard' 
                ? (isLight ? 'bg-slate-200 text-amber-600 font-bold shadow-xs' : 'bg-neutral-800 text-amber-400 font-semibold shadow-inner')
                : (isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900')
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>综合分析看板</span>
          </button>

          {/* 2. 五星隐性差评 (东南亚独有痛点挖掘) */}
          <button
            onClick={() => setActiveTab('hidden_negative')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'hidden_negative' 
                ? (isLight ? 'bg-slate-200 text-rose-600 font-bold shadow-xs' : 'bg-neutral-800 text-rose-400 font-semibold shadow-inner')
                : (isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900')
            }`}
          >
            <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
            <span>五星隐性差评</span>
            {hiddenCount > 0 && (
              <span className="font-mono text-[10px] text-rose-500 font-bold tabular-nums">
                ({hiddenCount})
              </span>
            )}
          </button>

          {/* 3. 三大决策看板 (选品/Listing/竞品) */}
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'scenarios' 
                ? (isLight ? 'bg-slate-200 text-sky-600 font-bold shadow-xs' : 'bg-neutral-800 text-sky-400 font-semibold shadow-inner')
                : (isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900')
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-sky-500" />
            <span>三大决策看板</span>
          </button>

          {/* 4. 导航栏板块：技术栈解释 · 本地运行与分享 · 设置 · 后台权限管理 */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings' 
                ? (isLight ? 'bg-slate-200 text-amber-600 font-bold shadow-xs' : 'bg-neutral-800 text-amber-400 font-semibold shadow-inner')
                : (isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900')
            }`}
          >
            <Settings className="h-3.5 w-3.5 text-amber-500" />
            <span>系统设置与部署指南</span>
          </button>
        </nav>

        {/* Zone 3: 顶层操作按钮区 (含一键深浅色切换、分享与导出) */}
        <div className="flex items-center gap-2">
          {/* 快捷主题黑白底切换按钮 */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded transition-colors border cursor-pointer ${
              isLight 
                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' 
                : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
            }`}
            title={`切换为${isLight ? '深色黑底模式' : '商务明亮白底模式'}`}
          >
            {isLight ? <Moon className="h-4 w-4 text-slate-700" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          {/* 分享链接按钮 */}
          <button
            onClick={handleShareClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap border cursor-pointer ${
              isLight 
                ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' 
                : 'text-sky-400 bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/60'
            }`}
            title="一键复制工作台公网分享链接"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? '链接已复制' : '分享'}</span>
          </button>

          {/* 导出诊断结果 */}
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded transition-colors whitespace-nowrap shadow-sm cursor-pointer"
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
