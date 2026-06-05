import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/orders - list orders with pagination and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const externalCode = searchParams.get('externalCode') || '';

    const where: Record<string, unknown> = {};

    if (search || externalCode) {
      where.OR = [
        ...(search ? [
          { receiverName: { contains: search } },
          { storeName: { contains: search } },
        ] : []),
        ...(externalCode ? [
          { externalCode: { contains: externalCode } },
        ] : []),
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { orders, total, page, pageSize },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/orders - submit orders (batch create)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orders } = body as {
      orders: {
        externalCode?: string;
        storeName?: string;
        receiverName?: string;
        receiverPhone?: string;
        receiverAddress?: string;
        items: {
          skuCode: string;
          skuName: string;
          quantity: number;
          spec?: string;
          remark?: string;
        }[];
      }[];
    };

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可提交的订单数据' },
        { status: 400 }
      );
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
        await prisma.order.create({
          data: {
            externalCode: order.externalCode,
            storeName: order.storeName,
            receiverName: order.receiverName,
            receiverPhone: order.receiverPhone,
            receiverAddress: order.receiverAddress,
            batchId,
            status: 'submitted',
            items: {
              create: order.items.map(item => ({
                skuCode: item.skuCode,
                skuName: item.skuName,
                quantity: item.quantity,
                spec: item.spec,
                remark: item.remark,
              })),
            },
          },
        });
        successCount++;
      } catch (e) {
        failCount++;
        errors.push(`订单 ${order.externalCode || '(无编码)'} 提交失败`);
      }
    }

    return NextResponse.json({
      success: true,
      data: { batchId, successCount, failCount, errors },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '提交订单失败' },
      { status: 500 }
    );
  }
}
