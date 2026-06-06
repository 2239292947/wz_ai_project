const { readFileContent, executeParse, ordersToFlatRows } = require('./src/lib/parser-engine');
const fs = require('fs');

async function testParse(filePath, ruleConfig, label) {
  const buffer = fs.readFileSync(filePath);
  const fileName = filePath.split('/').pop();
  try {
    const rawData = await readFileContent(buffer, fileName, '');
    const result = executeParse(rawData, ruleConfig);
    const flatRows = ordersToFlatRows(result.orders);
    console.log('=== ' + label + ' ===');
    console.log('Orders:', result.orders.length, '| FlatRows:', flatRows.length);
    console.log('Errors:', JSON.stringify(result.errors));
    if (flatRows.length > 0) console.log('Sample:', JSON.stringify(flatRows[0]));
  } catch(e) {
    console.error('ERROR for ' + label + ':', e.message);
  }
}

(async () => {
  await testParse('C:/Users/Administrator/Desktop/AIK/demos/12.25海口龙湖天街-配送发货单PS2512220005001(1).xlsx', { fileType:'excel',sheets:'all',dataRegion:{mode:'tabular',headerRow:3,dataStartRow:4,dataEndMarker:'合计'},fieldMappings:[{targetField:'skuCode',source:'column_header',value:'物品编码'},{targetField:'skuName',source:'column_header',value:'物品名称'},{targetField:'quantity',source:'column_header',value:'发货数量'},{targetField:'spec',source:'column_header',value:'规格型号'}],tailExtraction:{fields:[{label:'收货人',targetField:'receiverName',valueOffset:1},{label:'收货电话',targetField:'receiverPhone',valueOffset:1},{label:'收货地址',targetField:'receiverAddress',valueOffset:1}]}}, '黎明屯');
  await testParse('C:/Users/Administrator/Desktop/AIK/demos/湖南仓.xlsx', { fileType:'excel',sheets:'all',dataRegion:{mode:'tabular',headerRow:1,dataStartRow:2},fieldMappings:[{targetField:'storeName',source:'column_header',value:'收货机构'},{targetField:'externalCode',source:'column_header',value:'配送单号'},{targetField:'skuCode',source:'column_header',value:'物品编码'},{targetField:'skuName',source:'column_header',value:'物品名称'},{targetField:'quantity',source:'column_header',value:'发货数量'},{targetField:'spec',source:'column_header',value:'规格型号'}]}, '湖南仓');
  await testParse('C:/Users/Administrator/Desktop/AIK/demos/多门店分Sheet出库单.xlsx', { fileType:'excel',sheets:'all',dataRegion:{mode:'tabular',headerRow:3,dataStartRow:4,dataEndMarker:'合计'},fieldMappings:[{targetField:'skuCode',source:'column_header',value:'物品编码'},{targetField:'skuName',source:'column_header',value:'物品名称'},{targetField:'quantity',source:'column_header',value:'出库数量'},{targetField:'spec',source:'column_header',value:'规格型号'}],tailExtraction:{fields:[{label:'收货门店',targetField:'storeName',valueOffset:1},{label:'联系人',targetField:'receiverName',valueOffset:1},{label:'联系电话',targetField:'receiverPhone',valueOffset:1},{label:'收货地址',targetField:'receiverAddress',valueOffset:1}]}}, '多门店');
  await testParse('C:/Users/Administrator/Desktop/AIK/demos/门店调拨单-卡片式.xlsx', { fileType:'excel',sheets:'all',dataRegion:{mode:'card',cardStartPattern:'▶'},fieldMappings:[{targetField:'storeName',source:'card_header_label',value:'调入门店'},{targetField:'receiverName',source:'card_header_label',value:'收货人'},{targetField:'receiverPhone',source:'card_header_label',value:'电话'},{targetField:'receiverAddress',source:'card_header_label',value:'收货地址'},{targetField:'skuCode',source:'column_header',value:'物品编码'},{targetField:'skuName',source:'column_header',value:'物品名称'},{targetField:'quantity',source:'column_header',value:'数量'},{targetField:'spec',source:'column_header',value:'规格'}]}, '卡片式');
  await testParse('C:/Users/Administrator/Desktop/AIK/demos/欢乐牧场模板0430.xlsx', { fileType:'excel',sheets:'all',dataRegion:{mode:'tabular',headerRow:0,dataStartRow:1},fieldMappings:[{targetField:'skuName',source:'column_header',value:'SKU名称'},{targetField:'skuCode',source:'column_header',value:'外部商品编码'},{targetField:'spec',source:'column_header',value:'规格'}],transformations:[{type:'matrix_transpose',config:{fixedColumns:[{sourceLabel:'SKU名称',targetField:'skuName'},{sourceLabel:'外部商品编码',targetField:'skuCode'},{sourceLabel:'规格',targetField:'spec'}],transposeStartCol:13,transposeEndCol:18,transposeHeaderTarget:'storeName',transposeValueTarget:'quantity',skipIfZero:true,skipIfEmpty:true}}]}, '欢乐牧场');
})();
