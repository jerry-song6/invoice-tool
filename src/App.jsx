// App.js
import React from "react";
import InvoiceOCR from "./InvoiceOCR";
import "./App.css";

function App() {
  return (
    <div className="App">
      <InvoiceOCR />
    </div>
  );
}

export default App;
// import { useMemo, useRef, useState } from 'react'
// import './App.css'
// import * as XLSX from 'xlsx'
// import { createWorker } from 'tesseract.js'
// import { parseInvoiceText, buildExcelRows } from './invoiceParser.js'

// function App() {
//   const [files, setFiles] = useState([])
//   const [results, setResults] = useState([])
//   const [processing, setProcessing] = useState(false)
//   const [progress, setProgress] = useState(0)
//   const [logs, setLogs] = useState([])
//   const workerRef = useRef(null)

//   const canExport = useMemo(() => results.length > 0, [results])

//   const ensureWorker = async () => {
//     if (workerRef.current) return workerRef.current
//     const worker = await createWorker({
//       langPath: '/tesseract/lang-data',
//       cachePath: 'tesseract-cache',
//       corePath: '/tesseract/tesseract-core.wasm.js',
//       workerPath: '/tesseract/worker.min.js',
//     })
//     await worker.load()
//     await worker.loadLanguage('chi_sim')
//     await worker.initialize('chi_sim')
//     workerRef.current = worker
//     return worker
//   }

//   const handleFiles = (e) => {
//     const picked = Array.from(e.target.files || [])
//     setFiles(picked)
//     setResults([])
//     setLogs([])
//   }

//   const recognizeAll = async () => {
//     if (!files.length) return
//     setProcessing(true)
//     setResults([])
//     const worker = await ensureWorker()

//     const nextLogs = []
//     const recognized = []

//     for (let i = 0; i < files.length; i++) {
//       const f = files[i]
//       nextLogs.push(`开始识别: ${f.name}`)
//       setLogs([...nextLogs])
//       try {
//         const img = await readFileAsDataURL(f)
//         const { data } = await worker.recognize(
//           img,
//           undefined,
//           {
//             logger: m => {
//               if (m.status === 'recognizing text' && m.progress != null) {
//                 setProgress(m.progress)
//               }
//             }
//           }
//         )
//         const text = data.text || ''
//         const parsed = parseInvoiceText(text)
//         recognized.push({
//           name: f.name,
//           text,
//           parsed,
//         })
//         nextLogs.push(`完成: ${f.name}`)
//         setLogs([...nextLogs])
//       } catch (err) {
//         nextLogs.push(`失败: ${f.name} -> ${err?.message || err}`)
//         setLogs([...nextLogs])
//       }
//     }
//     setResults(recognized)
//     setProcessing(false)
//   }

//   const readFileAsDataURL = (file) => {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader()
//       reader.onload = () => resolve(reader.result)
//       reader.onerror = reject
//       reader.readAsDataURL(file)
//     })
//   }

//   const exportExcel = () => {
//     const rows = buildExcelRows(results.map(r => r.parsed))
//     const wb = XLSX.utils.book_new()
//     const ws = XLSX.utils.json_to_sheet(rows)
//     XLSX.utils.book_append_sheet(wb, ws, '发票汇总')
//     XLSX.writeFile(wb, `发票汇总_${Date.now()}.xlsx`)
//   }

//   return (
//     <div>
//       <h1>发票识别与汇总工具</h1>

//       <div className="card">
//         <input
//           type="file"
//           accept="image/*,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.pdf"
//           multiple
//           onChange={handleFiles}
//         />
//         <div style={{ marginTop: 12 }}>
//           <button onClick={recognizeAll} disabled={processing || !files.length}>
//             {processing ? `识别中 ${(progress * 100).toFixed(0)}%` : '开始识别'}
//           </button>
//           <button onClick={exportExcel} disabled={!canExport} style={{ marginLeft: 8 }}>
//             导出 Excel
//           </button>
//         </div>
//       </div>

//       <div style={{ textAlign: 'left', marginTop: 24 }}>
//         <h2>结果</h2>
//         <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//           <thead>
//             <tr>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>文件名</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>发票代码</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>发票号码</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>开票日期</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>购方名称</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>销方名称</th>
//               <th style={{ borderBottom: '1px solid #444', textAlign: 'left' }}>价税合计</th>
//             </tr>
//           </thead>
//           <tbody>
//             {results.map((r, idx) => (
//               <tr key={idx}>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.name}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.invoiceCode}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.invoiceNumber}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.date}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.buyerName}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.sellerName}</td>
//                 <td style={{ borderBottom: '1px solid #333', padding: '6px 4px' }}>{r.parsed.total}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>

//       <div style={{ textAlign: 'left', marginTop: 24 }}>
//         <h2>日志</h2>
//         <pre style={{ whiteSpace: 'pre-wrap' }}>{logs.join('\n')}</pre>
//       </div>
//     </div>
//   )
// }

// export default App
