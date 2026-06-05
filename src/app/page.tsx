'use client';

import { useState, useCallback } from 'react';
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
    <div className="min-h-full bg-bg">
      {/* Background mesh */}
      <div className="bg-mesh" />

      {/* Header - Glass nav */}
      <nav className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-14">
          <a className="flex items-center gap-3 group" href="/">
            <div className="relative bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm border border-slate-200/50 group-hover:border-primary/30 transition-colors duration-200">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <svg className="w-5 h-5 text-primary relative transition-transform duration-200 group-hover:scale-105" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold gradient-text">万能导入</span>
              <div className="text-[10px] text-slate-400 -mt-0.5 tracking-wide">SMART IMPORT</div>
            </div>
          </a>

          {/* Tabs - Segmented control */}
          <div className="flex items-center gap-0.5 bg-slate-100/50 rounded-xl p-1 border border-slate-200/50">
            <button
              onClick={() => setActiveTab('import')}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'import'
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
            >
              {activeTab === 'import' && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg" />
              )}
              <svg className="w-4 h-4 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="relative">批量下单</span>
              {activeTab === 'import' && (
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'history'
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
            >
              <svg className="w-4 h-4 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="relative">运单列表</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6 relative z-0">
        {activeTab === 'import' ? (
          <div className="animate-fadeIn">
            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6 stagger-children">
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
                      <div className={`w-8 h-0.5 transition-colors duration-200 ${isDone ? 'bg-primary' : 'bg-slate-200'}`} />
                    )}
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                          isActive
                            ? 'bg-primary text-white shadow-sm'
                            : isDone
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {isDone ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : s.step}
                      </div>
                      <span className={`text-sm transition-colors duration-200 ${
                        isActive ? 'text-primary font-medium' : isDone ? 'text-slate-700' : 'text-slate-400'
                      }`}>
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
            className={`toast-enter px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 min-w-[280px] backdrop-blur-sm ${
              toast.type === 'success' ? 'bg-emerald-50/90 text-emerald-600 border border-emerald-200/60' :
              toast.type === 'error' ? 'bg-red-50/90 text-red-600 border border-red-200/60' :
              toast.type === 'warning' ? 'bg-amber-50/90 text-amber-600 border border-amber-200/60' :
              'bg-sky-50/90 text-sky-600 border border-sky-200/60'
            }`}
          >
            <span>
              {toast.type === 'success' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : toast.type === 'error' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : toast.type === 'warning' ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
