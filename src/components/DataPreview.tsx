'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FlatOrderRow, OrderRecord } from '@/types';
import { validateRows, TARGET_FIELDS } from '@/lib/parser-engine';

interface DataPreviewProps {
  flatRows: FlatOrderRow[];
  orders: OrderRecord[];
  parseErrors: string[];
  parseWarnings: string[];
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  onRowsChange: (rows: FlatOrderRow[]) => void;
  onOrdersChange: (orders: OrderRecord[]) => void;
}

export function DataPreview({
  flatRows,
  orders,
  parseErrors,
  parseWarnings,
  onSubmit,
  onBack,
  isSubmitting,
  onRowsChange,
  onOrdersChange,
}: DataPreviewProps) {
  const [editedRows, setEditedRows] = useState<FlatOrderRow[]>(() => validateRows(flatRows));
  const [searchText, setSearchText] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const errorCount = useMemo(() =>
    editedRows.filter(r => Object.keys(r._errors).length > 0).length,
    [editedRows]
  );

  const filteredRows = useMemo(() => {
    if (!searchText) return editedRows;
    return editedRows.filter(row =>
      Object.values(row).some(v =>
        typeof v === 'string' && v.toLowerCase().includes(searchText.toLowerCase())
      )
    );
  }, [editedRows, searchText]);

  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 20,
  });

  const handleCellEdit = useCallback((rowId: string, field: string, value: string) => {
    setEditedRows(prev => {
      const newRows = prev.map(row => {
        if (row._rowId !== rowId) return row;
        return {
          ...row,
          [field]: field === 'quantity' ? (parseInt(value) || 0) : value,
        };
      });
      return validateRows(newRows);
    });
  }, []);

  const handleDeleteRow = useCallback((rowId: string) => {
    setEditedRows(prev => prev.filter(r => r._rowId !== rowId));
  }, []);

  const handleAddRow = useCallback(() => {
    const newRow: FlatOrderRow = {
      _rowId: `row_new_${Date.now()}`,
      skuCode: '',
      skuName: '',
      quantity: 0,
      _errors: {},
      _isNew: true,
    };
    setEditedRows(prev => validateRows([...prev, newRow]));
  }, []);

  const handleExportExcel = useCallback(async () => {
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: editedRows }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `导出数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Export failed:', e);
    }
  }, [editedRows]);

  const handleSubmit = useCallback(() => {
    // Sync edited rows back to orders
    const updatedOrders = ordersToFlatRowsInverse(editedRows);
    onOrdersChange(updatedOrders);
    onSubmit();
  }, [editedRows, onOrdersChange, onSubmit]);

  // Convert flat rows back to OrderRecord[] for submission
  function ordersToFlatRowsInverse(rows: FlatOrderRow[]): OrderRecord[] {
    const orderMap = new Map<string, OrderRecord>();
    for (const row of rows) {
      const key = row.externalCode || row.storeName || row.receiverName || `__auto_${rows.indexOf(row)}`;
      if (!orderMap.has(key)) {
        orderMap.set(key, {
          externalCode: row.externalCode || undefined,
          storeName: row.storeName || undefined,
          receiverName: row.receiverName || undefined,
          receiverPhone: row.receiverPhone || undefined,
          receiverAddress: row.receiverAddress || undefined,
          items: [],
        });
      }
      orderMap.get(key)!.items.push({
        skuCode: row.skuCode,
        skuName: row.skuName,
        quantity: row.quantity,
        spec: row.spec,
        remark: row.remark,
      });
    }
    return Array.from(orderMap.values());
  }

  const columns = TARGET_FIELDS.map(f => ({
    key: f.key,
    label: f.label,
    required: f.required,
    width: ['receiverAddress', 'storeName'].includes(f.key) ? 200 :
           ['skuName', 'receiverName'].includes(f.key) ? 160 :
           ['externalCode', 'remark'].includes(f.key) ? 140 : 120,
  }));

  return (
    <div className="space-y-4 fade-in">
      {/* Parse Errors/Warnings */}
      {parseErrors.length > 0 && (
        <div className="p-4 bg-error-bg border border-red-200 rounded-xl">
          <p className="font-medium text-error mb-1">解析错误：</p>
          {parseErrors.map((e, i) => (
            <p key={i} className="text-sm text-error">{e}</p>
          ))}
        </div>
      )}
      {parseWarnings.length > 0 && (
        <div className="p-4 bg-warning-bg border border-orange-200 rounded-xl">
          <p className="font-medium text-warning mb-1">警告：</p>
          {parseWarnings.map((w, i) => (
            <p key={i} className="text-sm text-warning">{w}</p>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-text">数据预览</h2>
            <span className="text-sm text-text-muted">
              共 {editedRows.length} 条 · {errorCount > 0 && <span className="text-error">{errorCount} 条错误</span>}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索..."
              className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-48"
            />
            <button
              onClick={handleAddRow}
              className="px-3 py-1.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              + 新增行
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 border border-border text-text-secondary rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              导出Excel
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <div ref={parentRef} className="overflow-auto" style={{ height: Math.min(600, Math.max(300, editedRows.length * 40 + 50)) }}>
          <table className="data-table w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left whitespace-nowrap border-b border-border w-12">#</th>
                {columns.map(col => (
                  <th key={col.key} className="px-3 py-2.5 text-left whitespace-nowrap border-b border-border" style={{ minWidth: col.width }}>
                    {col.label}
                    {col.required && <span className="text-error ml-0.5">*</span>}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center whitespace-nowrap border-b border-border w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const row = filteredRows[virtualRow.index];
                if (!row) return null;

                return (
                  <tr
                    key={row._rowId}
                    className={`border-b border-border/50 hover:bg-gray-50/50 ${
                      row._isNew ? 'bg-primary-light/30' : ''
                    }`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    <td className="px-3 py-2 text-text-muted text-xs">{virtualRow.index + 1}</td>
                    {columns.map(col => {
                      const hasError = !!row._errors[col.key];
                      const value = row[col.key as keyof FlatOrderRow];
                      return (
                        <td
                          key={col.key}
                          className={`px-1 py-1 ${hasError ? 'error-cell' : ''}`}
                          title={hasError ? row._errors[col.key] : undefined}
                        >
                          <input
                            type={col.key === 'quantity' ? 'number' : 'text'}
                            value={value === undefined ? '' : String(value)}
                            onChange={e => handleCellEdit(row._rowId, col.key, e.target.value)}
                            className={`w-full px-2 py-1 rounded text-sm border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-primary/30 focus:outline-none ${
                              hasError ? 'bg-error-bg ring-1 ring-error/30' : ''
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(row._rowId)}
                        className="text-xs text-error hover:text-error/70 transition-colors"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Summary */}
      {errorCount > 0 && (
        <div className="p-4 bg-error-bg border border-red-200 rounded-xl">
          <p className="font-medium text-error mb-2">数据校验错误 ({errorCount} 条)：</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {editedRows
              .filter(r => Object.keys(r._errors).length > 0)
              .map(row => (
                <div key={row._rowId} className="text-sm text-error">
                  第 {editedRows.indexOf(row) + 1} 行: {Object.entries(row._errors)
                    .map(([field, msg]) => `${TARGET_FIELDS.find(f => f.key === field)?.label || field} ${msg}`)
                    .join('；')}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-5 py-2 text-text-secondary hover:text-text transition-colors"
        >
          ← 重新选择规则
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || errorCount > 0}
          className="px-8 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              提交中...
            </>
          ) : (
            '提交下单'
          )}
        </button>
      </div>

      {/* Submit Progress */}
      {isSubmitting && (
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full progress-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-sm text-text-muted mt-1 text-center">正在提交订单数据...</p>
        </div>
      )}
    </div>
  );
}
