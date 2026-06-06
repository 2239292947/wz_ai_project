import { readFileContent } from './src/lib/file-reader';
import { executeParse, ordersToFlatRows } from './src/lib/parser-engine';
import * as fs from 'fs';

async function testPdf() {
  const buffer = fs.readFileSync('C:/Users/Administrator/Desktop/AIK/demos/黔寨寨贵州烙锅（鞍山店）常温.pdf');
  const rawData = await readFileContent(buffer, 'test.pdf', '');

  const sheets = Object.keys(rawData);
  console.log('Sheets:', sheets);
  const rows = rawData[sheets[0]];
  console.log('Total rows:', rows.length);
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const nonEmpty = rows[i].filter((c: string) => c !== '');
    if (nonEmpty.length > 0) console.log('Row', i, ':', JSON.stringify(rows[i].slice(0, 10)));
  }
  console.log('--- Last 10 ---');
  for (let i = Math.max(0, rows.length - 10); i < rows.length; i++) {
    const nonEmpty = rows[i].filter((c: string) => c !== '');
    if (nonEmpty.length > 0) console.log('Row', i, ':', JSON.stringify(rows[i].slice(0, 10)));
  }

  // Now test parsing
  const rule = {
    fileType: 'pdf' as const, sheets: 'all' as const,
    dataRegion: { mode: 'tabular' as const, headerRow: 7, dataStartRow: 8, dataEndMarker: '合计' },
    fieldMappings: [
      { targetField: 'skuCode', source: 'column_index', value: 1 },
      { targetField: 'skuName', source: 'column_index', value: 2 },
      { targetField: 'spec', source: 'column_index', value: 3 },
      { targetField: 'quantity', source: 'column_index', value: 5 },
    ],
    tailExtraction: {
      fields: [
        { label: '收货人', targetField: 'receiverName', valueOffset: 1 },
        { label: '收货电话', targetField: 'receiverPhone', valueOffset: 1 },
        { label: '收货地址', targetField: 'receiverAddress', valueOffset: 1 },
      ],
    },
    staticValues: { storeName: '黔寨寨贵州烙锅（鞍山首店）' },
  };
  const result = executeParse(rawData, rule);
  const flatRows = ordersToFlatRows(result.orders);
  console.log('\n=== Parse result ===');
  console.log('Total orders:', result.orders.length);
  console.log('Total flatRows:', flatRows.length);
  // Check for bad data
  flatRows.forEach((r: any, i: number) => {
    if (!r.skuCode || !r.skuName || r.quantity === 0) {
      console.log('BAD row', i, ':', JSON.stringify(r));
    }
  });
}

testPdf().catch(console.error);
