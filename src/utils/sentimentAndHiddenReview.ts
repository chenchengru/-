import { HiddenNegativeCheck, ReviewSentiment } from '../types';
import { isWordlessReview } from './reviewCleaner';

/**
 * 东南亚电商评论真实情感与隐性差评识别引擎
 * 针对东南亚本土（泰、越、印尼、菲、马）“表面打五星/四星，正文写严重客诉”的人情差评进行精准识别与归因。
 * 严禁粗暴正则匹配；结合商品上下文与行业属性排除误判（如工具的操控操控词、导板尺寸、排除衣服硬编码）。
 */

interface ComplaintTrigger {
  regex: RegExp;
  category: string;
  grievanceZh: string;
  impact: string;
  condition?: (content: string) => boolean;
}

const COMPLAINT_TRIGGERS: ComplaintTrigger[] = [
  // 1. 电动工具与五金专用故障（高优先级）
  {
    regex: /bms|แบตเตอรี่.*(?:พัง|ชาร์จไม่เข้า|หมดไว|เสีย|ไม่ทน)|แบตไม่ทน|แบตเตอรี่.*ไม่ทน|แปปแปปก็หมด|ไฟชาร์จไม่เข้า|กระตุ้นแบต|ชาร์จไม่เข้า|baterai boros|battery drains fast|battery dying/i,
    category: '电池/BMS故障',
    grievanceZh: '电池无法充电/续航极短/单次作业极快耗尽/BMS损坏',
    impact: '电池与BMS保护板严重品控缺陷，需立即联系电芯工厂排查保护板虚焊与充放电检测'
  },
  {
    regex: /โซ่หลุด|โซ่หย่อน|โซ่ตก|rantai lepas|chain loose|chain comes off/i,
    category: '机械易脱扣',
    grievanceZh: '锯切作业中链条频繁滑脱松动',
    impact: '张紧轮与链条导轨设计公差过大，需在详情页补充正规张紧教学并升级导板锁止螺丝'
  },
  {
    regex: /หางปลา.*หัก|พลาสติก.*หัก|ฝาครอบ.*หัก|ตัวล็อคหัก|หักง่าย/i,
    category: '结构件脆弱',
    grievanceZh: '固定外罩塑料件脆裂易折断',
    impact: '外壳改用抗冲击工程ABS或尼龙注塑，消除注塑应力集中导致的脆裂'
  },
  {
    regex: /คืนได้ไหม|ขอคืน|คืนของ|คืนสินค้า|ไม่ชอบ|ไม่แนะนำ|ผิดหวัง|อย่าซื้อ|retur|refund|kembalikan|minta refund|can i return|want to return|do not like/i,
    category: '退货诉求',
    grievanceZh: '买家明确申请退货退款/强烈表示不喜欢与后悔',
    impact: '高危客诉信号，表面高星难掩极度不满，需客服第一时间介入拦截差评与纠纷'
  },

  // 2. 物流与包装运输损坏
  {
    regex: /กล่องบุบมาก|กล่องพังยับ|กล่องแตก|ของแตก|สินค้าแตกหัก|hancur|penyok parah|pecah|box crushed|damaged in transit/i,
    category: '包装破损',
    grievanceZh: '外箱被严重压瘪破损，内部配件磕碰变形',
    impact: '长途海运与本土快递暴力分拣致损，需升级气泡柱或双瓦楞外箱加固包装'
  },
  {
    regex: /ส่งช้ามาก|รอนานมาก|ส่งช้าเกินไป|ส่งเลว|ส่งแย่|ขนส่งแย่|ขนส่งไม่ดี|ส่งของแย่|kirimnya lama|pengiriman lambat|pengiriman buruk|pengiriman jelek|took forever|very slow delivery|bad delivery|poor delivery|giao hàng tệ|giao hàng kém|pangit ang delivery/i,
    category: '物流时效/配送服务差',
    grievanceZh: '尾程配送时间过长或配送服务极差，买家强烈不满',
    impact: '需在Listing首页明确跨境预计收货时效并优化本地末端物流商，避免物流差评侵蚀复购率'
  },

  // 3. 尺寸与规格落差（区分工具五金 vs 服饰）
  {
    regex: /(?:ไซส์เล็ก|ใส่ไม่ได้|คับมาก|คับเกิน|ใส่คับ|baju kekecilan|chật quá)(?!\s*ครับ)/i,
    category: '尺码版型',
    grievanceZh: '实物比正常尺码偏小/穿戴紧绷',
    impact: '核心退换货与五星隐性吐槽根源，急需在第二张主图打标【偏小1-2码，建议拍大】',
    condition: (c) => /เสื้อ|กางเกง|ชุด|ผ้า|ไซส์|baju|celana|dress|wear|size/i.test(c)
  },
  {
    regex: /ใบเลื่อยเล็ก|ขนาดเล็กกว่าที่คิด|เล็กกว่าที่คิดมาก|เครื่องเล็ก|เล็กเกินไป/i,
    category: '尺寸规格',
    grievanceZh: '实物尺寸/导板比预期偏小偏短',
    impact: '主图缺乏直观尺寸参照物，建议增加手持对比图与尺寸标注'
  },

  // 4. 货不对板与外观色差
  {
    regex: /ไม่ตรงปก|สีไม่เหมือน|สีเพี้ยน|màu khác|beda warna|color difference|not as pictured/i,
    category: '色差外观',
    grievanceZh: '实物颜色与主图滤镜偏差大 / 细节货不对板',
    impact: '主图精修过度导致买家收到实物有失落感，建议补充手机原相机无滤镜实拍图'
  },

  // 5. 材质面料（严格限制必须包含布料/衣服词，杜绝电锯误判）
  {
    regex: /ผ้าบางจ๋อย|ผ้าบางมาก|ผ้าบาง|เนื้อผ้าบาง|bahan tipis banget/i,
    category: '面料轻薄',
    grievanceZh: '面料偏薄透光 / 布料质感粗糙',
    impact: '面料克重偏低，建议在详情页注明适合夏季通风场景',
    condition: (c) => /ผ้า|เสื้อ|เนื้อผ้า|bahan|kain/i.test(c)
  },

  // 6. 发错货/漏发配件
  {
    regex: /ส่งผิด|ผิดสี|ผิดไซส์|ของขาด|ได้ไม่ครบ|อุปกรณ์ไม่ครบ|salah kirim|kurang barang|thiếu hàng|missing parts/i,
    category: '发货漏错',
    grievanceZh: '仓库拣货漏发配件/少发链条或电池',
    impact: '出库打包需引入扫码称重复核，杜绝少配件与混发'
  },

  // 7. 通用功能故障与易损坏
  {
    regex: /ใช้งานไม่ได้|ใช้ไม่ได้|ตัดไม่ได้|เครื่องดับ|ดับเอง|ดับ|ไม่ติด|เปิดไม่ติด|ร้อนเร็ว|พังเร็ว|พังง่าย|พังแล้ว|พังง่ายมาก|tidak bisa|rusak|broken quickly|broken easily|not working|stopped working|broken/i,
    category: '功能耐用',
    grievanceZh: '使用不久即损坏/频繁自动断电熄火停机/极易报废',
    impact: '供应链核心硬件耐久性严重不足，需向组装厂追责并强化带负载出厂测试'
  },

  // 8. 售后客服失联与保修无门
  {
    regex: /ไม่ตอบ|ไม่มีคนตอบ|Admin ไม่ตอบ|แอดมินไม่ตอบ|ร้านไม่ตอบ|เพจก็ไม่มีการตอบ|ทักถาม.*ไม่ตอบ|ติดต่อไม่ได้|toko tidak balas|seller no reply|no response/i,
    category: '售后失联',
    grievanceZh: '联系客服无人回复/仅有机器人自动应答/保修推诿',
    impact: '买家报修遇阻极易演变为追加差评或向平台升级纠纷，需设立人工售后急诊通道'
  },

  // 9. 极端差劲体验与做工瑕疵
  {
    regex: /ไม่ดีเลย|ห่วยแตก|แย่มาก|ไม่ประทับใจ|คุณภาพแย่|คุณภาพก็พอใช้|พอใช้|งั้นๆ|เสียความรู้สึก|sangat buruk|very bad|terrible|มีกลิ่นเหม็น|งานหยาบ|มีเสี้ยน/i,
    category: '体验差劲',
    grievanceZh: '整体使用体验差/做工粗糙毛刺/品质平庸勉强/大失所望',
    impact: '产品实际性能与主图预期落差巨大，需重构产品定位并提升基础做工'
  }
];

