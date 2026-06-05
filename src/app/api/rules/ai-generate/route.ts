import { NextRequest, NextResponse } from 'next/server';
import { generateRuleWithAI } from '@/lib/ai';
import { readFileContent, getFilePreview } from '@/lib/file-reader';

// POST /api/rules/ai-generate - AI generates a parse rule from uploaded file
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传文件' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawData = await readFileContent(buffer, file.name, file.type);
    const preview = getFilePreview(rawData);

    const { rule, confidence } = await generateRuleWithAI(preview, file.name);

    return NextResponse.json({
      success: true,
      data: { rule, confidence },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI生成规则失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
