import type { ParseRuleConfig, OrderRecord, OrderItemRecord, ParseResult, FlatOrderRow, FieldMapping, TailExtractionConfig } from '@/types';

/**
 * Core parsing engine - executes a ParseRuleConfig against raw file data
 * to produce structured OrderRecord[]
 */

export function executeParse(
  rawData: Record<string, string[][]>,
  rule: ParseRuleConfig
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const orders: OrderRecord[] = [];

  const sheetNames = rule.sheets === 'all'
    ? Object.keys(rawData)
    : Array.isArray(rule.sheets)
    ? rule.sheets.filter(s => rawData[s])
    : Object.keys(rawData);

  for (const sheetName of sheetNames) {
    const rows = rawData[sheetName];
    if (!rows || rows.length === 0) {
      warnings.push(`Sheet "${sheetName}" 为空`);
      continue;
    }

    try {
      const sheetOrders = parseSheet(rows, rule, sheetName);
      orders.push(...sheetOrders);
    } catch (e) {
      errors.push(`Sheet "${sheetName}" 解析失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { orders, errors, warnings };
}

function parseSheet(rows: string[][], rule: ParseRuleConfig, sheetName: string): OrderRecord[] {
  const mode = rule.dataRegion.mode;
  switch (mode) {
    case 'tabular':
      return parseTabular(rows, rule, sheetName);
    case 'card':
      return parseCard(rows, rule, sheetName);
    case 'text':
      return parseText(rows, rule, sheetName);
    default:
      throw new Error(`Unknown parse mode: ${mode}`);
  }
}

// Tabular mode
function parseTabular(rows: string[][], rule: ParseRuleConfig, sheetName: string): OrderRecord[] {
  const headerRow = rule.dataRegion.headerRow ?? 0;
  const dataStartRow = rule.dataRegion.dataStartRow ?? headerRow + 1;
  const dataEndMarker = rule.dataRegion.dataEndMarker;

  const headerCells = rows[headerRow] || [];
  const colIndexMap = buildColumnIndexMap(headerCells, rule.fieldMappings);

  // Find data end row
  let dataEndRow = rows.length;
  if (dataEndMarker) {
    for (let i = dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      // Check first cell or any cell for end marker
      for (let j = 0; j < Math.min(row.length, 3); j++) {
        const cellText = (row[j] || '').toString().trim();
        if (cellText.includes(dataEndMarker)) {
          dataEndRow = i;
          break;
        }
      }
      if (dataEndRow !== rows.length) break;
    }
  }

  // Check if this is a matrix transpose scenario
  const hasMatrixTranspose = rule.transformations?.some(t => t.type === 'matrix_transpose');
  if (hasMatrixTranspose) {
    return parseMatrixTranspose(rows, rule, headerCells, colIndexMap, sheetName);
  }

  // Extract data rows
  const dataRows: Record<string, string>[] = [];
  for (let i = dataStartRow; i < dataEndRow; i++) {
    if (!rows[i]) continue;
    if (rule.dataRegion.skipRows?.includes(i)) continue;

    // Skip empty rows
    const nonEmpty = rows[i].filter(c => c !== '' && c !== undefined && c !== null);
    if (nonEmpty.length === 0) continue;

    const row: Record<string, string> = {};
    if (rule.staticValues) {
      for (const [k, v] of Object.entries(rule.staticValues)) {
        row[k] = v;
      }
    }

    for (const mapping of rule.fieldMappings) {
      const value = extractColumnValue(rows[i], mapping, colIndexMap, headerCells);
      if (value !== undefined && value !== '') {
        row[mapping.targetField] = value;
      }
    }

    // Only add rows that have at least some data
    const hasData = Object.keys(row).some(k => row[k] && row[k] !== '');
    if (hasData) {
      // Skip rows that have no SKU code or name (fragment rows from PDF etc)
      if (!row.skuCode && !row.skuName) continue;
      // Skip rows where skuCode or skuName contains info markers (likely info rows, not data)
      if (row.skuCode && /[：:收发联电门仓备注]/.test(row.skuCode)) continue;
      if (row.skuName && /[：:收发联电门仓备注]/.test(row.skuName)) continue;
      dataRows.push(row);
    }
  }

  // Extract tail info
  if (rule.tailExtraction) {
    const tailData = extractTailInfo(rows, rule.tailExtraction);
    for (const row of dataRows) {
      for (const [k, v] of Object.entries(tailData)) {
        if (!row[k] || row[k] === '') {
          row[k] = v;
        }
      }
    }
  }

  // Apply transformations
  let processedRows = dataRows;
  if (rule.transformations) {
    for (const transform of rule.transformations) {
      processedRows = applyTransformation(processedRows, transform);
    }
  }

  return rowsToOrders(processedRows);
}

// Matrix transpose - for files like 欢乐牧场模板
function parseMatrixTranspose(
  rows: string[][],
  rule: ParseRuleConfig,
  headerCells: string[],
  colIndexMap: Map<string, number>,
  sheetName: string
): OrderRecord[] {
  const transform = rule.transformations!.find(t => t.type === 'matrix_transpose')!;
  const config = transform.config as {
    fixedColumns: { sourceLabel: string; targetField: string }[];
    transposeStartCol: number;
    transposeEndCol?: number;
    transposeHeaderTarget: string;
    transposeValueTarget: string;
    skipIfZero?: boolean;
    skipIfEmpty?: boolean;
  };

  const headerRow = rule.dataRegion.headerRow ?? 0;
  const dataStartRow = rule.dataRegion.dataStartRow ?? headerRow + 1;
  const dataEndRow = rows.length;
  const endCol = config.transposeEndCol ?? headerCells.length;

  const result: Record<string, string>[] = [];

  for (let i = dataStartRow; i < dataEndRow; i++) {
    const dataRow = rows[i];
    if (!dataRow) continue;

    // Get fixed column values
    const fixedValues: Record<string, string> = {};
    for (const fc of config.fixedColumns) {
      const idx = findColumnIndex(headerCells, fc.sourceLabel);
      if (idx !== undefined && dataRow[idx]) {
        fixedValues[fc.targetField] = dataRow[idx].toString().trim();
      }
    }

    // Also apply regular field mappings for non-matrix columns
    for (const mapping of rule.fieldMappings) {
      if (mapping.source === 'column_header' || mapping.source === 'column_index') {
        const value = extractColumnValue(dataRow, mapping, colIndexMap, headerCells);
        if (value !== undefined && value !== '') {
          fixedValues[mapping.targetField] = value;
        }
      }
    }

    // Apply static values
    if (rule.staticValues) {
      for (const [k, v] of Object.entries(rule.staticValues)) {
        fixedValues[k] = v;
      }
    }

    // Transpose matrix columns
    for (let col = config.transposeStartCol; col < endCol; col++) {
      const headerValue = headerCells[col]?.toString().trim();
      if (!headerValue || headerValue === '') continue;

      const cellValue = dataRow[col]?.toString().trim() || '';
      const numValue = parseFloat(cellValue);

      if (config.skipIfEmpty !== false && (!cellValue || cellValue === '')) continue;
      if (config.skipIfZero !== false && (numValue === 0 || isNaN(numValue))) continue;

      const newRow: Record<string, string> = { ...fixedValues };
      newRow[config.transposeHeaderTarget] = headerValue;
      newRow[config.transposeValueTarget] = cellValue;
      result.push(newRow);
    }
  }

  return rowsToOrders(result);
}

// Card mode
function parseCard(rows: string[][], rule: ParseRuleConfig, sheetName: string): OrderRecord[] {
  const cardStartPattern = rule.dataRegion.cardStartPattern || '▶';
  const orders: OrderRecord[] = [];

  let currentCardStart = -1;
  const cardRanges: { start: number; end: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const firstCell = (rows[i]?.[0] || '').toString().trim();
    try {
      if (firstCell.includes(cardStartPattern) || new RegExp(cardStartPattern).test(firstCell)) {
        if (currentCardStart >= 0) {
          cardRanges.push({ start: currentCardStart, end: i - 1 });
        }
        currentCardStart = i;
      }
    } catch {
      if (firstCell.includes(cardStartPattern)) {
        if (currentCardStart >= 0) {
          cardRanges.push({ start: currentCardStart, end: i - 1 });
        }
        currentCardStart = i;
      }
    }
  }
  if (currentCardStart >= 0) {
    cardRanges.push({ start: currentCardStart, end: rows.length - 1 });
  }

  for (const range of cardRanges) {
    const cardHeaderMappings = rule.fieldMappings.filter(m => m.source === 'card_header_label');
    const cardItemMappings = rule.fieldMappings.filter(m => m.source === 'column_header' || m.source === 'column_index');

    const cardInfo: Record<string, string> = {};
    if (rule.staticValues) {
      for (const [k, v] of Object.entries(rule.staticValues)) {
        cardInfo[k] = v;
      }
    }

    for (const mapping of cardHeaderMappings) {
      const value = findCardHeaderValue(rows, range, mapping.value.toString());
      if (value) cardInfo[mapping.targetField] = value;
    }

    // Find item table within card
    let itemHeaderRow = -1;
    for (let i = range.start + 1; i <= range.end; i++) {
      const row = rows[i];
      if (!row) continue;
      const hasItemHeader = cardItemMappings.some(m => {
        if (m.source === 'column_header') {
          return row.some(cell => matchesHeader((cell || '').toString().trim(), m.value.toString()));
        }
        return false;
      });
      if (hasItemHeader) {
        itemHeaderRow = i;
        break;
      }
    }

    const items: OrderItemRecord[] = [];
    if (itemHeaderRow >= 0) {
      const headerCells = rows[itemHeaderRow] || [];
      const colIdxMap = buildColumnIndexMap(headerCells, cardItemMappings);
      // Build a set of header cell values for skip detection
      const headerValues = new Set(headerCells.map(c => (c || '').toString().trim().replace(/[*]/g, '')));

      for (let i = itemHeaderRow + 1; i <= range.end; i++) {
        const row = rows[i];
        if (!row) continue;
        const firstCell = (row[0] || '').toString().trim();
        if (firstCell === '' || firstCell.includes('合计') || firstCell.includes('小计')) continue;

        // Skip rows that are just repeating header text
        const nonEmptyCells = row.filter(c => (c || '').toString().trim() !== '');
        const headerMatchCount = nonEmptyCells.filter(c => headerValues.has((c || '').toString().trim().replace(/[*]/g, ''))).length;
        if (headerMatchCount >= 2 && headerMatchCount === nonEmptyCells.length) continue;

        const item: Record<string, string> = { ...cardInfo };
        for (const mapping of cardItemMappings) {
          const value = extractColumnValue(row, mapping, colIdxMap, headerCells);
          if (value !== undefined && value !== '') {
            item[mapping.targetField] = value;
          }
        }

        // Only add items with valid data
        if (item.skuCode || item.skuName) {
          items.push(rowToItem(item));
        }
      }
    }

    if (items.length > 0) {
      orders.push({
        externalCode: cardInfo.externalCode || undefined,
        storeName: cardInfo.storeName || undefined,
        receiverName: cardInfo.receiverName || undefined,
        receiverPhone: cardInfo.receiverPhone || undefined,
        receiverAddress: cardInfo.receiverAddress || undefined,
        items,
      });
    }
  }

  return orders;
}

// Text mode
function parseText(rows: string[][], rule: ParseRuleConfig, sheetName: string): OrderRecord[] {
  const text = rows.map(r => r.join('\t')).join('\n');
  const separator = rule.dataRegion.recordSeparator || '━━━';
  const blocks = text.split(new RegExp(separator));

  const orders: OrderRecord[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    const orderInfo: Record<string, string> = {};
    if (rule.staticValues) {
      for (const [k, v] of Object.entries(rule.staticValues)) {
        orderInfo[k] = v;
      }
    }

    // Extract order-level fields
    const regexMappings = rule.fieldMappings.filter(m => m.source === 'regex_group');
    for (const mapping of regexMappings) {
      try {
        const regex = new RegExp(mapping.value.toString(), 'm');
        const match = regex.exec(block);
        if (match && match[mapping.groupIndex ?? 1]) {
          orderInfo[mapping.targetField] = match[mapping.groupIndex ?? 1].trim();
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Extract items from text
    const items: OrderItemRecord[] = [];
    const itemMappings = rule.fieldMappings.filter(m => m.source === 'column_header');

    // Check if there's an item extraction pattern
    const itemPatternMapping = rule.fieldMappings.find(m => m.targetField === '_itemPattern');
    if (itemPatternMapping) {
      try {
        const regex = new RegExp(itemPatternMapping.value.toString(), 'gm');
        let match;
        while ((match = regex.exec(block)) !== null) {
          const item: Record<string, string> = { ...orderInfo };
          for (const m of itemMappings) {
            const gi = typeof m.value === 'number' ? m.value : parseInt(m.value.toString());
            if (!isNaN(gi) && match[gi]) {
              item[m.targetField] = match[gi].trim();
            }
          }
          items.push(rowToItem(item));
        }
      } catch {
        // Invalid regex
      }
    }

    if (items.length > 0) {
      orders.push({
        externalCode: orderInfo.externalCode || undefined,
        storeName: orderInfo.storeName || undefined,
        receiverName: orderInfo.receiverName || undefined,
        receiverPhone: orderInfo.receiverPhone || undefined,
        receiverAddress: orderInfo.receiverAddress || undefined,
        items,
      });
    }
  }

  return orders;
}

// Build mapping from column header text -> column index
function buildColumnIndexMap(headerCells: string[], mappings: FieldMapping[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const mapping of mappings) {
    if (mapping.source === 'column_header') {
      const label = mapping.value.toString();
      // Try exact match first
      for (let i = 0; i < headerCells.length; i++) {
        const cellText = (headerCells[i] || '').toString().trim();
        if (cellText === label) {
          map.set(label, i);
          break;
        }
      }
      // If no exact match, try partial match
      if (!map.has(label)) {
        const cleanLabel = label.replace(/[*]/g, '');
        for (let i = 0; i < headerCells.length; i++) {
          const cellText = (headerCells[i] || '').toString().trim().replace(/[*]/g, '');
          if (cellText && cleanLabel && (cellText === cleanLabel || cellText.startsWith(cleanLabel) || cleanLabel.startsWith(cellText))) {
            map.set(label, i);
            break;
          }
        }
      }
    } else if (mapping.source === 'column_index') {
      map.set(`__idx_${mapping.value}`, Number(mapping.value));
    }
  }
  return map;
}

// Check if a header cell matches a target label
function matchesHeader(cellText: string, targetLabel: string): boolean {
  if (!cellText || !targetLabel) return false;
  if (cellText === targetLabel) return true;
  const cleanCell = cellText.replace(/[*]/g, '');
  const cleanTarget = targetLabel.replace(/[*]/g, '');
  if (!cleanCell || !cleanTarget) return false;
  return cleanCell === cleanTarget || cleanCell.startsWith(cleanTarget) || cleanTarget.startsWith(cleanCell);
}

// Find column index with fuzzy matching
function findColumnIndex(headerCells: string[], label: string): number | undefined {
  if (!label) return undefined;
  // Exact match
  for (let i = 0; i < headerCells.length; i++) {
    const cell = (headerCells[i] || '').toString().trim();
    if (cell === label) return i;
  }
  // Fuzzy match
  const cleanLabel = label.replace(/[*]/g, '');
  if (!cleanLabel) return undefined;
  for (let i = 0; i < headerCells.length; i++) {
    const cell = (headerCells[i] || '').toString().trim().replace(/[*]/g, '');
    if (cell && (cell === cleanLabel || cell.startsWith(cleanLabel))) return i;
  }
  return undefined;
}

// Extract value from a row based on mapping
function extractColumnValue(
  row: string[],
  mapping: FieldMapping,
  colIndexMap: Map<string, number>,
  headerCells: string[]
): string | undefined {
  switch (mapping.source) {
    case 'column_header': {
      const idx = colIndexMap.get(mapping.value.toString());
      if (idx !== undefined && row[idx] !== undefined) {
        return (row[idx] || '').toString().trim();
      }
      return undefined;
    }
    case 'column_index': {
      const idx = Number(mapping.value);
      return row[idx] !== undefined ? (row[idx] || '').toString().trim() : undefined;
    }
    case 'static':
      return mapping.value.toString();
    case 'matrix_column_header': {
      // This is used in matrix transpose context; the header value is the store name
      // Handled separately in parseMatrixTranspose
      return undefined;
    }
    default:
      return undefined;
  }
}

// Extract info from bottom of sheet
function extractTailInfo(rows: string[][], config: TailExtractionConfig): Record<string, string> {
  const result: Record<string, string> = {};

  for (const field of config.fields) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cellText = (row[j] || '').toString().trim();
        // Check if cell matches the label (exact or starts with)
        // Also handle "label：value" or "label:value" format within same cell
        if (cellText === field.label || cellText.startsWith(field.label)) {
          // Check if the value is embedded in the same cell after a colon
          const colonIdx = cellText.search(/[：:]/);
          if (colonIdx >= 0 && cellText.substring(0, colonIdx).replace(/[：:]/g, '').trim() === field.label.replace(/[：:]/g, '').trim()) {
            const embeddedValue = cellText.substring(colonIdx + 1).trim();
            if (embeddedValue) {
              result[field.targetField] = embeddedValue;
              break;
            }
          }

          const offset = field.valueOffset ?? 1;
          const valueIdx = j + offset;
          if (valueIdx < row.length && row[valueIdx]) {
            result[field.targetField] = (row[valueIdx] || '').toString().trim();
          }
          break;
        }
      }
      if (result[field.targetField]) break;
    }
  }

  return result;
}

// Find a header value in card region
function findCardHeaderValue(rows: string[][], range: { start: number; end: number }, label: string): string | undefined {
  for (let i = range.start; i <= Math.min(range.start + 10, range.end); i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cellText = (row[j] || '').toString().trim();
      // Handle case where label is like "收货人" and cell is "收货人" or "收货人："
      const cleanCell = cellText.replace(/[：:]$/, '').trim();
      const cleanLabel = label.replace(/[：:]$/, '').trim();
      if (cleanCell === cleanLabel || cleanCell.startsWith(cleanLabel) || cleanLabel.startsWith(cleanCell)) {
        // Check if value is embedded after colon in same cell (e.g., "收货人：荣丽")
        const colonIdx = cellText.search(/[：:]/);
        if (colonIdx >= 0) {
          const beforeColon = cellText.substring(0, colonIdx).trim();
          const afterColon = cellText.substring(colonIdx + 1).trim();
          if (afterColon && (beforeColon === cleanLabel || beforeColon.startsWith(cleanLabel))) {
            return afterColon;
          }
        }
        if (j + 1 < row.length && row[j + 1]) {
          return (row[j + 1] || '').toString().trim();
        }
      }
    }
  }
  return undefined;
}

// Apply transformations
function applyTransformation(rows: Record<string, string>[], transform: { type: string; config: Record<string, unknown> }): Record<string, string>[] {
  switch (transform.type) {
    case 'compound_split':
      return applyCompoundSplit(rows, transform.config);
    case 'double_transpose':
      return applyDoubleTranspose(rows, transform.config);
    case 'aggregate':
    case 'matrix_transpose':
      // These are handled at a different level
      return rows;
    default:
      return rows;
  }
}

// Compound cell split
function applyCompoundSplit(rows: Record<string, string>[], config: Record<string, unknown>): Record<string, string>[] {
  const sourceField = config.sourceField as string;
  const separator = config.separator as string || '\n';
  const result: Record<string, string>[] = [];

  for (const row of rows) {
    const cellValue = row[sourceField] || '';
    const parts = cellValue.split(new RegExp(separator));

    if (parts.length <= 1) {
      result.push(row);
      continue;
    }

    for (const part of parts) {
      if (!part.trim()) continue;
      const newRow = { ...row };
      newRow[sourceField] = part.trim();

      const itemPattern = config.itemPattern as string;
      if (itemPattern) {
        try {
          const match = new RegExp(itemPattern).exec(part.trim());
          if (match) {
            const nameGroup = (config.nameGroupIndex as number) ?? 1;
            const quantityGroup = (config.quantityGroupIndex as number) ?? 2;
            if (config.nameTargetField) newRow[config.nameTargetField as string] = match[nameGroup]?.trim() || '';
            if (config.quantityTargetField) newRow[config.quantityTargetField as string] = match[quantityGroup]?.trim() || '';
          }
        } catch { /* skip */ }
      }
      result.push(newRow);
    }
  }

  return result;
}

// Double transpose
function applyDoubleTranspose(rows: Record<string, string>[], config: Record<string, unknown>): Record<string, string>[] {
  return rows;
}

// Convert row data to OrderItemRecord
function rowToItem(row: Record<string, string>): OrderItemRecord {
  return {
    skuCode: row.skuCode || '',
    skuName: row.skuName || '',
    quantity: parseInt(row.quantity || '0') || 0,
    spec: row.spec || undefined,
    remark: row.remark || undefined,
  };
}

// Convert flat rows to OrderRecord[]
function rowsToOrders(rows: Record<string, string>[]): OrderRecord[] {
  const orderMap = new Map<string, OrderRecord>();

  for (const row of rows) {
    const groupKey = row.externalCode || row.storeName || row.receiverName || `__auto_${Date.now()}_${Math.random()}`;

    if (!orderMap.has(groupKey)) {
      orderMap.set(groupKey, {
        externalCode: row.externalCode || undefined,
        storeName: row.storeName || undefined,
        receiverName: row.receiverName || undefined,
        receiverPhone: row.receiverPhone || undefined,
        receiverAddress: row.receiverAddress || undefined,
        items: [],
      });
    }

    const order = orderMap.get(groupKey)!;
    if (!order.storeName && row.storeName) order.storeName = row.storeName;
    if (!order.receiverName && row.receiverName) order.receiverName = row.receiverName;
    if (!order.receiverPhone && row.receiverPhone) order.receiverPhone = row.receiverPhone;
    if (!order.receiverAddress && row.receiverAddress) order.receiverAddress = row.receiverAddress;

    order.items.push(rowToItem(row));
  }

  return Array.from(orderMap.values());
}

// Convert OrderRecord[] to FlatOrderRow[] for display
export function ordersToFlatRows(orders: OrderRecord[]): FlatOrderRow[] {
  const rows: FlatOrderRow[] = [];
  let counter = 0;

  for (const order of orders) {
    for (const item of order.items) {
      rows.push({
        _rowId: `row_${counter++}`,
        externalCode: order.externalCode,
        storeName: order.storeName,
        receiverName: order.receiverName,
        receiverPhone: order.receiverPhone,
        receiverAddress: order.receiverAddress,
        skuCode: item.skuCode,
        skuName: item.skuName,
        quantity: item.quantity,
        spec: item.spec,
        remark: item.remark,
        _errors: {},
      });
    }
  }

  return rows;
}

// Validate flat rows
export function validateRows(rows: FlatOrderRow[]): FlatOrderRow[] {
  const validatedRows = rows.map(row => {
    const errors: Record<string, string> = {};

    if (!row.skuCode?.trim()) errors.skuCode = 'SKU编码不能为空';
    if (!row.skuName?.trim()) errors.skuName = 'SKU名称不能为空';
    if (!row.quantity || row.quantity <= 0) errors.quantity = '数量必须为正数';

    const hasStoreName = !!row.storeName?.trim();
    const hasReceiverInfo = !!row.receiverName?.trim() && !!row.receiverPhone?.trim() && !!row.receiverAddress?.trim();
    if (!hasStoreName && !hasReceiverInfo) {
      errors.storeName = '收货门店和收件人信息至少填一组';
      errors.receiverName = '收货门店和收件人信息至少填一组';
    }

    if (row.receiverPhone && !/^[\d\-+\s()]{7,20}$/.test(row.receiverPhone)) {
      errors.receiverPhone = '电话格式不正确';
    }

    return { ...row, _errors: errors };
  });

  const codeCount = new Map<string, number>();
  for (const row of validatedRows) {
    if (row.externalCode) {
      codeCount.set(row.externalCode, (codeCount.get(row.externalCode) || 0) + 1);
    }
  }
  for (const row of validatedRows) {
    if (row.externalCode && (codeCount.get(row.externalCode) || 0) > 1) {
      row._errors = { ...row._errors, externalCode: '外部编码重复' };
    }
  }

  return validatedRows;
}

export const TARGET_FIELDS = [
  { key: 'externalCode', label: '外部编码', required: false },
  { key: 'storeName', label: '收货门店', required: false, group: 'A' },
  { key: 'receiverName', label: '收件人姓名', required: false, group: 'B' },
  { key: 'receiverPhone', label: '收件人电话', required: false, group: 'B' },
  { key: 'receiverAddress', label: '收件人地址', required: false, group: 'B' },
  { key: 'skuCode', label: 'SKU物品编码', required: true },
  { key: 'skuName', label: 'SKU物品名称', required: true },
  { key: 'quantity', label: 'SKU发货数量', required: true },
  { key: 'spec', label: 'SKU规格型号', required: false },
  { key: 'remark', label: '备注', required: false },
] as const;