// 转折词（表面夸赞/给高分，转折词后吐槽）
const TURN_PATTERNS = [
  /แต่ว่า|แต่|เสียดายมาก|เสียดาย|ติดตรงที่|ทว่า/i,
  /tapi|sayang sekali|namun|sayangnya/i,
  /nhưng|tiếc là|mỗi tội/i,
  /however|but|unfortunately|except/i,
  /但是|不过|可惜|就是|美中不足/i
];

/**
 * 隐性差评智能挖掘
 */
export function detectHiddenNegative(content: string, rating: number): HiddenNegativeCheck {
  // 1. 严格判断是否为纯打星无字评价（彻底杜绝无字评价被提取负反馈痛点的自相矛盾）
  if (isWordlessReview(content)) {
    if (rating >= 4) {
      return {
        isHiddenNegative: false,
        severity: 'low',
        realSentiment: 'positive',
        surfaceRating: rating,
        extractedGrievances: [], // 严格为空，绝不提取负反馈
        primaryCategory: '纯打星无字好评',
        businessImpact: '系统默认打星/无字好评，买家未留文字，无产品客诉隐患'
      };
    } else if (rating <= 2) {
      return {
        isHiddenNegative: false,
        severity: 'medium',
        realSentiment: 'negative',
        surfaceRating: rating,
        extractedGrievances: ['纯打星低星差评（买家未留具体文字）'],
        primaryCategory: '纯打星差评',
        businessImpact: '买家直接给低星且未留文字，建议客服主动发送关怀卡了解履约问题'
      };
    } else {
      return {
        isHiddenNegative: false,
        severity: 'low',
        realSentiment: 'neutral',
        surfaceRating: rating,
        extractedGrievances: [],
        primaryCategory: '纯打星中立',
        businessImpact: '3星中立打分，买家未留文字'
      };
    }
  }

  const isHighRating = rating >= 4;
  const isNeutralRating = rating === 3;

  // 纯好评排除词（无转折的高频赞美）
  const purePositiveRegex = /ชุดมือจับอเนกประสงค์.*ติดตั้งง่าย|ใช้งานง่ายควบคุมได้สะดวก.*ตัดได้แม่นยำ|คุ้มค่าคุ้มราคามาก|ส่งไวมากแพ็คดีมาก/i;
  const hasPurePositive = purePositiveRegex.test(content) && !TURN_PATTERNS.some(p => p.test(content));

  if (isHighRating && hasPurePositive) {
    return {
      isHiddenNegative: false,
      severity: 'low',
      realSentiment: 'positive',
      surfaceRating: rating,
      extractedGrievances: [],
      primaryCategory: '综合赞赏',
      businessImpact: '好评无明显隐患，可作为标杆提炼优势卖点'
    };
  }

  // 检测是否命中痛点
  const matchedGrievances: string[] = [];
  let primaryCat = '';
  let primaryImpact = '';

  for (const trigger of COMPLAINT_TRIGGERS) {
    if (trigger.condition && !trigger.condition(content)) {
      continue;
    }
    if (trigger.regex.test(content)) {
      matchedGrievances.push(trigger.grievanceZh);
      if (!primaryCat) {
        primaryCat = trigger.category;
        primaryImpact = trigger.impact;
      }
    }
  }

  const hasTurnPattern = TURN_PATTERNS.some(p => p.test(content));

  // 判定是否属于隐性差评
  if (isHighRating && matchedGrievances.length > 0) {
    return {
      isHiddenNegative: true,
      severity: matchedGrievances.length >= 2 ? 'high' : 'medium',
      realSentiment: 'negative',
      surfaceRating: rating,
      extractedGrievances: matchedGrievances,
      primaryCategory: primaryCat || '隐性缺陷',
      businessImpact: primaryImpact || '买家表面打高分但正文投诉核心痛点，具有强烈麻痹性，需立即排查同批次品控并主动售后关怀。'
    };
  }

  // 正常低星显性差评 (1-2星)
  if (rating <= 2) {
    return {
      isHiddenNegative: false,
      severity: 'high',
      realSentiment: 'negative',
      surfaceRating: rating,
      extractedGrievances: matchedGrievances.length > 0 ? matchedGrievances : ['买家给出显性低星差评，对产品或履约极度不满'],
      primaryCategory: primaryCat || '严重客诉',
      businessImpact: primaryImpact || '显性差评直接拉低Listing整体权重与转化率，建议客服主动跟进补偿或召回。'
    };
  }

  // 3星中立
  if (isNeutralRating) {
    return {
      isHiddenNegative: false,
      severity: 'medium',
      realSentiment: 'neutral',
      surfaceRating: rating,
      extractedGrievances: matchedGrievances,
      primaryCategory: primaryCat || '中立观望',
      businessImpact: '中立观望评价，买家无明显惊喜感，建议优化性价比或开箱体验。'
    };
  }

  // 4-5星真实正向
  return {
    isHiddenNegative: false,
    severity: 'low',
    realSentiment: 'positive',
    surfaceRating: rating,
    extractedGrievances: [],
    primaryCategory: '好评认可',
    businessImpact: '正面好评无客诉隐患，可提炼为 Listing 五点描述及主图核心宣传卖点。'
  };
}

