import React, { useState, useRef } from "react";
import { createWorker } from "tesseract.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import * as pdfjsLib from "pdfjs-dist";

// 配置pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const InvoiceOCR = () => {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  // 处理文件选择
  const handleFileSelect = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  // 直接从PDF提取文本
  const extractTextFromPDF = async (pdfFile) => {
    try {
      console.log("开始提取PDF文本:", pdfFile.name);

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";

        // 更新进度
        const pageProgress = (pageNum / pdf.numPages) * 100;
        setProgress(Math.round(pageProgress));
      }

      // console.log("PDF文本提取完成:", fullText+ "...");
      return fullText;
    } catch (error) {
      console.error("PDF文本提取失败:", error);
      throw error;
    }
  };

  // 处理图像文件的OCR - 增强识别精度
  const processImageWithOCR = async (imageFile) => {
    try {
      const worker = await createWorker("chi_sim+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // 设置基本的OCR参数，避免复杂参数导致崩溃
      await worker.setParameters({
        tessedit_pageseg_mode: "6", // 统一文本块
        preserve_interword_spaces: "1", // 保留单词间空格
      });

      const result = await worker.recognize(imageFile);

      await worker.terminate();

      console.log("OCR原始结果:", result.data.text);
      return result.data.text;
    } catch (error) {
      console.error("图像OCR失败:", error);
      // 如果OCR失败，尝试使用更简单的配置
      try {
        console.log("尝试使用简化OCR配置...");
        const simpleWorker = await createWorker("chi_sim+eng");
        const simpleResult = await simpleWorker.recognize(imageFile);
        await simpleWorker.terminate();
        console.log("简化OCR结果:", simpleResult.data.text);
        return simpleResult.data.text;
      } catch (fallbackError) {
        console.error("简化OCR也失败:", fallbackError);
        throw error; // 抛出原始错误
      }
    }
  };

  // 智能发票信息提取（适配交通运输业电子普通发票新版样式，增强OCR容错）
  const extractInvoiceInfo = (text) => {
    console.log("提取发票信息:", text);
    if (!text) return getEmptyInvoiceInfo();

    const info = getEmptyInvoiceInfo();

    try {
      // 清理文本：移除多余空格和换行，但保留关键结构
      const cleanText = text.replace(/\s+/g, " ").trim();

      // 发票号码 - 增强OCR容错，支持各种空格和分隔符
      const invoiceNumberMatches = [
        cleanText.match(/发票号码[：:\s]*([0-9]{8,24})/),
        cleanText.match(/发票号[：:\s]*([0-9]{8,24})/),
        cleanText.match(/号码[：:\s]*([0-9]{8,24})/),
        cleanText.match(/([0-9]{8,24})/), // 兜底：直接匹配长数字
      ].filter(Boolean);
      if (invoiceNumberMatches.length > 0)
        info.invoiceNumber = invoiceNumberMatches[0][1];

      // 发票代码
      const invoiceCodeMatch = cleanText.match(/发票代码[：:\s]*(\d{10,12})/);
      if (invoiceCodeMatch) {
        info.invoiceCode = invoiceCodeMatch[1];
      }

      // 开票日期 - 增强OCR容错，处理常见识别错误
      const dateMatches = [
        // 标准格式
        cleanText.match(/开票日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/),
        cleanText.match(/日期[：:\s]*(\d{4}年\d{1,2}月\d{1,2}日)/),
        cleanText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/),
        cleanText.match(/(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/), // 支持空格分隔
        // OCR错误容错：开票->开景，日->昌
        cleanText.match(
          /开[票景][日期][：:\s]*(\d{4}年\d{1,2}月\d{1,2}[日昌])/
        ),
        cleanText.match(
          /开[票景][日期][：:\s]*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日昌])/
        ),
        // 更宽泛的日期匹配
        cleanText.match(/(\d{4}年\d{1,2}月\d{1,2}[日昌])/),
        cleanText.match(/(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日昌])/),
      ].filter((match) => match);

      if (dateMatches.length > 0) {
        let dateStr = dateMatches[0][1];
        // 修复OCR错误：昌 -> 日
        dateStr = dateStr.replace(/昌$/, "日");
        info.date = dateStr;
        console.log("识别到开票日期:", info.date);
      }

      // 价税合计（小写）- 增强OCR容错，支持各种格式
      let totalMatch = cleanText.match(
        /价\s*税\s*合\s*计[（(]?\s*小\s*写\s*[）)]?[：:\s]*[¥￥]?\s*([-+]?\d+\.\d{2})/
      );
      if (!totalMatch)
        totalMatch = cleanText.match(
          /[（(]\s*小\s*写\s*[）)]\s*[：:\s]*[¥￥]?\s*([-+]?\d+\.\d{2})/
        );
      if (!totalMatch)
        totalMatch = cleanText.match(
          /小\s*写[^0-9\-]+([-+]?\d+\.\d{2})\s*[¥￥]?/
        );
      if (!totalMatch)
        totalMatch = cleanText.match(
          /\(小写\)[：:\s]*[¥￥]?\s*([-+]?\d+\.\d{2})/
        );
      if (!totalMatch)
        totalMatch = cleanText.match(/小写[：:\s]*[¥￥]?\s*([-+]?\d+\.\d{2})/);
      if (totalMatch) info.total = totalMatch[1];

      // "合计"行 - 增强OCR容错，支持各种空格和格式
      const sumLineMatches = [
        ...cleanText.matchAll(
          /合\s*计[\s:]*[-\s]*([-+]?\d+\.\d{2})\s*[¥￥]?\s+([-+]?\d+\.\d{2})\s*[¥￥]?/g
        ),
        ...cleanText.matchAll(
          /合计[：:\s]*([-+]?\d+\.\d{2})[¥￥]?\s+([-+]?\d+\.\d{2})[¥￥]?/g
        ),
        ...cleanText.matchAll(
          /合计[：:\s]*([-+]?\d+\.\d{2})\s+([-+]?\d+\.\d{2})/g
        ),
      ];
      if (sumLineMatches.length) {
        const last = sumLineMatches[sumLineMatches.length - 1];
        info.amount = last[1];
        info.tax = last[2];
      }

      // 若"合计"未命中，尝试从表格数据中提取
      if (!info.amount || !info.tax) {
        const amountMatches = [...cleanText.matchAll(/(\d+\.\d{2})/g)];
        const taxMatches = [
          ...cleanText.matchAll(/税额[：:\s]*[¥￥]?\s*(-?\d+\.\d{2})/g),
        ];

        if (amountMatches.length >= 2) {
          // 取最后两个金额，通常是合计金额
          const amounts = amountMatches.slice(-2);
          info.amount = amounts[0][1];
          info.tax = amounts[1][1];
        }

        if (taxMatches.length) {
          info.tax = taxMatches[taxMatches.length - 1][1];
        }
      }

      // 若缺少不含税金额且已有总额与税额，则计算不含税金额
      if (!info.amount && info.total && info.tax) {
        const val = (parseFloat(info.total) - parseFloat(info.tax)).toFixed(2);
        if (!Number.isNaN(Number(val))) info.amount = String(val);
      }

      // 购买方和销售方信息 - 增强OCR容错，多种匹配策略
      console.log("开始提取购买方和销售方信息...");

      // 策略1：成对提取（名称 + 税号）
      const nameTaxPairs = [
        ...cleanText.matchAll(
          /名称[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-—_ ]+?)(?=\s{1,}|\s{0,20}(统一社会信用代码\/纳税人识别号|纳税人识别号))/g
        ),
      ];
      const idMatches = [
        ...cleanText.matchAll(
          /(统一社会信用代码\/纳税人识别号|纳税人识别号)[：:\s]*([A-Za-z0-9]{15,30})/g
        ),
      ];

      console.log("成对提取结果:", {
        nameTaxPairs: nameTaxPairs.length,
        idMatches: idMatches.length,
      });

      if (nameTaxPairs.length >= 1 && idMatches.length >= 1) {
        info.buyer = nameTaxPairs[0][1].trim();
        info.buyerTaxId = idMatches[0][2];
        console.log("购买方信息:", {
          buyer: info.buyer,
          buyerTaxId: info.buyerTaxId,
        });
      }

      if (nameTaxPairs.length >= 2 && idMatches.length >= 2) {
        info.seller = nameTaxPairs[1][1].trim();
        info.sellerTaxId = idMatches[1][2];
        console.log("销售方信息:", {
          seller: info.seller,
          sellerTaxId: info.sellerTaxId,
        });
      }

      // 策略2：分别提取名称和税号（兜底）
      if (!info.buyer || !info.seller) {
        const allNames = [
          ...cleanText.matchAll(
            /名称[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-—_ ]+)/g
          ),
        ];
        console.log("所有名称匹配:", allNames);

        if (allNames.length >= 1 && !info.buyer) {
          info.buyer = allNames[0][1].trim();
          console.log("购买方名称(兜底):", info.buyer);
        }
        if (allNames.length >= 2 && !info.seller) {
          info.seller = allNames[1][1].trim();
          console.log("销售方名称(兜底):", info.seller);
        }
      }

      if (!info.buyerTaxId || !info.sellerTaxId) {
        const allIds = [
          ...cleanText.matchAll(
            /(统一社会信用代码\/纳税人识别号|纳税人识别号)[：:\s]*([A-Za-z0-9]{15,30})/g
          ),
        ].map((m) => m[2]);
        console.log("所有税号匹配:", allIds);

        if (!info.buyerTaxId && allIds[0]) {
          info.buyerTaxId = allIds[0];
          console.log("购买方税号(兜底):", info.buyerTaxId);
        }
        if (!info.sellerTaxId && allIds[1]) {
          info.sellerTaxId = allIds[1];
          console.log("销售方税号(兜底):", info.sellerTaxId);
        }
      }

      // 策略3：基于位置提取（购买方在左，销售方在右）
      if (!info.buyer || !info.seller) {
        const lines = cleanText.split(/\s+/);
        const nameIndex = lines.findIndex((line) => line.includes("名称"));
        if (nameIndex !== -1 && nameIndex + 1 < lines.length) {
          if (!info.buyer) {
            // 查找购买方名称（通常在"购买方"或"购"附近）
            const buyerContext = cleanText.match(
              /购[买方]*[^销]*?名称[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-—_ ]+)/
            );
            if (buyerContext) info.buyer = buyerContext[1].trim();
          }
          if (!info.seller) {
            // 查找销售方名称（通常在"销售方"或"销"附近）
            const sellerContext = cleanText.match(
              /销[售方]*[^购]*?名称[：:\s]*([\u4e00-\u9fa5A-Za-z0-9（）()·\-—_ ]+)/
            );
            if (sellerContext) info.seller = sellerContext[1].trim();
          }
        }
      }

      // 策略4：OCR错误修正
      if (info.seller) {
        // 修正常见的OCR识别错误
        info.seller = info.seller
          .replace(/泣清/g, "滴滴") // 泣清 -> 滴滴
          .replace(/泣/g, "滴") // 泣 -> 滴
          .replace(/清/g, "清") // 保持清字
          .trim();
        console.log("修正后的销售方名称:", info.seller);
      }

      if (info.buyer) {
        // 修正购买方名称的OCR错误
        info.buyer = info.buyer
          .replace(/国地/g, "国地") // 保持国地
          .replace(/规划/g, "规划") // 保持规划
          .trim();
        console.log("修正后的购买方名称:", info.buyer);
      }

      info.rawText = cleanText.substring(0, 1000); // 保存部分文本用于调试
    } catch (error) {
      console.error("解析发票信息时出错:", error);
    }

    console.log("解析结果:", info);
    return info;
  };

  const getEmptyInvoiceInfo = () => ({
    invoiceNumber: "",
    invoiceCode: "",
    date: "",
    amount: "",
    tax: "",
    total: "",
    seller: "",
    buyer: "",
    buyerTaxId: "",
    sellerTaxId: "",
    rawText: "",
  });

  // 处理所有文件
  const processFiles = async () => {
    if (!files.length) return;

    setLoading(true);
    setProgress(0);
    const newResults = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let text = "";

        try {
          if (file.type === "application/pdf") {
            // PDF文件 - 直接提取文本
            text = await extractTextFromPDF(file);
          } else if (file.type.startsWith("image/")) {
            // 图像文件 - 使用OCR
            text = await processImageWithOCR(file);
          } else {
            throw new Error(`不支持的文件类型: ${file.type}`);
          }

          const invoiceInfo = extractInvoiceInfo(text);

          newResults.push({
            fileName: file.name,
            fileType: file.type,
            ...invoiceInfo,
            processed: true,
          });
        } catch (error) {
          console.error(`处理文件 ${file.name} 失败:`, error);
          newResults.push({
            fileName: file.name,
            fileType: file.type,
            ...getEmptyInvoiceInfo(),
            error: error.message,
            processed: false,
          });
        }

        // 更新总体进度
        const overallProgress = ((i + 1) / files.length) * 100;
        setProgress(Math.round(overallProgress));
      }

      setResults(newResults);
    } catch (error) {
      console.error("处理文件时出错:", error);
      alert("处理失败: " + error.message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  // 导出到Excel
  const exportToExcel = () => {
    if (!results.length) return;

    try {
      const worksheetData = results.map((result, index) => ({
        // 序号: index + 1,
        文件名: result.fileName,
        文件类型: result.fileType,
        // 发票代码: result.invoiceCode,
        发票号码: result.invoiceNumber,
        开票日期: result.date,
        不含税合计: result.amount,
        税额合计: result.tax,
        价税合计: result.total,
        购买方: result.buyer,
        购买方税号: result.buyerTaxId,
        销售方: result.seller,
        销售方税号: result.sellerTaxId,
        处理状态: result.processed ? "成功" : "失败",
        错误信息: result.error || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(worksheetData);

      const colWidths = [
        { wch: 8 },
        { wch: 25 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 30 },
        { wch: 20 },
        { wch: 30 },
        { wch: 20 },
        { wch: 10 },
        { wch: 30 },
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "发票数据");
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      saveAs(
        blob,
        `发票数据汇总_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch (error) {
      console.error("导出Excel错误:", error);
      alert("导出失败: " + error.message);
    }
  };

  const reset = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <h1
        style={{
          color: "#2c3e50",
          marginBottom: "10px",
          fontSize: "28px",
          fontWeight: "700",
        }}
      >
        🧾 智能发票识别与数据汇总工具
      </h1>

      {/* 使用说明卡片 */}
      <div
        style={{
          backgroundColor: "#e8f4fd",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "25px",
          border: "1px solid #b6d7f9",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        }}
      >
        <h4
          style={{
            color: "#2c80ff",
            margin: "0 0 10px 0",
            fontSize: "16px",
          }}
        >
          📄 使用说明
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "10px",
            fontSize: "14px",
            color: "#495057",
          }}
        >
          <div>
            • <strong>PDF文件</strong>: 直接提取文本，速度快
          </div>
          <div>
            • <strong>图像文件</strong>: 使用OCR技术识别
          </div>
          <div>
            • <strong>支持格式</strong>: PDF, JPG, PNG, BMP
          </div>
          <div>
            • <strong>处理状态</strong>: 绿色=成功，红色=失败
          </div>
        </div>
      </div>

      {/* 操作区域卡片 */}
      <div
        style={{
          backgroundColor: "#fff",
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "25px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {/* 文件上传 */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#495057",
            }}
          >
            选择发票文件:
          </label>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept=".pdf,image/*"
            onChange={handleFileSelect}
            style={{
              marginBottom: "10px",
              padding: "8px",
              border: "1px solid #ced4da",
              borderRadius: "4px",
              width: "100%",
              maxWidth: "400px",
            }}
          />
          <div style={{ fontSize: "13px", color: "#6c757d" }}>
            支持PDF和图像文件，可多选
          </div>
        </div>

        {/* 按钮组 */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={processFiles}
            disabled={loading || !files.length}
            style={{
              padding: "10px 20px",
              backgroundColor: loading ? "#6c757d" : "#2c80ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              if (!loading && files.length) {
                e.target.style.backgroundColor = "#1a6fd8";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && files.length) {
                e.target.style.backgroundColor = "#2c80ff";
              }
            }}
          >
            {loading ? `🔄 处理中... ${progress}%` : "🚀 开始识别"}
          </button>

          <button
            onClick={exportToExcel}
            disabled={!results.length}
            style={{
              padding: "10px 20px",
              backgroundColor: results.length ? "#28a745" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: results.length ? "pointer" : "not-allowed",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              if (results.length) {
                e.target.style.backgroundColor = "#218838";
              }
            }}
            onMouseOut={(e) => {
              if (results.length) {
                e.target.style.backgroundColor = "#28a745";
              }
            }}
          >
            📊 导出Excel
          </button>

          <button
            onClick={reset}
            disabled={loading}
            style={{
              padding: "10px 20px",
              backgroundColor: loading ? "#6c757d" : "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
          >
            🗑️ 重置
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      {files.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #e0e0e0",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px 0",
              fontSize: "16px",
              color: "#495057",
            }}
          >
            已选择文件 ({files.length})
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              maxHeight: "120px",
              overflowY: "auto",
            }}
          >
            {files.map((file, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#f8f9fa",
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  border: "1px solid #dee2e6",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span
                  style={{
                    backgroundColor:
                      file.type === "application/pdf" ? "#dc3545" : "#17a2b8",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  {file.type === "application/pdf" ? "P" : "I"}
                </span>
                {file.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 结果表格 */}
      {results.length > 0 && (
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px",
            borderRadius: "10px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                color: "#2c3e50",
                fontWeight: "600",
              }}
            >
              识别结果 ({results.length})
            </h3>
            <div
              style={{
                fontSize: "14px",
                color: "#6c757d",
                display: "flex",
                gap: "15px",
              }}
            >
              <span>
                成功:{" "}
                <strong style={{ color: "#28a745" }}>
                  {results.filter((r) => !r.error).length}
                </strong>
              </span>
              <span>
                失败:{" "}
                <strong style={{ color: "#dc3545" }}>
                  {results.filter((r) => r.error).length}
                </strong>
              </span>
            </div>
          </div>

          <ResultsTable results={results} />

          {/* 表格使用提示 */}
          <div
            style={{
              marginTop: "10px",
              fontSize: "12px",
              color: "#6c757d",
              textAlign: "center",
            }}
          >
            💡 提示: 表格支持水平滚动，悬停行可高亮显示
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            backgroundColor: "#2c80ff",
            color: "white",
            padding: "10px 15px",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <div
            className="spinner"
            style={{
              width: "20px",
              height: "20px",
              border: "2px solid transparent",
              borderTop: "2px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          正在处理文件，请稍候...
        </div>
      )}
    </div>
  );
};
export default InvoiceOCR;
// 在组件中添加这些样式
const tableStyles = {
  container: {
    maxHeight: '600px',
    overflow: 'auto',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    marginTop: '20px',
    backgroundColor: '#fff'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    minWidth: '1200px' // 确保表格有最小宽度，避免挤压
  },
  header: {
    position: 'sticky',
    top: 0,
    backgroundColor: '#2c80ff',
    color: 'white',
    fontWeight: '600',
    zIndex: 10
  },
  headerCell: {
    padding: '12px 8px',
    border: '1px solid #e0e0e0',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    minWidth: '80px'
  },
  cell: {
    padding: '10px 8px',
    border: '1px solid #f0f0f0',
    textAlign: 'left',
    verticalAlign: 'top'
  },
  row: {
    backgroundColor: '#fff',
    transition: 'background-color 0.2s ease'
  },
  rowEven: {
    backgroundColor: '#f8f9fa'
  },
  rowHover: {
    backgroundColor: '#e3f2fd'
  },
  statusSuccess: {
    color: '#28a745',
    fontWeight: '600'
  },
  statusError: {
    color: '#dc3545',
    fontWeight: '600'
  },
  fileType: {
    backgroundColor: '#e9ecef',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#495057'
  }
};

// 优化的结果表格组件
const ResultsTable = ({ results }) => {
  const [hoveredRow, setHoveredRow] = useState(null);

  if (!results.length) return null;

  return (
    <div style={tableStyles.container}>
      <table style={tableStyles.table}>
        <thead style={tableStyles.header}>
          <tr>
            {/* <th style={{...tableStyles.headerCell, width: '40px'}}>序号</th> */}
            <th style={{...tableStyles.headerCell, width: '200px'}}>文件名</th>
            <th style={{...tableStyles.headerCell, width: '80px'}}>类型</th>
            <th style={{...tableStyles.headerCell, width: '120px'}}>发票号码</th>
            <th style={{...tableStyles.headerCell, width: '100px'}}>开票日期</th>
            <th style={{...tableStyles.headerCell, width: '100px'}}>金额</th>
            <th style={{...tableStyles.headerCell, width: '80px'}}>税额</th>
            <th style={{...tableStyles.headerCell, width: '100px'}}>价税合计</th>
            <th style={{...tableStyles.headerCell, width: '200px'}}>购买方</th>
            <th style={{...tableStyles.headerCell, width: '150px'}}>销售方</th>
            <th style={{...tableStyles.headerCell, width: '80px'}}>状态</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr 
              key={index}
              style={{
                ...tableStyles.row,
                ...(index % 2 === 0 ? tableStyles.rowEven : {}),
                ...(hoveredRow === index ? tableStyles.rowHover : {})
              }}
              onMouseEnter={() => setHoveredRow(index)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* <td style={tableStyles.cell}>{index + 1}</td> */}
              <td style={tableStyles.cell}>
                <div style={{ 
                  maxWidth: '180px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {result.fileName}
                </div>
              </td>
              <td style={tableStyles.cell}>
                <span style={tableStyles.fileType}>
                  {result.fileType === 'application/pdf' ? 'PDF' : 
                   result.fileType.startsWith('image/') ? '图片' : '其他'}
                </span>
              </td>
              <td style={tableStyles.cell}>
                <div style={{ 
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}>
                  {result.invoiceNumber || '-'}
                </div>
              </td>
              <td style={tableStyles.cell}>{result.date || '-'}</td>
              <td style={tableStyles.cell}>
                {result.amount ? (
                  <span style={{ color: '#198754', fontWeight: '500' }}>
                    ¥{result.amount}
                  </span>
                ) : '-'}
              </td>
              <td style={tableStyles.cell}>
                {result.tax ? (
                  <span style={{ color: '#fd7e14', fontWeight: '500' }}>
                    ¥{result.tax}
                  </span>
                ) : '-'}
              </td>
              <td style={tableStyles.cell}>
                {result.total ? (
                  <span style={{ color: '#dc3545', fontWeight: '600' }}>
                    ¥{result.total}
                  </span>
                ) : '-'}
              </td>
              <td style={tableStyles.cell}>
                <div style={{ 
                  maxWidth: '180px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '13px'
                }}>
                  {result.buyer || '-'}
                </div>
              </td>
              <td style={tableStyles.cell}>
                <div style={{ 
                  maxWidth: '180px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '13px'
                }}>
                  {result.seller || '-'}
                </div>
              </td>
              <td style={tableStyles.cell}>
                {result.error ? (
                  <span style={tableStyles.statusError}>失败</span>
                ) : (
                  <span style={tableStyles.statusSuccess}>成功</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};