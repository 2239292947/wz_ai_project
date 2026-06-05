// Target order fields
export interface OrderRecord {
  id?: string;
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  items: OrderItemRecord[];
}

export interface OrderItemRecord {
  id?: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  spec?: string;
  remark?: string;
}

// Flat row for preview table (order info + item info merged)
export interface FlatOrderRow {
  _rowId: string;
  externalCode?: string;
  storeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  spec?: string;
  remark?: string;
  _errors: Record<string, string>;
  _isNew?: boolean;
  _isDeleted?: boolean;
}

// Parse rule configuration
export interface ParseRuleConfig {
  fileType: 'excel' | 'word' | 'pdf';
  sheets: 'all' | string[];
  dataRegion: {
    mode: 'tabular' | 'card' | 'text';
    headerRow?: number;
    dataStartRow?: number;
    dataEndMarker?: string;
    skipRows?: number[];
    cardStartPattern?: string;
    recordSeparator?: string;
  };
  fieldMappings: FieldMapping[];
  tailExtraction?: TailExtractionConfig;
  transformations?: Transformation[];
  staticValues?: Record<string, string>;
}

export interface FieldMapping {
  targetField: string;
  source: 'column_header' | 'column_index' | 'tail_label' | 'card_header_label' | 'static' | 'regex_group' | 'matrix_column_header';
  value: string | number;
  groupIndex?: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface TailExtractionConfig {
  fields: {
    label: string;
    targetField: string;
    valueOffset?: number;
    rowPattern?: string;
  }[];
}

export interface Transformation {
  type: 'aggregate' | 'matrix_transpose' | 'compound_split' | 'double_transpose';
  config: Record<string, unknown>;
}

// Aggregation config
export interface AggregateConfig {
  groupByField: string;
  sharedFields: string[];
}

// Matrix transpose config
export interface MatrixTransposeConfig {
  fixedColumns: { sourceLabel: string; targetField: string }[];
  transposeStartCol: number;
  transposeHeaderTarget: string;
  transposeValueTarget: string;
  skipIfZero?: boolean;
  skipIfEmpty?: boolean;
}

// Double transpose config
export interface DoubleTransposeConfig {
  rowHeaderField: string;
  columnHeaderField: string;
  valueField: string;
  fixedColumns: { sourceLabel: string; targetField: string }[];
  transposeStartCol: number;
  compoundCellSplit?: {
    separator: string;
    itemPattern: string;
    nameGroupIndex: number;
    quantityGroupIndex: number;
  };
}

// Compound split config
export interface CompoundSplitConfig {
  sourceField: string;
  separator: string;
  resultFields: { targetField: string; groupIndex: number }[];
}

// Card mode config
export interface CardConfig {
  startMarkerPattern: string;
  headerFields: { label: string; targetField: string; valueOffset: number }[];
  itemTableHeaderOffset: number;
  itemColumnMappings: { sourceLabel: string; targetField: string }[];
}

// Text mode config
export interface TextConfig {
  recordSeparator: string;
  fieldExtractors: { targetField: string; pattern: string; groupIndex?: number }[];
  itemExtractors?: { pattern: string; fields: { targetField: string; groupIndex: number }[] };
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Parse result
export interface ParseResult {
  orders: OrderRecord[];
  errors: string[];
  warnings: string[];
}
