'use client';

import { useState, useCallback, useRef } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { RuleManager } from '@/components/RuleManager';
import { DataPreview } from '@/components/DataPreview';
import { OrderList } from '@/components/OrderList';
import type { ParseRuleConfig, FlatOrderRow, OrderRecord } from '@/types';

type TabType = 'import' | 'history';
type StepType = 'upload' | 'rule' | 'preview';

// Toast notification
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('import');
  const [currentStep, setCurrentStep] = useState<StepType>('upload');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [rawFileData, setRawFileData] = useState<string>(''); // base64 or preview

  // Rule state
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedRuleConfig, setSelectedRuleConfig] = useState<ParseRuleConfig | null>(null);

  // Data state
  const [flatRows, setFlatRows] = useState<FlatOrderRow[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handleFileUploaded = useCallback((file: File) => {
    setUploadedFile(file);
    setCurrentStep('rule');
    addToast('success', `文件 "${file.name}" 上传成功`);
  }, [addToast]);

  const handleRuleSelected = useCallback((ruleId: string, config: ParseRuleConfig) => {
    setSelectedRuleId(ruleId);
    setSelectedRuleConfig(config);
  }, []);

  const handleParse = useCallback(async () => {
    if (!uploadedFile || !selectedRuleConfig) {
      addToast('error', '请先上传文件并选择解析规则');
      return;
    }

    setIsParsing(true);
    setParseProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('rule', JSON.stringify(selectedRuleConfig));

      setParseProgress(30);

      const response = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      setParseProgress(70);

      const result = await response.json();

      if (!result.success) {
        addToast('error', result.error || '解析失败');
        setIsParsing(false);
        setParseProgress(0);
        return;
      }

      setParseProgress(90);

      const { flatRows: rows, orders: ords, errors, warnings } = result.data;

      setFlatRows(rows || []);
      setOrders(ords || []);
      setParseErrors(errors || []);
      setParseWarnings(warnings || []);
      setCurrentStep('preview');
      setParseProgress(100);

      if (errors?.length > 0) {
        addToast('warning', `解析完成，但有 ${errors.length} 个错误`);
      } else if (rows?.length > 0) {
        addToast('success', `解析成功，共 ${rows.length} 条数据`);
      } else {
        addToast('warning', '解析完成，但未提取到数据');
      }
    } catch (error) {
      addToast('error', '解析请求失败，请检查网络连接');
    } finally {
      setTimeout(() => {
        setIsParsing(false);
        setParseProgress(0);
      }, 500);
    }
  }, [uploadedFile, selectedRuleConfig, addToast]);

  const handleSubmitOrders = useCallback(async () => {
    if (flatRows.length === 0) return;

    // Check for errors
    const hasErrors = flatRows.some(row => Object.keys(row._errors).length > 0);
    if (hasErrors) {
      addToast('error', '数据中存在错误，请先修正后再提交');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });

      const result = await response.json();

      if (result.success) {
        const { successCount, failCount } = result.data;
        if (failCount > 0) {
          addToast('warning', `提交完成：成功 ${successCount} 条，失败 ${failCount} 条`);
        } else {
          addToast('success', `提交成功，共 ${successCount} 条订单`);
        }
        // Reset to initial state
        setUploadedFile(null);
        setSelectedRuleId('');
        setSelectedRuleConfig(null);
        setFlatRows([]);
        setOrders([]);
        setParseErrors([]);
        setParseWarnings([]);
        setCurrentStep('upload');
      } else {
        addToast('error', result.error || '提交失败');
      }
    } catch (error) {
      addToast('error', '提交请求失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [flatRows, orders, addToast]);

  const handleBackToUpload = useCallback(() => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setSelectedRuleId('');
    setSelectedRuleConfig(null);
    setFlatRows([]);
    setOrders([]);
    setParseErrors([]);
    setParseWarnings([]);
  }, []);

  const handleBackToRule = useCallback(() => {
    setCurrentStep('rule');
    setSelectedRuleId('');
    setSelectedRuleConfig(null);
    setFlatRows([]);
    setOrders([]);
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-text">万能导入</h1>
            <span className="text-xs text-text-muted bg-primary-light text-primary-text px-2 py-0.5 rounded-full">V2</span>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'import'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-gray-100'
              }`}
            >
              批量下单
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-gray-100'
              }`}
            >
              运单列表
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {activeTab === 'import' ? (
          <div className="fade-in">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              {[
                { key: 'upload', label: '上传文件', step: 1 },
                { key: 'rule', label: '选择规则', step: 2 },
                { key: 'preview', label: '预览数据', step: 3 },
              ].map((s, i) => {
                const stepIndex = ['upload', 'rule', 'preview'].indexOf(currentStep);
                const isActive = s.key === currentStep;
                const isDone = i < stepIndex;

                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {i > 0 && (
                      <div className={`w-8 h-0.5 ${isDone ? 'bg-primary' : 'bg-border'}`} />
                    )}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isActive
                            ? 'bg-primary text-white'
                            : isDone
                            ? 'bg-primary text-white'
                            : 'bg-gray-200 text-text-muted'
                        }`}
                      >
                        {isDone ? '✓' : s.step}
                      </div>
                      <span className={`text-sm ${isActive ? 'text-primary font-medium' : isDone ? 'text-text-secondary' : 'text-text-muted'}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step Content */}
            {currentStep === 'upload' && (
              <FileUpload onFileUploaded={handleFileUploaded} />
            )}

            {currentStep === 'rule' && (
              <RuleManager
                uploadedFile={uploadedFile}
                selectedRuleId={selectedRuleId}
                onRuleSelected={handleRuleSelected}
                onParse={handleParse}
                onBack={handleBackToUpload}
                isParsing={isParsing}
                parseProgress={parseProgress}
              />
            )}

            {currentStep === 'preview' && (
              <DataPreview
                flatRows={flatRows}
                orders={orders}
                parseErrors={parseErrors}
                parseWarnings={parseWarnings}
                onSubmit={handleSubmitOrders}
                onBack={handleBackToRule}
                isSubmitting={isSubmitting}
                onRowsChange={setFlatRows}
                onOrdersChange={setOrders}
              />
            )}
          </div>
        ) : (
          <OrderList />
        )}
      </main>

      {/* Toast Notifications */}
      <div className="fixed top-16 right-6 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast-enter px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 min-w-[280px] ${
              toast.type === 'success' ? 'bg-success-bg text-success border border-green-200' :
              toast.type === 'error' ? 'bg-error-bg text-error border border-red-200' :
              toast.type === 'warning' ? 'bg-warning-bg text-warning border border-orange-200' :
              'bg-primary-light text-primary-text border border-teal-200'
            }`}
          >
            <span>
              {toast.type === 'success' ? '✓' :
               toast.type === 'error' ? '✕' :
               toast.type === 'warning' ? '!' : 'ℹ'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
