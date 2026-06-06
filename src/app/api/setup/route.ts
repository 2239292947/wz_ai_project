import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Pre-built parse rules
const SEED_RULES = [
  {
    name: '配送发货单（含尾部收货信息）',
    description: '适用于黎明屯等配送发货单，头部有干扰信息，数据区后合计行，尾部散落收货人/电话/地址',
    config: {
      fileType: 'excel',
      sheets: 'all',
      dataRegion: { mode: 'tabular', headerRow: 3, dataStartRow: 4, dataEndMarker: '合计' },
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
    },
  },
  {
    name: '汇总单发货明细（按配送单号聚合）',
    description: '适用于湖南仓等发货明细，每行含收货机构，按配送单号聚合多行物品',
    config: {
      fileType: 'excel',
      sheets: 'all',
      dataRegion: { mode: 'tabular', headerRow: 1, dataStartRow: 2 },
      fieldMappings: [
        { targetField: 'storeName', source: 'column_header', value: '收货机构' },
        { targetField: 'externalCode', source: 'column_header', value: '配送单号' },
        { targetField: 'skuCode', source: 'column_header', value: '物品编码' },
        { targetField: 'skuName', source: 'column_header', value: '物品名称' },
        { targetField: 'quantity', source: 'column_header', value: '发货数量' },
        { targetField: 'spec', source: 'column_header', value: '规格型号' },
        { targetField: 'receiverName', source: 'column_header', value: '收货人' },
        { targetField: 'receiverPhone', source: 'column_header', value: '收货电话' },
        { targetField: 'receiverAddress', source: 'column_header', value: '收货地址' },
      ],
    },
  },
  {
    name: '库存矩阵转置（SKU×门店）',
    description: '适用于欢乐牧场等模板，SKU为行、门店为列的矩阵格式，需转置为独立运单记录',
    config: {
      fileType: 'excel',
      sheets: 'all',
      dataRegion: { mode: 'tabular', headerRow: 0, dataStartRow: 1 },
      fieldMappings: [
        { targetField: 'skuName', source: 'column_header', value: 'SKU名称' },
        { targetField: 'skuCode', source: 'column_header', value: '外部商品编码' },
        { targetField: 'spec', source: 'column_header', value: '规格' },
      ],
      transformations: [
        {
          type: 'matrix_transpose',
          config: {
            fixedColumns: [
              { sourceLabel: 'SKU名称', targetField: 'skuName' },
              { sourceLabel: '外部商品编码', targetField: 'skuCode' },
              { sourceLabel: '规格', targetField: 'spec' },
            ],
            transposeStartCol: 13,
            transposeEndCol: 18,
            transposeHeaderTarget: 'storeName',
            transposeValueTarget: 'quantity',
            skipIfZero: true,
            skipIfEmpty: true,
          },
        },
      ],
    },
  },
  {
    name: 'PDF配送单（含收货人信息）',
    description: '适用于黔寨寨等PDF配送单，含头部元信息、标准表格、底部收货人签字区',
    config: {
      fileType: 'pdf',
      sheets: 'all',
      dataRegion: { mode: 'tabular', headerRow: 7, dataStartRow: 8, dataEndMarker: '合计' },
      fieldMappings: [
        { targetField: 'skuCode', source: 'column_index', value: 1 },
        { targetField: 'skuName', source: 'column_index', value: 2 },
        { targetField: 'spec', source: 'column_index', value: 3 },
        { targetField: 'quantity', source: 'column_index', value: 5 },
      ],
      tailExtraction: {
        fields: [
          { label: '收货人', targetField: 'receiverName' },
          { label: '收货电话', targetField: 'receiverPhone' },
          { label: '收货地址', targetField: 'receiverAddress' },
        ],
      },
      staticValues: { storeName: '黔寨寨贵州烙锅（鞍山首店）' },
    },
  },
  {
    name: '多门店分Sheet出库单',
    description: '适用于多Sheet出库单，每个Sheet是一个门店的独立出库单，底部有收货人信息',
    config: {
      fileType: 'excel',
      sheets: 'all',
      dataRegion: { mode: 'tabular', headerRow: 3, dataStartRow: 4, dataEndMarker: '合计' },
      fieldMappings: [
        { targetField: 'skuCode', source: 'column_header', value: '物品编码' },
        { targetField: 'skuName', source: 'column_header', value: '物品名称' },
        { targetField: 'quantity', source: 'column_header', value: '出库数量' },
        { targetField: 'spec', source: 'column_header', value: '规格型号' },
        { targetField: 'remark', source: 'column_header', value: '备注' },
      ],
      tailExtraction: {
        fields: [
          { label: '收货门店', targetField: 'storeName', valueOffset: 1 },
          { label: '联系人', targetField: 'receiverName', valueOffset: 1 },
          { label: '联系电话', targetField: 'receiverPhone', valueOffset: 1 },
          { label: '收货地址', targetField: 'receiverAddress', valueOffset: 1 },
        ],
      },
    },
  },
  {
    name: '门店调拨单（卡片式）',
    description: '适用于门店调拨单，每条调拨记录是独立卡片区域，含收货信息和物品小表',
    config: {
      fileType: 'excel',
      sheets: 'all',
      dataRegion: { mode: 'card', cardStartPattern: '▶' },
      fieldMappings: [
        { targetField: 'storeName', source: 'card_header_label', value: '调入门店' },
        { targetField: 'receiverName', source: 'card_header_label', value: '收货人' },
        { targetField: 'receiverPhone', source: 'card_header_label', value: '电话' },
        { targetField: 'receiverAddress', source: 'card_header_label', value: '收货地址' },
        { targetField: 'skuCode', source: 'column_header', value: '物品编码' },
        { targetField: 'skuName', source: 'column_header', value: '物品名称' },
        { targetField: 'quantity', source: 'column_header', value: '数量' },
        { targetField: 'spec', source: 'column_header', value: '规格' },
      ],
    },
  },
];

