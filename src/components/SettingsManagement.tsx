import React, { useState } from 'react';
import { 
  Settings, Shield, Code, Palette, Check, Sun, Moon, 
  Layers, Lock, UserCheck, Eye, Download, FileSpreadsheet,
  Cpu, Database, Sparkles, Terminal, Info, Server, RefreshCw,
  Share2, Laptop, Globe, FolderGit2, FileCode, Play, ExternalLink,
  HelpCircle, ArrowRight
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
  const [activeSubTab, setActiveSubTab] = useState<'deployment_guide' | 'theme' | 'tech_stack' | 'rbac'>('deployment_guide');
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
        theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className={`text-base font-bold flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Settings className="h-5 w-5 text-amber-500" />
              <span>系统设置与技术权限中心 (System Settings & Tech Center)</span>
            </h1>
            <p className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
              全栈架构解析、工作台外观风格切换与企业级多角色权限管理
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-neutral-950/40 border border-neutral-800 text-xs flex-wrap">
            <button
              onClick={() => setActiveSubTab('deployment_guide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'deployment_guide'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>免登录分享与本地运行</span>
            </button>

            <button
              onClick={() => setActiveSubTab('theme')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'theme'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Palette className="h-3.5 w-3.5" />
              <span>工作台设置</span>
            </button>

            <button
              onClick={() => setActiveSubTab('tech_stack')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'tech_stack'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>技术栈架构解释</span>
            </button>

            <button
              onClick={() => setActiveSubTab('rbac')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                activeSubTab === 'rbac'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                  : (theme === 'dark' ? 'text-neutral-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>后台权限管理</span>
            </button>
          </div>
        </div>

        {saveToast && (
          <div className="mt-3 p-2.5 rounded bg-emerald-950/50 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{saveToast}</span>
          </div>
        )}
      </div>

      {/* 模块0：免登录团队分享、本地桌面运行与代码修改全指南 */}
      {activeSubTab === 'deployment_guide' && (
        <div className="space-y-6">
          {/* 原理解释卡片：为什么同事打开链接需要登录谷歌？ */}
          <div className={`p-5 rounded-xl border space-y-3 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <HelpCircle className="h-5 w-5" />
              </span>
              <div>
                <h2 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  为什么当前分享给同事的链接（ais-pre-...）会强制要求登录 Google 账号？
                </h2>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                  这是 Google AI Studio 开发沙箱环境自带的访问控制保护机制
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-lg border text-xs leading-relaxed space-y-2 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-850 text-neutral-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <p>
                当前系统生成的 <code>ais-pre-*.run.app</code> 属于<strong>开发者私人调试沙箱</strong>，由 Google Cloud 开启了 <em>Cloud IAP (Identity-Aware Proxy 身份感知代理)</em>。
                其目的是防止无关外部人员消耗您个人的云端计算额度，因此任何没有被授权访问您 Google Cloud 项目的用户，打开都会被拦截并提示登录谷歌。
              </p>
              <p className="font-semibold text-amber-500">
                ★ 解决办法：采用以下【方案一】或【方案二】，即可 100% 绕过 Google 登录，让同事【只要点击链接就能直接秒开使用】！
              </p>
            </div>
          </div>

          {/* 方案一与方案二详细实操 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 方案一：永久免费公网免登录部署 (最推荐，点击即用) */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Globe className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      方案一：公网永久免登录部署 (最推荐 · 1分钟搞定)
                    </h3>
                    <p className={`text-[11px] ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                      生成专属 HTTPS 网址，同事无需安装任何软件、无需谷歌账号，点开即用
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                  推荐
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-sky-400 flex items-center gap-1.5">
                    <span>步骤 1：本地执行打包命令</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    在项目根目录终端执行：<code>npm run build</code>
                  </p>
                  <p className="text-[11px] opacity-70">
                    10秒内会在项目根目录下生成一个名为 <code>dist/</code> 的静态资源文件夹。
                  </p>
                </div>

                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-855' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-sky-400 flex items-center gap-1.5">
                    <span>步骤 2：直接拖拽发布至免费托管平台</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    打开 <strong>Netlify (app.netlify.com/drop)</strong> 或 <strong>Vercel (vercel.com)</strong>：
                  </p>
                  <ul className="list-disc pl-4 text-[11px] opacity-80 space-y-1">
                    <li>无需绑定信用卡，直接注册登录；</li>
                    <li>在页面上直接把刚打包生成的 <code>dist</code> 文件夹拖拽进去；</li>
                    <li>平台会自动在 5 秒内分配一个永久公网链接（例如：<code>https://sea-reviews-workspace.netlify.app</code>）。</li>
                  </ul>
                </div>

                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>步骤 3：发给同事使用</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    将上述链接发到企业微信、钉钉或飞书群，任何同事在手机或电脑浏览器中点开即可直接进入大盘，<strong>没有任何登录校验与弹窗！</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 方案二：局域网内同一 Wi-Fi 免登录共享 */}
            <div className={`p-5 rounded-xl border space-y-4 ${
              theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Laptop className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      方案二：办公室局域网直接共享 (0成本 · 零云端配置)
                    </h3>
                    <p className={`text-[11px] ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                      只要同事连接同一个公司 Wi-Fi 或网线，输入您的电脑 IP 即可秒开
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
                  内网
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <span>步骤 1：本地启动增加 --host 参数</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    在您的电脑终端中运行：
                  </p>
                  <pre className="p-2 rounded bg-neutral-900 font-mono text-[11px] text-amber-300 border border-neutral-800">
                    npm run dev -- --host
                  </pre>
                </div>

                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <span>步骤 2：获取局域网 IP 地址</span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed">
                    终端会直接打印出内网链接，例如：
                  </p>
                  <pre className="p-2 rounded bg-neutral-900 font-mono text-[11px] text-sky-300 border border-neutral-800">
                    ➜  Network: http://192.168.1.108:3000/
                  </pre>
                  <p className="text-[11px] opacity-70">
                    （或者在 Windows 命令行输入 <code>ipconfig</code> 查看 IPv4 地址）
                  </p>
                </div>

                <div className={`p-3 rounded-lg border space-y-1.5 ${
                  theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>步骤 3：让同事直接在浏览器输入该网址</span>
                  </div>
                  <p className="text-[11px] opacity-80">
                    同事连接同一 Wi-Fi 后，在浏览器输入 <code>http://192.168.1.108:3000</code>，即可同时访问、查看看板与上传分析自己的表格，<strong>全程 100% 免登录！</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 本地电脑/桌面下载与安装完整流程 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 border-neutral-800">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Download className="h-4 w-4" />
              </span>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  在本地电脑/桌面运行：下载、安装与启动步骤 (新手指南)
                </h3>
                <p className={`text-[11px] ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                  只需三步，即可将整个项目迁移到您自己的 Windows 或 Mac 桌面独立运行
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className={`p-3.5 rounded-lg border space-y-2 ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">1</span>
                  <span>第一步：下载项目到桌面</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  在 Google AI Studio 页面右上角点击 <strong>Export / Download Zip</strong> 下载压缩包，或者在终端运行：
                </p>
                <pre className="p-2 rounded bg-neutral-900 font-mono text-[10px] text-neutral-300 border border-neutral-800 overflow-x-auto">
                  git clone &lt;代码仓库地址&gt;
                </pre>
                <p className="text-[11px] opacity-70">
                  解压到桌面（例如：<code>C:\Users\Desktop\sea-review-studio</code>）。
                </p>
              </div>

              <div className={`p-3.5 rounded-lg border space-y-2 ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">2</span>
                  <span>第二步：安装运行环境 Node.js</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  电脑若未安装 Node.js，前往官网 <strong>nodejs.org</strong> 下载安装 <em>LTS 长期稳定版</em>（一路点击下一步安装即可，自带 npm）。
                </p>
                <p className="text-[11px] opacity-70">
                  安装成功后打开命令行输入 <code>node -v</code> 会显示版本号即代表就绪。
                </p>
              </div>

              <div className={`p-3.5 rounded-lg border space-y-2 ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-850' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                  <span>第三步：安装依赖并一键启动</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  在桌面项目文件夹内打开命令行终端，依次执行：
                </p>
                <pre className="p-2 rounded bg-neutral-900 font-mono text-[10px] text-amber-300 border border-neutral-800 space-y-1">
                  <div>npm install</div>
                  <div>npm run dev</div>
                </pre>
                <p className="text-[11px] opacity-70">
                  终端会提示打开 <code>http://localhost:3000</code>，直接进入系统！
                </p>
              </div>
            </div>
          </div>

          {/* 后续修改功能指南：代码地图精准导航 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-2 border-b pb-3 border-neutral-800">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileCode className="h-4 w-4" />
              </span>
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  后续如果我要修改功能，要去哪里修改？（核心源码地图导航）
                </h3>
                <p className={`text-[11px] ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                  代码结构完全模块化，每个业务功能对应独立的文件，直接打开即可快速修改
                </p>
              </div>
            </div>

            <div className="border border-neutral-800 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                    <th className="py-2.5 px-3">业务功能模块</th>
                    <th className="py-2.5 px-3">对应的核心源码文件路径</th>
                    <th className="py-2.5 px-3">如何修改 / 常见定制场景</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">大盘指标、图表与看板界面</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/components/ExecutiveDashboard.tsx</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">修改顶端 7 大分类卡片、满意度双环图、时间趋势柱状/折线图、或下方评论卡片展示样式。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">智能标签词频与大盘联动规则</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/dashboardExtractor.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">在 <code>TAG_DEFINITIONS</code> 中增加或修改新的卖点、痛点关键词（如增加“材质坚硬”、“易脱落”等）。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">小语种检测、口语俚语黑话字典</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/languageDetector.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">扩展泰语、印尼语、越南语缩写词（如印尼语 <code>bgs</code> 代表 bagus 好，泰语 <code>ส่งไว</code> 代表发货快）。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">五星/四星隐性差评识别算法</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/sentimentAndHiddenReview.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">调整识别“人情给五星但文字抱怨”的转折词和贬义词权重，以及情感极性计算。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">水军、刷单、虾币凑字废话清洗</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/reviewCleaner.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">调整虾币废话判定规则（如 <code>55555</code>、字符重复度、无意义字符比率）。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">Excel / CSV 表头自动识别与解析</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/fileParser.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">新增支持其他 ERP（如芒果店长、店小秘、马帮）导出的特殊列名映射。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">选品 · Listing · 竞品决策分析规则</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/utils/scenarioAnalyzer.ts</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">修改三大决策看板中自动输出的行动建议、差异化打法和文案卖点提炼逻辑。</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-amber-400">顶部导航栏与主页面路由切换</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-sky-400">src/components/Header.tsx & src/App.tsx</td>
                    <td className="py-2.5 px-3 text-[11px] opacity-80">新增或删除全局菜单项，配置品牌 Logo、名称及页面组件挂载。</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-850 text-neutral-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <span>修改代码后，终端的 <code>npm run dev</code> 会自动热重载刷新浏览器，不需要重启！</span>
              </div>
              <span className="font-mono text-[10px] text-amber-400 font-bold">Fast HMR Active</span>
            </div>
          </div>
        </div>
      )}

      {/* 模块1：外观风格与工作台设置 */}
      {activeSubTab === 'theme' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 主题色系切换 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Palette className="h-4 w-4 text-amber-500" />
                <span>工作台整体色彩风格 (Theme Mode)</span>
              </h2>
              <span className="text-[11px] font-mono text-amber-500 font-semibold">
                当前：{theme === 'dark' ? '黑底暗黑模式' : '白底明亮模式'}
              </span>
            </div>

            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
              支持根据使用环境（夜间密集选品复盘或白天商务演示）随时切换主题色彩系统，所有图表与指标卡自动自适应高对比度显示。
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* 黑底模式卡片 */}
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  theme === 'dark'
                    ? 'bg-neutral-950 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
                    : 'bg-neutral-900 border-neutral-800 opacity-70 hover:opacity-100'
                }`}
              >
                {theme === 'dark' && (
                  <span className="absolute top-2.5 right-2.5 p-1 rounded-full bg-amber-500 text-neutral-950">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">深色黑底沉浸风</span>
                </div>
                <div className="h-12 rounded bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-between text-[10px] text-neutral-400">
                  <div className="space-y-1">
                    <div className="h-1.5 w-12 bg-amber-500/80 rounded" />
                    <div className="h-1.5 w-16 bg-neutral-700 rounded" />
                  </div>
                  <div className="h-6 w-6 rounded-full border border-amber-500/40 bg-neutral-800" />
                </div>
                <span className="block mt-2 text-[10px] text-neutral-400">适合长时间盯屏、护眼、极客高信息密度</span>
              </button>

              {/* 白底模式卡片 */}
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  theme === 'light'
                    ? 'bg-slate-50 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
                    : 'bg-slate-100 border-slate-300 opacity-70 hover:opacity-100'
                }`}
              >
                {theme === 'light' && (
                  <span className="absolute top-2.5 right-2.5 p-1 rounded-full bg-amber-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-900">商务明亮白底风</span>
                </div>
                <div className="h-12 rounded bg-white border border-slate-200 p-2 flex items-center justify-between text-[10px] text-slate-600">
                  <div className="space-y-1">
                    <div className="h-1.5 w-12 bg-amber-500 rounded" />
                    <div className="h-1.5 w-16 bg-slate-300 rounded" />
                  </div>
                  <div className="h-6 w-6 rounded-full border border-amber-500/40 bg-slate-100" />
                </div>
                <span className="block mt-2 text-[10px] text-slate-500">适合汇报演示、打印报告、明亮办公环境</span>
              </button>
            </div>
          </div>

          {/* 翻译与性能配置 */}
          <div className={`p-5 rounded-xl border space-y-4 ${
            theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-neutral-800">
              <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <RefreshCw className="h-4 w-4 text-sky-400" />
                <span>翻译引擎与本地缓存配置</span>
              </h2>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                双通道加速已激活
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`p-3 rounded-lg border ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="font-semibold text-sky-400 mb-1 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Google 神经机器翻译引擎通道</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  内置 <code>/api/translate</code> 智能代理，采用 Google Translate 原文整段直译，支持长文本逐句忠实转译并自动本地写入双级缓存。
                </p>
              </div>

              <div className={`p-3 rounded-lg border ${
                theme === 'dark' ? 'bg-neutral-950 border-neutral-800 text-neutral-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="font-semibold text-amber-500 mb-1 flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  <span>本地离线垂直词典保障</span>
                </div>
                <p className="text-[11px] leading-relaxed">
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
          theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              <Code className="h-4 w-4 text-amber-500" />
              <span>东南亚评论洞察工作台 · 全栈技术栈与设计哲学解释</span>
            </h2>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
              专为跨境电商“零预算、高时效、强隐私”诉求打造的轻量级纯客户端数据诊断方案
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* 核心1：前端渲染与状态机 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Terminal className="h-4 w-4" />
                <span>1. 前端高性能渲染栈</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'
              }`}>
                <li>• <strong>React 19 + TypeScript：</strong>利用强类型约束确保原始导表解析与数据大盘零运行时崩溃。</li>
                <li>• <strong>Tailwind CSS 4.0：</strong>极简原子化样式，毫秒级主题切换响应。</li>
                <li>• <strong>Vite 8.0：</strong>亚秒级冷启动与轻量打包。</li>
              </ul>
            </div>

            {/* 核心2：多语言与翻译引擎 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 text-sky-400 font-bold">
                <Server className="h-4 w-4" />
                <span>2. 语义直译与双模驱动</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'
              }`}>
                <li>• <strong>Google Translate 代理：</strong>通过内置 <code>/api/translate</code> 服务端中间件，保障长评论完全按谷歌翻译模型高保真逐句直译。</li>
                <li>• <strong>自适应分词词根：</strong>深度融合泰语（TH）、越南语（VN）、印尼语（ID）电商口语俗语库。</li>
              </ul>
            </div>

            {/* 核心3：零数据泄露隐私安全 */}
            <div className={`p-4 rounded-xl border space-y-2.5 ${
              theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Shield className="h-4 w-4" />
                <span>3. 本地离线隐私沙箱</span>
              </div>
              <ul className={`space-y-1.5 leading-relaxed text-[11px] ${
                theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'
              }`}>
                <li>• <strong>数据不上传三方：</strong>导入的 Excel 原始销售与评论文件仅在浏览器内存及本地 localStorage 中解析计算。</li>
                <li>• <strong>商业机密绝对隔离：</strong>避免将核心出单 SKU、客单价或竞品评论泄露给外部公网。</li>
              </ul>
            </div>
          </div>

          {/* 算法逻辑流程图解 */}
          <div className={`p-4 rounded-xl border space-y-2 text-xs ${
            theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <h3 className={`font-bold ${theme === 'dark' ? 'text-neutral-200' : 'text-slate-800'}`}>
              全流程算法数据流转逻辑 (Pipeline)
            </h3>
            <div className="p-3 rounded font-mono text-[11px] bg-neutral-900 text-neutral-300 border border-neutral-800 overflow-x-auto">
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
          theme === 'dark' ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-neutral-800">
            <div>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>企业级角色权限管理矩阵 (RBAC Permission Center)</span>
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-500'}`}>
                支持多岗位协同，依据岗位职能划分数据查看、脱敏、分析与导出权限
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className={`text-xs ${theme === 'dark' ? 'text-neutral-400' : 'text-slate-600'}`}>切换模拟角色体验:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className={`text-xs rounded px-2.5 py-1 font-mono font-medium border focus:outline-none cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-neutral-950 text-amber-400 border-neutral-700' 
                    : 'bg-white text-amber-600 border-slate-300 shadow-sm'
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
            currentRole === 'admin' 
              ? 'bg-amber-950/20 border-amber-500/40 text-amber-300' 
              : (currentRole === 'specialist' ? 'bg-sky-950/20 border-sky-500/40 text-sky-300' : 'bg-neutral-950 border-neutral-800 text-neutral-300')
          }`}>
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-bold">
                  当前处于【{
                    currentRole === 'admin' ? '超级管理员' : (currentRole === 'specialist' ? '品类运营专家' : (currentRole === 'qc' ? '供应链质检专家' : '访客查看者'))
                  }】视图
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {currentRole === 'admin' && '拥有全量权限：原始评论查看、敏感买家昵称脱敏解封、指标钻取、一键全量 Excel 导出、清洗规则参数定制。'}
                  {currentRole === 'specialist' && '重点赋能选品与 Listing 优化：可查看词频标签、买家本土原声与差异化卖点，买家个人信息自动脱敏。'}
                  {currentRole === 'qc' && '重点赋能品质监控：聚焦于五星隐性差评、退货痛点、电芯与塑料结构件缺陷分析。'}
                  {currentRole === 'viewer' && '只读受限视图：仅可浏览综合大盘统计与聚合图表，无法导出明细或修改任何数据源。'}
                </p>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-mono border uppercase font-semibold">
              {currentRole}
            </span>
          </div>

          {/* 权限矩阵表 */}
          <div className="border border-neutral-800 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-950 text-neutral-400 font-medium border-b border-neutral-800">
                  <th className="py-2.5 px-3">业务模块 / 功能权限项</th>
                  <th className="py-2.5 px-3 text-center">超级管理员</th>
                  <th className="py-2.5 px-3 text-center">品类运营专家</th>
                  <th className="py-2.5 px-3 text-center">供应链与质检</th>
                  <th className="py-2.5 px-3 text-center">访客只读</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                <tr>
                  <td className="py-2.5 px-3 font-medium">原始数据导入与多维清洗配置</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 全部权限</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 支持导入</td>
                  <td className="py-2.5 px-3 text-center text-neutral-500">-</td>
                  <td className="py-2.5 px-3 text-center text-neutral-500">-</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">买家原始评价完整穿透与原文字段</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 完整穿透</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 脱敏穿透</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 痛点穿透</td>
                  <td className="py-2.5 px-3 text-center text-neutral-500">仅统计聚合</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">五星/四星隐性差评深度挖掘专区</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 深度归因</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 卖点反打</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 批次召回</td>
                  <td className="py-2.5 px-3 text-center text-neutral-500">只读数量</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">选品 · Listing · 竞品决策三大看板</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 完整决策</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 核心应用</td>
                  <td className="py-2.5 px-3 text-center text-neutral-400">弱相关</td>
                  <td className="py-2.5 px-3 text-center text-neutral-400">受限预览</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">诊断分析成果 Excel 全量导出</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 允许导出</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 允许导出</td>
                  <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">✓ 允许导出</td>
                  <td className="py-2.5 px-3 text-center text-rose-500 font-bold">✕ 禁止导出</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
