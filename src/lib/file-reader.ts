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
    // Use pdf2json which works in Node.js without DOMMatrix
    const pdf2jsonModule = await import('pdf2json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParserClass = (pdf2jsonModule as any).default || pdf2jsonModule;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParser = new (PDFParserClass as any)(null, 1);

    return new Promise<Record<string, string[][]>>((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        // Merge all pages into a single sheet for easier parsing
        const allRows: string[][] = [];
        let headerFound = false;
        let headerRowIndex = -1;
        const headerColumns: string[] = [];

        for (let p = 0; p < pdfData.Pages.length; p++) {
          const page = pdfData.Pages[p];
          // Group texts by Y position to reconstruct rows
          const rowMap = new Map<number, { x: number; text: string }[]>();

          for (const text of page.Texts) {
            const yKey = Math.round(text.y * 2) / 2; // round to 0.5
            const content = decodeURIComponent(
              text.R.map((r: any) => r.T).join('')
            ).trim();
            if (!content) continue;

            if (!rowMap.has(yKey)) {
              rowMap.set(yKey, []);
            }
            rowMap.get(yKey)!.push({ x: text.x, text: content });
          }

          // Sort by Y, then within each row sort by X
          const sortedYs = Array.from(rowMap.keys()).sort((a, b) => a - b);
          const pageRows: string[][] = [];

          for (const y of sortedYs) {
            const cells = rowMap.get(y)!;
            cells.sort((a, b) => a.x - b.x);

            // Group cells into columns based on X position gaps
            const columns: string[] = [];
            let currentCol = '';
            let lastEndX = -1;

            for (let ci = 0; ci < cells.length; ci++) {
              const cell = cells[ci];
              const prevEndX = lastEndX;
              const gap = prevEndX >= 0 ? cell.x - prevEndX : 999;

              if (gap > 1.5) {
                if (currentCol) columns.push(currentCol);
                currentCol = cell.text;
              } else {
                currentCol += (gap > 0.3 ? ' ' : '') + cell.text;
              }

              lastEndX = cell.x + cell.text.length * 0.28;
            }
            if (currentCol) columns.push(currentCol);

            if (columns.length > 0) {
              pageRows.push(columns);
            }
          }

          // Check if this page has a table header
          for (const row of pageRows) {
            const joinedRow = row.join(' ');
            // Detect table header patterns for logistics documents
            const isHeaderRow = (
              (joinedRow.includes('物品编码') && joinedRow.includes('物品名称')) ||
              (joinedRow.includes('物品类别') && joinedRow.includes('物品编码'))
            );

            if (isHeaderRow && !headerFound) {
              headerFound = true;
              headerRowIndex = allRows.length;
              // Build header columns from this row
              for (const cell of row) {
                headerColumns.push(cell);
              }
              allRows.push(row);
            } else if (!headerFound) {
              // Before header found, add as info rows
              allRows.push(row);
            } else {
              // After header - these are data rows
              // Skip "合计" rows and footer info
              const firstCell = (row[0] || '').toString().trim();
              if (firstCell.includes('合计') || firstCell.includes('制单日期')) continue;
              if (firstCell.includes('收货人签字') || firstCell.includes('打印次数')) continue;

              // Try to align data row with header columns using X positions
              // For now, just add as-is and rely on the header row for mapping
              allRows.push(row);
            }
          }
        }

        // Add tail info rows at the bottom
        const tailRows: string[][] = [];
        for (let i = allRows.length - 1; i >= 0; i--) {
          const row = allRows[i];
          const joinedRow = (row || []).join(' ');
          if (joinedRow.includes('收货人') || joinedRow.includes('收货电话') ||
              joinedRow.includes('收货地址') || joinedRow.includes('备注')) {
            tailRows.unshift(row);
            allRows.splice(i, 1);
          } else {
            break;
          }
        }
        allRows.push(...tailRows);

        resolve({ 'default': allRows });
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
