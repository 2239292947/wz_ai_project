import { readFileContent } from './src/lib/file-reader';
import { executeParse, ordersToFlatRows } from './src/lib/parser-engine';
import * as fs from 'fs';

(async () => {
  const buffer = fs.readFileSync('C:/Users/Administrator/Desktop/AIK/demos/黔寨寨贵州烙锅（鞍山店）常温.pdf');
  const rawData = await readFileContent(buffer, '黔寨寨贵州烙锅（鞍山店）常温.pdf', '');

  // Show raw data structure
  console.log('Raw sheets:', Object.keys(rawData));
  const sheetData = rawData['default'];
  console.log('Total rows:', sheetData.length);

  // Show first 5 rows
  for (let i = 0; i < Math.min(10, sheetData.length); i++) {
    const nonEmpty = sheetData[i].filter((c: string) => c !== '');
    if (nonEmpty.length > 0) console.log('Row ' + i + ':', JSON.stringify(sheetData[i].slice(0, 8)));
  }

  // Show last 5 rows
  console.log('--- Last rows ---');
  for (let i = Math.max(0, sheetData.length - 5); i < sheetData.length; i++) {
    const nonEmpty = sheetData[i].filter((c: string) => c !== '');
    if (nonEmpty.length > 0) console.log('Row ' + i + ':', JSON.stringify(sheetData[i].slice(0, 8)));
  }

  const result = executeParse(rawData, {
    fileType: 'pdf',
    sheets: 'all' as const,
    dataRegion: { mode: 'tabular' as const, headerRow: 0, dataStartRow: 1, dataEndMarker: '合计' },
    fieldMappings: [
      { targetField: 'skuCode', source: 'column_header', value: '物品编码' },
      { targetField: 'skuName', source: 'column_header', value: '物品名称' },
      { targetField: 'quantity', source: 'column_header', value: '发货数量' },
      { targetField: 'spec', source: 'column_header', value: '规格型号' },
    ],
    tailExtraction: {
      fields: [
        { label: '收货人', targetField: 'receiverName', valueOffset: 1 },
        { label: '收货电话', targetField: 'receiverPhone', valueOffset: 1 },
        { label: '收货地址', targetField: 'receiverAddress', valueOffset: 1 },
      ],
    },
    staticValues: { storeName: '黔寨寨贵州烙锅（鞍山首店）' },
  });
  const flatRows = ordersToFlatRows(result.orders);
  console.log('\nParse result:');
  console.log('Orders:', result.orders.length, '| FlatRows:', flatRows.length);
  console.log('Errors:', result.errors);
  if (flatRows.length > 0) {
    console.log('First:', JSON.stringify(flatRows[0]));
    console.log('Last:', JSON.stringify(flatRows[flatRows.length - 1]));
  }
})();
