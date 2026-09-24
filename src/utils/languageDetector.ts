import { SupportedLanguage } from '../types';

/**
 * Multi-language detection & localization dictionary for Southeast Asian e-commerce reviews
 * Specially tuned for Thai (TH), Vietnamese (VI), Indonesian (ID), Tagalog/English (PH), Malay (MY)
 */

export function detectLanguage(text: string): { lang: SupportedLanguage; label: string; confidence: number } {
  if (!text || text.trim().length === 0) {
    return { lang: 'en', label: '未知/英文', confidence: 0 };
  }

  // 1. Check Thai (ก-ฮ Unicode range \u0E00-\u0E7F)
  const thaiMatches = text.match(/[\u0E00-\u0E7F]/g);
  if (thaiMatches && thaiMatches.length >= 2) {
    const ratio = thaiMatches.length / text.length;
    return { 
      lang: 'th', 
      label: '泰语 (Thai)', 
      confidence: Math.min(100, Math.round(ratio * 120)) 
    };
  }

  // 2. Check Vietnamese diacritics
  const vietnameseRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  if (vietnameseRegex.test(text)) {
    return { lang: 'vi', label: '越南语 (Vietnamese)', confidence: 95 };
  }

  // 3. Check Chinese
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return { lang: 'zh', label: '中文 (Chinese)', confidence: 98 };
  }

  // 4. Check Indonesian / Malay characteristic vocabulary
  const lower = text.toLowerCase();
  const indoTokens = ['bagus', 'pengiriman', 'kecewa', 'pesanan', 'barang', 'mantap', 'sesuai', 'rusak', 'suka', 'kurir', 'bahan', 'warna', 'ukuran', 'seller', 'cepat', 'lama', 'banget', 'bintang'];
  const indoScore = indoTokens.filter(token => lower.includes(token)).length;
  if (indoScore >= 2) {
    return { lang: 'id', label: '印尼语 (Bahasa Indonesia)', confidence: 85 };
  }

  // 5. Check Tagalog (PH)
  const tagalogTokens = ['ganda', 'salamat', 'dumating', 'maganda', 'kaso', 'pangit', 'sulit', 'mabilis', 'order', 'ang'];
  const tagalogScore = tagalogTokens.filter(token => lower.includes(token)).length;
  if (tagalogScore >= 2) {
    return { lang: 'ph', label: '菲律宾语 (Taglish)', confidence: 85 };
  }

  if (indoScore === 1) {
    return { lang: 'id', label: '印尼语/马来语', confidence: 60 };
  }

  return { lang: 'en', label: '英语/通用', confidence: 80 };
}

/**
 * Authentic Southeast Asian e-commerce slang and phrase knowledge base
 * Thai: 55555 (laughter), ตรงปก (matches description), ส่งช้า (slow shipping), กล่องบุบ (dented box)
 * Vietnamese: đúng mô tả (matches description), giao chậm (slow delivery), ủng hộ (support shop)
 * Indonesian: bintang 5 buat kurir (5 stars for courier, but item poor)
 */
export const SEA_SLANG_DICTIONARY: Record<string, { zh: string; note: string; category: string }> = {
  // Thai (泰国)
  'ตรงปก': { zh: '与主图实物相符（正版/对版）', note: '买家最重视的核心卖点确认词', category: '质量与相符度' },
  'ไม่ตรงปก': { zh: '货不对板！实物与图片严重不符', note: '致命差评信号，说明Listing主图误导', category: '严重货不对板' },
  'ส่งช้า': { zh: '发货极慢/物流拖延', note: '跨境海运或本地尾程超时高频词', category: '物流痛点' },
  'ส่งไว': { zh: '发货神速/物流给力', note: '买家惊喜好评词', category: '物流优势' },
  'กล่องบุบ': { zh: '外包装箱被压烂凹陷', note: '隐性差评常见原因，多由于跨境长途无加厚缓冲', category: '包装痛点' },
  'ไซส์เล็กกว่าปกติ': { zh: '尺码偏小一号', note: '泰国买家反馈尺码表偏差的标准表达', category: '尺寸偏差' },
  '55555': { zh: '哈哈哈哈哈（泰语5发音为Ha）', note: '泰国网民独有爆笑拟声，常夹杂在评论中', category: '情绪表达' },
  'เสียดาย': { zh: '太遗憾了/真可惜', note: '四星/五星隐性差评的转折信号', category: '隐性抱怨' },
  'คุ้มค่า': { zh: '物超所值/性价比极高', note: '高转化率口碑词', category: '性价比' },
  
  // Vietnamese (越南)
  'đúng mô tả': { zh: '与商品描述完全一致', note: '越南买家最高评定', category: '相符度' },
  'giao hàng nhanh': { zh: '发货配送非常快', note: '服务满意', category: '物流' },
  'hơi mỏng': { zh: '面料稍微有点薄透', note: '越南服饰类高星隐性不满高发点', category: '材质痛点' },
  'ủng hộ shop': { zh: '会继续回购支持店铺', note: '复购忠诚信号', category: '买家忠诚' },

  // Indonesian (印尼)
  'sesuai ekspektasi': { zh: '完全符合买前预期', note: '正向满意度', category: '相符度' },
  'kurang rapi': { zh: '车线做工不够平整细致', note: '隐性细节扣分项', category: '做工细节' },
  'bintang 5 buat kurir': { zh: '5星只给快递小哥（言下之意商品一般）', note: '印尼典型人情五星差评！', category: '人情高星差评' },
  'pengiriman lama': { zh: '印尼群岛物流漫长', note: '岛际运输常见瓶颈', category: '物流痛点' },
};
