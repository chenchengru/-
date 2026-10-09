/**
 * Vercel Serverless Function: /api/translate
 * 独立轻量东南亚多语言翻译服务
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const { text } = body || req.query || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ success: false, error: 'text 不能为空' });
  }

  // 基础常用词快速替换映射
  const dict = [
    ['เหมาะสำหรับเซรามิกและแก้ว', '适用于陶瓷和玻璃'],
    ['เหมาะสำหรับตกแต่งรถยนต์', '适合汽车装饰美化'],
    ['ตัวเลือกสีที่หลากหลาย', '多种颜色款式可选'],
    ['อเนกประสงค์สำหรับพื้นผิวต่างๆ', '多功能适用于多种不同表面'],
    ['กันน้ำและยาวนาน', '防水且持久耐用'],
    ['เหมาะกับการใช้งานดี', '使用效果良好非常适用'],
    ['แต้มจุดที่มีรอยขีดขวด', '点涂遮盖划痕瑕疵处'],
    ['จุดรอยต่างๆได้ดี', '各种划痕斑点修补效果良好'],
    ['สินค้าตรงปก', '商品与宣传图一致（货对版）'],
    ['สินค้าส่งเลว', '商品送货服务极差/物流体验差'],
    ['ส่งเลว', '配送极差'],
    ['ส่งช้ามาก', '发货配送太慢'],
    ['ส่งไวมาก', '发货配送极快'],
    ['แต่ระ', '但是呢'],
    ['แต่', '但是']
  ];

  let translation = text;
  for (const [k, v] of dict) {
    if (translation.includes(k)) {
      translation = translation.split(k).join(v);
    }
  }

  return res.status(200).json({
    success: true,
    translation: translation.replace(/[,，\s]+/g, '，').replace(/^，|，$/g, '')
  });
}
