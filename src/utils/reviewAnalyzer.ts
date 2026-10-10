/**
 * 东南亚多语言电商评论 - 后端大模型全量分析客户端
 * 连接后端 Express /api/analyze 接口
 * 保证 Prompt、API Key 和模型 Base URL 彻底在后端受控管理
 */

export interface ReviewAnalysisResult {
  success: boolean;
  provider?: string;
  model?: string;
  translation: string;
  sentiment: string; // "正向满意" | "五星隐性差评" | "四星隐性差评" | "严重差评" | "负向不满" | "中立观望"
  tags: string[];
  isFallback?: boolean;
  error?: string;
}

/**
 * 调用后端 /api/analyze 对单条评论进行多维度 AI 分析
 * 单次请求同时获取：精准译文、真实情感方向、具体痛点/优点标签
 */
export async function analyzeReviewWithBackend(params: {
  content: string;
  rating?: number;
  sku?: string;
  language?: string;
}): Promise<ReviewAnalysisResult> {
  const { content, rating = 5, sku = '', language = 'auto' } = params;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        rating,
        sku,
        language
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return {
          success: true,
          provider: data.provider || 'backend_llm',
          model: data.model || 'gemini-3.7-flash',
          translation: data.translation || '',
          sentiment: data.sentiment || '中立观望',
          tags: Array.isArray(data.tags) ? data.tags : [],
          isFallback: Boolean(data.isFallback || data.provider === 'local_nlp_fallback')
        };
      }
    }
  } catch (error) {
    console.error('[analyzeReviewWithBackend] Network request failed:', error);
  }

  // 若网络中断或异常，明确标记 isFallback 与 failure
  return {
    success: false,
    isFallback: true,
    error: 'network_failed',
    model: 'offline',
    translation: '',
    sentiment: rating >= 4 ? '正向满意' : (rating <= 2 ? '严重差评' : '中立观望'),
    tags: []
  };
}
