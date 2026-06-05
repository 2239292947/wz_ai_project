import OpenAI from 'openai';
import type { ParseRuleConfig } from '@/types';

// AI-assisted rule generation
export async function generateRuleWithAI(
  filePreview: string,
  fileName: string
): Promise<{ rule: ParseRuleConfig; confidence: Record<string, string> }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!apiKey || apiKey === 'sk-your-api-key-here') {
    throw new Error('请先配置 OPENAI_API_KEY 环境变量');
  }

  const client = new OpenAI({ apiKey, baseURL });

  const prompt = `你是一个专业的数据解析规则生成器。你的任务是分析文件结构，生成一个通用的解析规则(ParseRuleConfig)，用于将该文件解析为物流出库单数据。

## 目标字段定义

每条出库单根据"外部编码"聚合，同一个外部编码下的多个SKU行共享一组收货信息：

| 字段名 | 说明 | 必填 |
|--------|------|------|
| externalCode | 外部系统订单唯一编号(如配送单号) | 否 |
| storeName | 收货门店 | A组/B组二选一 |
| receiverName | 收件人姓名 | B组 |
| receiverPhone | 收件人电话 | B组 |
| receiverAddress | 收件人地址 | B组 |
| skuCode | SKU物品编码 | 是 |
| skuName | SKU物品名称 | 是 |
| quantity | SKU发货数量(必须为正数) | 是 |
| spec | SKU规格型号 | 否 |
| remark | 备注 | 否 |

## 解析规则格式

请生成如下JSON格式的解析规则：

\`\`\`typescript
interface ParseRuleConfig {
  fileType: 'excel' | 'word' | 'pdf';
  sheets: 'all' | string[];  // Excel sheet选择
  dataRegion: {
    mode: 'tabular' | 'card' | 'text';  // 解析模式
    headerRow?: number;     // 表头行号(0-indexed)
    dataStartRow?: number;  // 数据起始行
    dataEndMarker?: string; // 数据结束标记(如"合计")
    skipRows?: number[];    // 需跳过的行
    cardStartPattern?: string;  // 卡片模式起始标记
    recordSeparator?: string;   // 文本模式记录分隔符
  };
  fieldMappings: {
    targetField: string;     // 目标字段名(使用上面的标准字段名)
    source: 'column_header' | 'column_index' | 'tail_label' | 'card_header_label' | 'static' | 'regex_group' | 'matrix_column_header';
    value: string | number;  // 列标题/索引/标签/正则/静态值
    groupIndex?: number;     // 正则分组索引
    confidence?: 'high' | 'medium' | 'low';  // AI推测置信度
  }[];
  tailExtraction?: {
    fields: {
      label: string;         // 查找的标签文本(如"收货人"、"联系电话")
      targetField: string;   // 映射到哪个目标字段
      valueOffset?: number;  // 值相对标签的列偏移(默认1)
    }[];
  };
  transformations?: {
    type: 'aggregate' | 'matrix_transpose' | 'compound_split' | 'double_transpose';
    config: Record<string, any>;
  }[];
  staticValues?: Record<string, string>;  // 所有记录的静态值
}
\`\`\`

## 解析模式说明

1. **tabular** - 标准表格模式，有明确的表头行和数据行
   - 适用于: 标准表格文件，含干扰头部、散落尾部信息、跨行聚合等
   - 收货人信息可能在数据区之外的尾部区域，需用tailExtraction提取
   - 同一配送单号下多行物品共享收货人信息(如湖南仓)，引擎会自动按externalCode聚合

2. **card** - 卡片模式，每条记录是独立的"卡片"区域
   - 适用于: 门店调拨单等非标准表格
   - 通过cardStartPattern识别卡片起始(如"▶ 调拨记录")
   - 每个卡片有独立的收货信息区域和物品小表
   - 卡片内的收货信息使用card_header_label映射，物品表使用column_header映射

3. **text** - 文本模式，从纯文本中提取数据
   - 适用于: Word文档等纯文本格式
   - 通过recordSeparator分隔记录，用regex_group提取字段

## 特殊结构处理

- **矩阵转置**: 门店名作为列头横向排列(如欢乐牧场模板)，需设置matrix_transpose转换
  - config示例: { fixedColumns: [{sourceLabel:"SKU名称",targetField:"skuName"}], transposeStartCol: 13, transposeHeaderTarget: "storeName", transposeValueTarget: "quantity" }

- **尾部信息提取**: 收货人/电话/地址在数据区之外的底部行
  - tailExtraction示例: { fields: [{label:"收货人",targetField:"receiverName"},{label:"收货电话",targetField:"receiverPhone"},{label:"收货地址",targetField:"receiverAddress"}] }

- **多Sheet合并**: 每个Sheet是独立门店的出库单，设置sheets为"all"
  - 每个Sheet可能都有自己的tailExtraction信息

- **跨行聚合**: 同一配送单号下多行物品共享收货人信息(如湖南仓)，由引擎自动按externalCode聚合

- **卡片式堆叠**: 每条记录是独立卡片区域(如门店调拨单)
  - 使用card模式，cardStartPattern匹配"▶ 调拨记录"等标记
  - 卡片内收货信息用card_header_label映射: {targetField:"storeName", source:"card_header_label", value:"调入门店"}

## 重要注意事项

- fieldMappings中每个targetField必须使用上面定义的标准字段名(如externalCode, storeName等)
- headerRow和dataStartRow是0-indexed行号
- 对于PDF文件，解析器会将PDF各页转为文本行，需要用tabular模式处理
- 对于有多Sheet的Excel，设置sheets为"all"以遍历所有Sheet
- 不要硬编码任何文件名或特定列名，规则应该是通用的
- 对于你不确定的映射，设置confidence为"low"或"medium"

## 文件信息

文件名: ${fileName}

文件内容预览:
${filePreview}

---

请分析以上文件结构，生成适合的ParseRuleConfig。只输出JSON，不要其他文字。确保fieldMappings中每个targetField使用上面定义的标准字段名。对于你不确定的映射，设置confidence为"low"。`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: '你是一个专业的数据解析专家，擅长分析各种文件格式并生成结构化的解析规则。只输出JSON格式。' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content || '';
  let rule: ParseRuleConfig;

  try {
    rule = JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      rule = JSON.parse(jsonMatch[1].trim());
    } else {
      throw new Error('AI生成的规则格式无效，请手动配置');
    }
  }

  // Extract confidence info
  const confidence: Record<string, string> = {};
  if (rule.fieldMappings) {
    for (const mapping of rule.fieldMappings) {
      if (mapping.confidence && mapping.confidence !== 'high') {
        confidence[mapping.targetField] = `AI推测(置信度: ${mapping.confidence === 'medium' ? '中' : '低'})`;
      }
    }
  }

  return { rule, confidence };
}