// GET /api/setup - Check database status
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const ruleCount = await prisma.parseRule.count();
    const orderCount = await prisma.order.count();

    return NextResponse.json({
      success: true,
      message: 'Database connected successfully',
      tables: { rules: ruleCount, orders: orderCount },
      databaseUrl: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'connected'}`
        : 'NOT SET',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('Database setup error:', error);

    return NextResponse.json({
      success: false,
      error: message,
      stack: stack?.split('\n').slice(0, 5),
      databaseUrl: process.env.DATABASE_URL
        ? `Set (${process.env.DATABASE_URL.substring(0, 30)}...)`
        : 'NOT SET - Please configure DATABASE_URL in Vercel Environment Variables',
    }, { status: 500 });
  }
}

// POST /api/setup - Seed parse rules into database
export async function POST() {
  try {
    const results: { name: string; action: string }[] = [];

    for (const rule of SEED_RULES) {
      const existing = await prisma.parseRule.findFirst({
        where: { name: rule.name },
      });

      if (existing) {
        await prisma.parseRule.update({
          where: { id: existing.id },
          data: { description: rule.description, config: rule.config },
        });
        results.push({ name: rule.name, action: 'updated' });
      } else {
        await prisma.parseRule.create({
          data: { name: rule.name, description: rule.description, config: rule.config },
        });
        results.push({ name: rule.name, action: 'created' });
      }
    }

    const ruleCount = await prisma.parseRule.count();

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} rules, total: ${ruleCount}`,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed error:', error);

    return NextResponse.json({
      success: false,
      error: message,
      databaseUrl: process.env.DATABASE_URL
        ? `Set (${process.env.DATABASE_URL.substring(0, 30)}...)`
        : 'NOT SET',
    }, { status: 500 });
  }
}