/**
 * 提取核心主题与关键词根
 */
export function extractTopicsAndKeywords(content: string, rating: number): { topics: string[]; keyPhrases: string[] } {
  if (isWordlessReview(content)) {
    return {
      topics: [rating >= 4 ? '默认好评' : (rating <= 2 ? '低星打分' : '中立打分')],
      keyPhrases: []
    };
  }

  const topics: string[] = [];
  const keyPhrases: string[] = [];

  // 工具五金
  if (/แบต|ชาร์จ|baterai|battery|bms/i.test(content)) {
    topics.push('电池续航');
    keyPhrases.push('电池性能');
  }
  if (/โซ่|เลื่อย|ตัด|rantai|saw|chain/i.test(content)) {
    topics.push('机械做工');
    keyPhrases.push('链条导板');
  }
  if (/น้ำหนักเบา|ถือได้ง่าย|ringan|lightweight/i.test(content)) {
    topics.push('握持手感');
    keyPhrases.push('轻巧便携');
  }
  if (/มือจับ|ประตู|ล็อค|door|handle|lock/i.test(content)) {
    topics.push('材质做工');
    keyPhrases.push('安装门锁');
  }

  // 物流包装
  if (/ส่งไว|ส่งเร็ว|ส่งช้า|cepat|giao nhanh|slow|fast/i.test(content)) {
    topics.push('物流时效');
  }
  if (/กล่อง|แพ็ค|ห่อ|packing|box|rusak/i.test(content)) {
    topics.push('包装防护');
  }

  // 性价比与客服
  if (/คุ้มค่า|คุ้มราคา|murah|worth|value/i.test(content)) {
    topics.push('性价比');
    keyPhrases.push('物有所值');
  }
  if (/แอดมิน|บริการ|service|seller/i.test(content)) {
    topics.push('客服沟通');
  }

  if (topics.length === 0) {
    topics.push(rating >= 4 ? '整体好评' : (rating <= 2 ? '质量反馈' : '常规使用'));
  }

  return {
    topics: Array.from(new Set(topics)),
    keyPhrases: Array.from(new Set(keyPhrases))
  };
}
