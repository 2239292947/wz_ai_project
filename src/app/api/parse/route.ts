import { NextRequest, NextResponse } from 'next/server';
import { readFileContent } from '@/lib/file-reader';
import { executeParse, ordersToFlatRows } from '@/lib/parser-engine';
import type { ParseRuleConfig } from '@/types';

// POST /api/parse - parse a file with a given rule
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const ruleJson = formData.get('rule') as string;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传文件' },
        { status: 400 }
      );
    }

    if (!ruleJson) {
      return NextResponse.json(
        { success: false, error: '请选择解析规则' },
        { status: 400 }
      );
    }

    let rule: ParseRuleConfig;
    try {
      rule = JSON.parse(ruleJson);
    } catch {
      return NextResponse.json(
        { success: false, error: '规则格式无效' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawData = await readFileContent(buffer, file.name, file.type);

    const result = executeParse(rawData, rule);
    const flatRows = ordersToFlatRows(result.orders);

    return NextResponse.json({
      success: true,
      data: {
        orders: result.orders,
        flatRows,
        errors: result.errors,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '解析文件失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
