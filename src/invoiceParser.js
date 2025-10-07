// 简单中文发票文本解析器：基于常见关键词与正则提取关键字段
// 适配增值税发票等常见版式，OCR 可能存在空格/噪声，正则尽量宽松

const normalize = (text) => {
  if (!text) return '';
  return text
    .replace(/[\s\u00A0]+/g, ' ') // 折叠空白
    .replace(/[：:]/g, ':')
    .replace(/[，,]/g, ',')
    .trim();
};

export function parseInvoiceText(rawText) {
  const text = normalize(rawText);

  // 常见字段的多种写法关键词
  const patterns = {
    invoiceCode: /(发票代码)\s*[:：]?\s*([0-9]{10,12})/i,
    invoiceNumber: /(发票号码|发票编号)\s*[:：]?\s*([0-9]{6,12})/i,
    date: /(开票日期)\s*[:：]?\s*([0-9]{4}[年\/-][0-9]{1,2}[月\/-][0-9]{1,2}日?)/i,
    buyerName: /(购方名称|购买方|购买单位|购方)\s*[:：]?\s*([^\n\r]{3,40})/i,
    sellerName: /(销方名称|销售方|销售单位|销方)\s*[:：]?\s*([^\n\r]{3,40})/i,
    amount: /(合计金额|金额小写|金额)\s*[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    tax: /(税额|税金)\s*[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    total: /(价税合计[\(（]小写[\)）]?|价税合计|合计)\s*[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
    checkCode: /(校验码)\s*[:：]?\s*([0-9]{10,20})/i,
    machineCode: /(机器码)\s*[:：]?\s*([0-9A-Z]{8,})/i,
  };

  const result = {
    invoiceCode: '',
    invoiceNumber: '',
    date: '',
    buyerName: '',
    sellerName: '',
    amount: '',
    tax: '',
    total: '',
    checkCode: '',
    machineCode: '',
    raw: rawText || '',
  };

  const match = (key, groupIndex = 2) => {
    const m = text.match(patterns[key]);
    if (m) return normalize(m[groupIndex] || '');
    return '';
  };

  result.invoiceCode = match('invoiceCode');
  result.invoiceNumber = match('invoiceNumber');
  result.date = match('date');
  result.buyerName = match('buyerName');
  result.sellerName = match('sellerName');
  result.amount = match('amount');
  result.tax = match('tax');
  result.total = match('total');
  result.checkCode = match('checkCode');
  result.machineCode = match('machineCode');

  return result;
}

export function buildExcelRows(parsedList) {
  return parsedList.map((p, idx) => ({
    序号: idx + 1,
    发票代码: p.invoiceCode,
    发票号码: p.invoiceNumber,
    开票日期: p.date,
    购方名称: p.buyerName,
    销方名称: p.sellerName,
    合计金额: p.amount,
    税额: p.tax,
    价税合计: p.total,
    校验码: p.checkCode,
    机器码: p.machineCode,
  }));
}



