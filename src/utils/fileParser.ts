import * as XLSX from 'xlsx';
import { StandardReview, SEAPlatform } from '../types';
import { detectLanguage } from './languageDetector';
import { evaluateReviewValidity } from './reviewCleaner';
import { detectHiddenNegative, extractTopicsAndKeywords } from './sentimentAndHiddenReview';
import { translateToChinese } from './translator';

/**
 * 东南亚电商评论数据解析与标准字段映射器
 * 兼容 Shopee 导出格式、Lazada 导出格式（含两版差异）以及自定义 Excel/CSV/JSON
 */

export interface FieldMapping {
  ratingKey: string;
  contentKey: string;
  skuKey: string;
  buyerKey: string;
  timeKey: string;
  imageKey: string;
  replyKey: string;
  idKey: string;
}

// 自动猜测字段映射关系 (涵盖 Shopee / Lazada 中、英、泰、越、印尼五语表头)
export function autoDetectFieldMapping(sampleRow: Record<string, any>): FieldMapping {
  const keys = Object.keys(sampleRow);
  const findKey = (patterns: RegExp[]): string => {
    for (const pat of patterns) {
      const match = keys.find(k => pat.test(k));
      if (match) return match;
    }
    return '';
  };

  return {
    ratingKey: findKey([/rating/i, /star/i, /评分/i, /星级/i, /score/i, /bintang/i, /đánh giá/i, /คะแนน/i, /ดาว/i]),
    contentKey: findKey([/content/i, /comment/i, /review/i, /内容/i, /评价/i, /ulasan/i, /nhận xét/i, /text/i, /ความคิดเห็น/i, /ข้อความ/i, /feedback/i, /คำติชม/i]),
    skuKey: findKey([/sku/i, /variation/i, /model/i, /规格/i, /款式/i, /variant/i, /warna/i, /size/i, /ตัวเลือก/i, /แบบ/i, /phân loại/i, /option/i]),
    buyerKey: findKey([/buyer/i, /user/i, /customer/i, /买家/i, /用户名/i, /nama/i, /người mua/i, /ชื่อผู้ใช้/i, /ผู้ซื้อ/i, /username/i]),
    timeKey: findKey([/time/i, /date/i, /时间/i, /日期/i, /created/i, /tanggal/i, /ngày/i, /เวลา/i, /วันที่/i]),
    imageKey: findKey([/image/i, /photo/i, /picture/i, /图片/i, /gambar/i, /ảnh/i, /รูป/i, /media/i, /url/i]),
    replyKey: findKey([/reply/i, /seller/i, /回复/i, /balasan/i, /phản hồi/i, /ตอบกลับ/i]),
    idKey: findKey([/id/i, /order/i, /订单/i, /单号/i, /code/i, /รหัส/i, /sn/i, /number/i])
  };
}

