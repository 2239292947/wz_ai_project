import { readFileContent } from './src/lib/file-reader';
import { executeParse, ordersToFlatRows } from './src/lib/parser-engine';
import * as fs from 'fs';

(async () => {
  const buffer = fs.readFileSync('C:/Users/Administrator/Desktop/AIK/demos/黔寨寨贵州烙锅（鞍山店）常温.pdf');
  const rawData = await readFileContent(buffer, 'test.pdf', '');
  const result = executeParse(rawData, {
    fileType: 'pdf',
    sheets: 'all' as const,
    dataRegion: { mode: 'tabular' as const, headerRow: 7, dataStartRow: 8, dataEndMarker: '合计' },
    fieldMappings: [
      { targetField: 'skuCode', source: 'column_index', value: 2 },
      { targetField: 'skuName', source: 'column_index', value: 3 },
      { targetField: 'quantity', source: 'column_index', value: 6 },
      { targetField: 'spec', source: 'column_index', value: 4 },
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
  console.log('Orders:', result.orders.length, '| FlatRows:', flatRows.length);
  if (flatRows.length > 0) {
    console.log('First:', JSON.stringify(flatRows[0]));
    console.log('Last:', JSON.stringify(flatRows[flatRows.length - 1]));
  }
})();
