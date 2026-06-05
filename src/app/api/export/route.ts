import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// POST /api/export - export data as Excel file
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { rows: Record<string, unknown>[] };
    const { rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可导出的数据' },
        { status: 400 }
      );
    }

    const exportRows = rows.map((row: Record<string, unknown>, index: number) => ({
      '序号': index + 1,
      '外部编码': row.externalCode || '',
      '收货门店': row.storeName || '',
      '收件人姓名': row.receiverName || '',
      '收件人电话': row.receiverPhone || '',
      '收件人地址': row.receiverAddress || '',
      'SKU物品编码': row.skuCode || '',
      'SKU物品名称': row.skuName || '',
      'SKU发货数量': row.quantity || 0,
      'SKU规格型号': row.spec || '',
      '备注': row.remark || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, '出库单数据');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export_${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '导出失败' },
      { status: 500 }
    );
  }
}
