import * as XLSX from 'xlsx';
import type { ParseRuleConfig } from '@/types';

// Read file and return raw 2D data organized by sheet
export async function readFileContent(
  buffer: Buffer,
  fileName: string,
  fileType: string
): Promise<Record<string, string[][]>> {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    return readExcel(buffer);
  } else if (ext === 'docx' || ext === 'doc') {
    return readWord(buffer);
  } else if (ext === 'pdf') {
    return readPdf(buffer);
  }

  throw new Error(`不支持的文件格式: ${ext}`);
}

async function readExcel(buffer: Buffer): Promise<Record<string, string[][]>> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const result: Record<string, string[][]> = {};

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: '',
      raw: false,
    });
    result[sheetName] = data.map(row =>
      row.map(cell => (cell === null || cell === undefined ? '' : String(cell)))
    );
  }

  return result;
}

async function readWord(buffer: Buffer): Promise<Record<string, string[][]>> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  const lines = result.value.split('\n');
  const rows = lines.map(line => {
    const cells = line.includes('\t') ? line.split('\t') : [line];
    return cells.map(c => c.trim());
  }).filter(row => row.some(c => c !== ''));

  return { 'default': rows };
}

async function readPdf(buffer: Buffer): Promise<Record<string, string[][]>> {
  try {
    const pdf2jsonModule = await import('pdf2json');
    const PDFParserClass = (pdf2jsonModule as any).default || pdf2jsonModule;
    const pdfParser = new (PDFParserClass as any)(null, 1);

    return new Promise<Record<string, string[][]>>((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        const allRows: string[][] = [];
        let headerXPositions: number[] = [];

        for (let p = 0; p < pdfData.Pages.length; p++) {
          const page = pdfData.Pages[p];
          // Collect all text items with their positions
          const textItems: { x: number; y: number; text: string }[] = [];
          for (const text of page.Texts) {
            const content = decodeURIComponent(
              text.R.map((r: any) => r.T).join('')
            ).trim();
            if (!content) continue;
            textItems.push({ x: text.x, y: text.y, text: content });
          }

          // Group by Y position to form rows
          const rowMap = new Map<number, { x: number; text: string }[]>();
          for (const item of textItems) {
            const yKey = Math.round(item.y * 2) / 2;
            if (!rowMap.has(yKey)) rowMap.set(yKey, []);
            rowMap.get(yKey)!.push({ x: item.x, text: item.text });
          }

          const sortedYs = Array.from(rowMap.keys()).sort((a, b) => a - b);
          const pageRows: string[][] = [];

          for (const y of sortedYs) {
            const cells = rowMap.get(y)!;
            cells.sort((a, b) => a.x - b.x);

            if (headerXPositions.length > 0) {
              // Use header column X positions to align cells into columns
              const columns: string[] = new Array(headerXPositions.length).fill('');
              for (const cell of cells) {
                let bestCol = 0;
                let bestDist = Infinity;
                for (let c = 0; c < headerXPositions.length; c++) {
                  const dist = Math.abs(cell.x - headerXPositions[c]);
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestCol = c;
                  }
                }
                if (bestDist < 8) {
                  columns[bestCol] = columns[bestCol]
                    ? columns[bestCol] + ' ' + cell.text
                    : cell.text;
                } else {
                  // New column beyond header - append
                  columns.push(cell.text);
                }
              }
              if (columns.some(c => c !== '')) {
                pageRows.push(columns);
              }
            } else {
              // No header yet - just separate cells into individual columns
              const columns = cells.map(c => c.text);
              if (columns.length > 0) {
                pageRows.push(columns);
              }
            }
          }

          // Find header row and capture its X positions
          for (let ri = 0; ri < pageRows.length; ri++) {
            const row = pageRows[ri];
            const joinedRow = row.join(' ');
            const isHeaderRow = (
              (joinedRow.includes('物品编码') && joinedRow.includes('物品名称')) ||
              (joinedRow.includes('物品类别') && joinedRow.includes('物品编码'))
            );

            if (isHeaderRow && headerXPositions.length === 0) {
              // Get the Y position for this header row
              const yKey = sortedYs[ri];
              const headerCells = rowMap.get(yKey) || [];
              headerCells.sort((a: any, b: any) => a.x - b.x);
              headerXPositions = headerCells.map((c: any) => c.x);

              // Re-process pageRows with header alignment
              pageRows.length = 0;
              // Re-process all rows for this page with alignment
              for (const y2 of sortedYs) {
                const rowCells = rowMap.get(y2)!;
                rowCells.sort((a, b) => a.x - b.x);
                const columns: string[] = new Array(headerXPositions.length).fill('');
                for (const cell of rowCells) {
                  let bestCol = 0;
                  let bestDist = Infinity;
                  for (let c = 0; c < headerXPositions.length; c++) {
                    const dist = Math.abs(cell.x - headerXPositions[c]);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestCol = c;
                    }
                  }
                  if (bestDist < 8) {
                    columns[bestCol] = columns[bestCol]
                      ? columns[bestCol] + ' ' + cell.text
                      : cell.text;
                  } else {
                    columns.push(cell.text);
                  }
                }
                if (columns.some(c => c !== '')) {
                  pageRows.push(columns);
                }
              }
              break;
            }
          }

          // Process page rows
          for (const row of pageRows) {
            const joinedRow = row.join(' ');
            const isHeaderRow = (
              (joinedRow.includes('物品编码') && joinedRow.includes('物品名称')) ||
              (joinedRow.includes('物品类别') && joinedRow.includes('物品编码'))
            );

            // Skip duplicate headers on page 2+
            if (isHeaderRow && allRows.some(r => r.join(' ').includes('物品编码'))) {
              continue;
            }

            const firstCell = (row[0] || '').toString().trim();
            // Skip summary/total rows
            if (firstCell.includes('合计') || firstCell === '合' || firstCell === '计') continue;
            if (firstCell.includes('制单日期') || firstCell.includes('打印次数')) continue;
            if (firstCell.includes('收货人签字')) continue;
            if (firstCell.includes('第') && firstCell.includes('页') && firstCell.includes('共')) continue;
            // Skip empty rows
            const nonEmpty = row.filter(c => c.trim() !== '');
            if (nonEmpty.length === 0) continue;

            allRows.push(row);
          }
        }

        // Move tail info rows (收货人/收货电话/收货地址) to the bottom
        const tailRows: string[][] = [];
        const dataRows: string[][] = [];
        let tailStarted = false;

        for (const row of allRows) {
          const joinedRow = row.join(' ');
          if (joinedRow.includes('收货人') || joinedRow.includes('收货电话') ||
              joinedRow.includes('收货地址') || joinedRow.includes('备注：')) {
            tailStarted = true;
          }
          if (tailStarted) {
            tailRows.push(row);
          } else {
            dataRows.push(row);
          }
        }

        const finalRows = [...dataRows, ...tailRows];
        resolve({ 'default': finalRows });
      });

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(`PDF解析失败: ${errData?.parserError?.message || '未知错误'}`));
      });

      pdfParser.parseBuffer(Buffer.from(buffer));
    });
  } catch (error) {
    throw new Error(`PDF解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get a preview of the file structure for AI analysis
export function getFilePreview(rawData: Record<string, string[][]>, maxRows: number = 40): string {
  const previews: string[] = [];

  for (const [sheetName, rows] of Object.entries(rawData)) {
    previews.push(`=== Sheet: ${sheetName} (共${rows.length}行) ===`);
    const displayRows = rows.slice(0, maxRows);
    for (let i = 0; i < displayRows.length; i++) {
      const row = displayRows[i];
      const nonEmpty = row.filter(c => c !== '');
      if (nonEmpty.length > 0) {
        previews.push(`Row ${i}: ${JSON.stringify(row.slice(0, 30))}`);
      }
    }
    // Also show last 10 rows for tail info
    if (rows.length > maxRows) {
      previews.push(`... (middle rows omitted)`);
      for (let i = Math.max(maxRows, rows.length - 10); i < rows.length; i++) {
        const row = rows[i];
        const nonEmpty = row.filter(c => c !== '');
        if (nonEmpty.length > 0) {
          previews.push(`Row ${i}: ${JSON.stringify(row.slice(0, 30))}`);
        }
      }
    }
    previews.push('');
  }

  return previews.join('\n');
}
