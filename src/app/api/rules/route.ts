import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/rules - list all rules
export async function GET() {
  try {
    const rules = await prisma.parseRule.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取规则列表失败';
    console.error('GET /api/rules error:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// POST /api/rules - create a rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, config } = body;

    if (!name || !config) {
      return NextResponse.json(
        { success: false, error: '规则名称和配置不能为空' },
        { status: 400 }
      );
    }

    const rule = await prisma.parseRule.create({
      data: { name, description: description || '', config },
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '创建规则失败' },
      { status: 500 }
    );
  }
}

// PUT /api/rules - update a rule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, config } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '规则ID不能为空' },
        { status: 400 }
      );
    }

    const rule = await prisma.parseRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config }),
      },
    });

    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '更新规则失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/rules - delete a rule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '规则ID不能为空' },
        { status: 400 }
      );
    }

    await prisma.parseRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '删除规则失败' },
      { status: 500 }
    );
  }
}