export function parseRawRowToStandard(
  raw: Record<string, any>,
  mapping: FieldMapping,
  platform: SEAPlatform = 'shopee',
  index: number = 0
): StandardReview {
  // 提取评分
  const rawRating = raw[mapping.ratingKey];
  let rating = 5;
  if (typeof rawRating === 'number') {
    rating = Math.max(1, Math.min(5, Math.round(rawRating)));
  } else if (typeof rawRating === 'string') {
    const parsed = parseInt(rawRating.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      rating = parsed;
    }
  }

  const content = String(raw[mapping.contentKey] || raw.content || raw.comment || raw.review || '').trim();
  const sku = String(raw[mapping.skuKey] || raw.sku || raw.variation || '默认规格').trim();
  const buyerName = String(raw[mapping.buyerKey] || raw.buyer || raw.username || `买家_${index + 1}`).trim();
  const reviewTime = String(raw[mapping.timeKey] || raw.time || raw.date || new Date().toISOString().slice(0, 10)).trim();
  
  // 图片解析：支持单张 URL 或以逗号/分号/换行分隔的多张图片链接
  const rawImages = raw[mapping.imageKey] || raw.images || raw.pictures || raw.photos || raw.image_urls || '';
  let imageUrls: string[] = [];
  let imageCount = 0;

  if (typeof rawImages === 'string' && rawImages.trim()) {
    const matches = rawImages.match(/https?:\/\/[^\s,;"'<>]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\/[^\s,;"'<>]*)/gi) || 
                    rawImages.match(/https?:\/\/[^\s,;"'<>]+/gi);
    if (matches && matches.length > 0) {
      imageUrls = matches;
      imageCount = matches.length;
    } else {
      const num = parseInt(rawImages, 10);
      imageCount = isNaN(num) ? (rawImages ? 1 : 0) : num;
    }
  } else if (Array.isArray(rawImages)) {
    imageUrls = rawImages.map(String).filter(s => s.startsWith('http'));
    imageCount = imageUrls.length;
  } else if (typeof rawImages === 'number') {
    imageCount = rawImages;
  }

  const sellerReply = raw[mapping.replyKey] ? String(raw[mapping.replyKey]).trim() : undefined;
  const isAnonymous = /匿名|anonymous|anonym/i.test(buyerName) || buyerName.includes('***');
  const id = String(raw[mapping.idKey] || raw.id || `REV-${Date.now().toString().slice(-4)}-${index + 1}`);

  // 1. 多语言探测
  const langResult = detectLanguage(content);

  // 2. 无效评论识别
  const invalidCheck = evaluateReviewValidity(content, rating, imageCount, false, isAnonymous, 0);

  // 3. 隐性差评挖掘（结合产品上下文，防止工具误判服装）
  const hiddenNegativeCheck = detectHiddenNegative(content, rating);

  // 4. 关键主题提取
  const { topics, keyPhrases } = extractTopicsAndKeywords(content, rating);

  // 5. 中文释义翻译 (优先严格保证与买家原文配对，清洗第三方爬虫导出的模板假翻译)
  const rawZh = raw.contentZh || raw.translation || raw.zh || '';
  const rawZhStr = String(rawZh).trim();
  const isSuspicious = !rawZhStr || 
    rawZhStr.includes('【买家好评】') || 
    rawZhStr.includes('规格材质符合预期') || 
    (rating <= 3 && (rawZhStr.includes('好评') || rawZhStr.includes('满意') || rawZhStr.includes('赞许')));

  const contentZh = !isSuspicious ? rawZhStr : translateToChinese(content, langResult.lang);

  return {
    id,
    platform,
    rating,
    content,
    contentZh,
    sku,
    buyerName,
    reviewTime,
    likesCount: typeof raw.likes === 'number' ? raw.likes : 0,
    imageCount,
    imageUrls,
    hasVideo: Boolean(raw.hasVideo || raw.video),
    sellerReply,
    isAnonymous,
    isRepeatBuyer: Boolean(raw.isRepeat || raw.repeatBuyer),
    language: langResult.lang,
    languageLabel: langResult.label,
    invalidCheck,
    hiddenNegativeCheck,
    topics,
    keyPhrases,
    rawRow: raw
  };
}

/**
 * 解析上传的文件 (Excel / CSV)
 */
export async function parseUploadedFile(file: File): Promise<{ rows: Record<string, any>[]; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
        resolve({ rows: jsonRows, fileName: file.name });
      } catch (err) {
        reject(new Error(`解析表格文件失败: ${err instanceof Error ? err.message : String(err)}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('读取本地文件出错'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * 导出评论到 Excel
 */
export function exportReviewsToExcel(reviews: StandardReview[], filename: string = '东南亚跨境评论诊断报告.xlsx') {
  const exportData = reviews.map((r, i) => ({
    '序号': i + 1,
    '评价ID': r.id,
    '所属平台': r.platform.toUpperCase(),
    '买家表面星级': `${r.rating}★`,
    '买家评价原文': r.content,
    '智能中文释义(完整译文)': r.contentZh,
    '购买规格SKU': r.sku,
    '买家昵称': r.buyerName,
    '留评日期': r.reviewTime,
    '评价图片链接': (r.imageUrls && r.imageUrls.length > 0) ? r.imageUrls.join(', ') : (r.imageCount > 0 ? `${r.imageCount}张` : '无'),
    '语言识别': r.languageLabel,
    '是否有效评论': r.invalidCheck.isInvalid ? '无效剔除' : '真实有效',
    '无效原因说明': r.invalidCheck.reasons.join('; ') || '无',
    '是否为五星隐性差评': r.hiddenNegativeCheck.isHiddenNegative ? '是 (隐性差评)' : '否',
    '真实情感方向': r.hiddenNegativeCheck.realSentiment === 'positive' ? '正向满意' : (r.hiddenNegativeCheck.realSentiment === 'negative' ? '负向不满' : '中立观望'),
    '抽取痛点': r.hiddenNegativeCheck.extractedGrievances.join(', ') || '无明显痛点',
    '一级主题标签': r.topics.join(', '),
    '运营改进建议': r.hiddenNegativeCheck.businessImpact
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '评论全景诊断');
  XLSX.writeFile(workbook, filename);
}
