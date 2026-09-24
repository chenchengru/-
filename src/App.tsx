/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header, MainTabType } from './components/Header';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { HiddenNegativeDashboard } from './components/HiddenNegativeDashboard';
import { ScenarioInsights } from './components/ScenarioInsights';
import { SettingsManagement } from './components/SettingsManagement';
import { PRESET_DATASETS } from './data/mockDatasets';
import { StandardReview, DatasetSummary } from './types';
import { analyzeScenarios } from './utils/scenarioAnalyzer';
import { translateToChinese } from './utils/translator';
import { detectHiddenNegative, extractTopicsAndKeywords } from './utils/sentimentAndHiddenReview';
import { 
  exportReviewsToExcel, 
  parseUploadedFile, 
  autoDetectFieldMapping, 
  parseRawRowToStandard 
} from './utils/fileParser';
import { 
  getDatasetHistory, 
  saveDatasetRecord, 
  deleteDatasetRecord, 
  getActiveDatasetId, 
  setActiveDatasetId, 
  DatasetRecord 
} from './utils/datasetStorage';

// 数据重水合：对已有缓存评论做最新翻译、隐性差评算法与标签的同步升级
const rehydrateReviews = (rawReviews: StandardReview[]): StandardReview[] => {
  return rawReviews.map((r) => {
    const isMismatched = 
      !r.contentZh || 
      r.contentZh.includes('【买家留言】') || 
      r.contentZh.includes('【买家好评】') ||
      r.contentZh.includes('规格材质符合预期') ||
      /[\u0E00-\u0E7F]/.test(r.contentZh) ||
      (r.rating <= 3 && (r.contentZh.includes('好评') || r.contentZh.includes('满意') || r.contentZh.includes('质量可靠耐用'))) ||
      (r.content.includes('สินค้าที่ได้มาสวยค่ะ') && !r.contentZh.includes('切割效果'));

    const updatedZh = isMismatched ? translateToChinese(r.content, r.language) : r.contentZh;
    const updatedHidden = detectHiddenNegative(r.content, r.rating);
    const { topics, keyPhrases } = extractTopicsAndKeywords(r.content, r.rating);

    return {
      ...r,
      contentZh: updatedZh,
      hiddenNegativeCheck: updatedHidden,
      topics: (topics && topics.length > 0) ? topics : r.topics,
      keyPhrases: (keyPhrases && keyPhrases.length > 0) ? keyPhrases : r.keyPhrases
    };
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTabType>('executive_dashboard');
  
  // 工作台主题模式：支持黑底暗黑模式与白底明亮模式
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('sea_studio_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  // 历史表格记录与当前活跃文件状态
  const [historyList, setHistoryList] = useState<DatasetRecord[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [importTime, setImportTime] = useState<string>('');
  const [reviews, setReviews] = useState<StandardReview[]>([]);

  // 首次加载：从 localStorage 读取历史导入记录，若无则使用干净基准数据初始化
  useEffect(() => {
    const existingHistory = getDatasetHistory();
    const activeId = getActiveDatasetId();

    if (existingHistory.length > 0) {
      setHistoryList(existingHistory);
      const active = existingHistory.find(h => h.id === activeId) || existingHistory[0];
      const rehydrated = rehydrateReviews(active.reviews);
      setReviews(rehydrated);
      setCurrentFileName(active.fileName);
      setImportTime(active.importTime);
      setActiveDatasetId(active.id);
    } else {
      // 首次载入示范初始数据
      const initialReviews = rehydrateReviews(PRESET_DATASETS[0].reviews);
      const initialRecord: DatasetRecord = {
        id: `ds-${Date.now()}`,
        fileName: 'Shopee_Bangkok_原始评价数据_示范.xlsx',
        importTime: '2026-09-23 15:30',
        rowCount: initialReviews.length,
        avgRating: 4.65,
        reviews: initialReviews
      };
      saveDatasetRecord(initialRecord);
      setHistoryList([initialRecord]);
      setReviews(initialReviews);
      setCurrentFileName(initialRecord.fileName);
      setImportTime(initialRecord.importTime);
    }
  }, []);

  // 统一通用文件解析流程 (支持从 input 上传或直接拖放 Excel/CSV)
  const handleProcessFile = async (file: File) => {
    const { rows, fileName } = await parseUploadedFile(file);
    if (!rows || rows.length === 0) {
      throw new Error('未能从表格中解析到有效数据行，请检查表格格式');
    }

    const mapping = autoDetectFieldMapping(rows[0]);
    const normalizedReviews: StandardReview[] = rows.map((row, idx) => 
      parseRawRowToStandard(row, mapping, 'shopee', idx)
    );

    const rehydrated = rehydrateReviews(normalizedReviews);

    // 计算均星
    const sum = rehydrated.reduce((acc, r) => acc + r.rating, 0);
    const avg = rehydrated.length > 0 ? Number((sum / rehydrated.length).toFixed(2)) : 5.0;
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newRecord: DatasetRecord = {
      id: `ds-${Date.now()}`,
      fileName,
      importTime: timeStr,
      rowCount: rehydrated.length,
      avgRating: avg,
      reviews: rehydrated
    };

    saveDatasetRecord(newRecord);
    setActiveDatasetId(newRecord.id);

    setReviews(rehydrated);
    setCurrentFileName(fileName);
    setImportTime(timeStr);
    setHistoryList(getDatasetHistory());
  };

  // 历史记录切换
  const handleSelectHistory = (record: DatasetRecord) => {
    const rehydrated = rehydrateReviews(record.reviews);
    setReviews(rehydrated);
    setCurrentFileName(record.fileName);
    setImportTime(record.importTime);
    setActiveDatasetId(record.id);
  };

  // 删除历史记录
  const handleDeleteHistory = (id: string) => {
    deleteDatasetRecord(id);
    const updated = getDatasetHistory();
    setHistoryList(updated);
    if (updated.length > 0 && id === getActiveDatasetId()) {
      handleSelectHistory(updated[0]);
    }
  };

  // 综合清洗与质量指标汇总
  const summary: DatasetSummary = useMemo(() => {
    const totalCount = reviews.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        validCount: 0,
        invalidCount: 0,
        suspectedFakeCount: 0,
        coinsFarmingCount: 0,
        hiddenNegativeCount: 0,
        avgRating: 0,
        realSatisfactionScore: 0
      };
    }

    let sumRating = 0;
    let validCount = 0;
    let suspectedFakeCount = 0;
    let coinsFarmingCount = 0;
    let hiddenNegativeCount = 0;
    let genuinePositiveCount = 0;

    reviews.forEach(r => {
      sumRating += r.rating;
      if (r.invalidCheck.isInvalid) {
        if (r.invalidCheck.category === 'rating_fake_cluster') suspectedFakeCount++;
        if (r.invalidCheck.category === 'text_coins_farming') coinsFarmingCount++;
      } else {
        validCount++;
        if (r.hiddenNegativeCheck.isHiddenNegative) {
          hiddenNegativeCount++;
        } else if (r.hiddenNegativeCheck.realSentiment === 'positive') {
          genuinePositiveCount++;
        }
      }
    });

    const avgRating = Number((sumRating / totalCount).toFixed(2));
    const realSatisfactionScore = validCount > 0 
      ? Number(((genuinePositiveCount / validCount) * 100).toFixed(1))
      : 0;

    return {
      totalCount,
      validCount,
      invalidCount: totalCount - validCount,
      suspectedFakeCount,
      coinsFarmingCount,
      hiddenNegativeCount,
      avgRating,
      realSatisfactionScore
    };
  }, [reviews]);

  // 选品、Listing、竞品三大决策洞察引擎
  const scenarioInsights = useMemo(() => {
    return analyzeScenarios(reviews);
  }, [reviews]);

  // 导出结构化分析结果
  const handleExport = () => {
    const exportName = currentFileName 
      ? `${currentFileName.replace(/\.[^/.]+$/, '')}_深度诊断分析.xlsx`
      : '东南亚评论全景看板分析导出.xlsx';
    exportReviewsToExcel(reviews, exportName);
  };

  const isLight = theme === 'light';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isLight 
        ? 'bg-slate-50 text-slate-900 selection:bg-amber-200 selection:text-amber-900' 
        : 'bg-neutral-950 text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200'
    }`}>
      {/* 顶部导航 */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExport}
        hiddenCount={summary.hiddenNegativeCount}
        currentFileName={currentFileName}
        theme={theme}
        setTheme={setTheme}
      />

      {/* 主工作区视图 */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        {/* 1. 综合分析大盘看板 (已内置数据清洗与历史表格快速跳转) */}
        {activeTab === 'executive_dashboard' && (
          <ExecutiveDashboard
            reviews={reviews}
            setReviews={setReviews}
            currentFileName={currentFileName}
            importTime={importTime}
            historyList={historyList}
            onSelectHistory={handleSelectHistory}
            onDeleteHistory={handleDeleteHistory}
            onProcessFile={handleProcessFile}
            onNavigateToHiddenNegatives={() => setActiveTab('hidden_negative')}
            theme={theme}
          />
        )}

        {/* 2. 五星/四星隐性差评深度挖掘专区 (100% 依据真实数据源) */}
        {activeTab === 'hidden_negative' && (
          <HiddenNegativeDashboard
            reviews={reviews}
            onExport={handleExport}
            theme={theme}
          />
        )}

        {/* 3. 选品、Listing、竞品三大决策看板 (100% 依据真实数据源) */}
        {activeTab === 'scenarios' && (
          <ScenarioInsights
            insights={scenarioInsights}
            theme={theme}
          />
        )}

        {/* 4. 系统设置、技术栈架构解释、免登录团队部署指南与后台权限管理 */}
        {activeTab === 'settings' && (
          <SettingsManagement
            theme={theme}
            setTheme={setTheme}
          />
        )}
      </main>

      {/* 底部信息栏 */}
      <footer className={`border-t py-6 text-xs transition-colors ${
        isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-neutral-900 bg-neutral-950 text-neutral-500'
      }`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-neutral-400'}`}>
              东南亚跨境电商评论全景看板
            </span>
            <span aria-hidden="true">·</span>
            <span>Shopee / Lazada 原始评价导入 · 0.5秒本地清洗与决策证据生成</span>
          </div>

          <div className="flex items-center gap-4 opacity-80">
            <span>支持国家：泰国(TH) · 越南(VN) · 印尼(ID) · 菲律宾(PH) · 马来(MY)</span>
            <span aria-hidden="true">·</span>
            <span className={isLight ? 'text-slate-800 font-medium' : 'text-neutral-300 font-medium'}>
              本地隐私离线沙箱 · 商业机密零外泄
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
