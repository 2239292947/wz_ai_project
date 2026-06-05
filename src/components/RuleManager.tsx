'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ParseRuleConfig } from '@/types';

interface RuleManagerProps {
  uploadedFile: File | null;
  selectedRuleId: string;
  onRuleSelected: (ruleId: string, config: ParseRuleConfig) => void;
  onParse: () => void;
  onBack: () => void;
  isParsing: boolean;
  parseProgress: number;
}

interface RuleItem {
  id: string;
  name: string;
  description: string;
  config: ParseRuleConfig;
  createdAt: string;
  updatedAt: string;
}

export function RuleManager({
  uploadedFile,
  selectedRuleId,
  onRuleSelected,
  onParse,
  onBack,
  isParsing,
  parseProgress,
}: RuleManagerProps) {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<Record<string, string>>({});

  // New rule form state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleConfig, setNewRuleConfig] = useState<string>('');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  // Preview state
  const [previewResult, setPreviewResult] = useState<{ flatRows: unknown[]; errors: string[] } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Edit mode
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState('');

  // Copy mode
  const [copyingFromId, setCopyingFromId] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/rules');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch rules:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleAiGenerate = useCallback(async () => {
    if (!uploadedFile) return;
    setIsAiGenerating(true);
    setAiConfidence({});

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const res = await fetch('/api/rules/ai-generate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        const { rule, confidence } = data.data;
        setNewRuleName(`AI规则 - ${uploadedFile.name}`);
        setNewRuleConfig(JSON.stringify(rule, null, 2));
        setNewRuleDesc('由AI自动生成的解析规则');
        setAiConfidence(confidence);
        setShowNewRule(true);
      } else {
        alert(data.error || 'AI生成规则失败');
      }
    } catch (e) {
      alert('AI生成规则请求失败，请检查网络和API配置');
    } finally {
      setIsAiGenerating(false);
    }
  }, [uploadedFile]);

  const handleSaveRule = useCallback(async () => {
    if (!newRuleName || !newRuleConfig) {
      alert('请填写规则名称和配置');
      return;
    }

    try {
      const config = JSON.parse(newRuleConfig);
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRuleName,
          description: newRuleDesc,
          config,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onRuleSelected(data.data.id, config);
        setShowNewRule(false);
        setNewRuleName('');
        setNewRuleConfig('');
        setNewRuleDesc('');
        setAiConfidence({});
        fetchRules();
      }
    } catch (e) {
      alert('规则配置JSON格式无效');
    }
  }, [newRuleName, newRuleConfig, newRuleDesc, onRuleSelected, fetchRules]);

  const handleDeleteRule = useCallback(async (id: string) => {
    if (!confirm('确定删除此规则？')) return;

    try {
      await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (e) {
      alert('删除失败');
    }
  }, [fetchRules]);

  const handleCopyRule = useCallback((rule: RuleItem) => {
    setNewRuleName(`${rule.name} (副本)`);
    setNewRuleConfig(JSON.stringify(rule.config, null, 2));
    setNewRuleDesc(rule.description);
    setShowNewRule(true);
  }, []);

  const handleEditRule = useCallback((rule: RuleItem) => {
    setEditingRuleId(rule.id);
    setEditConfig(JSON.stringify(rule.config, null, 2));
  }, []);

  const handleSaveEdit = useCallback(async (ruleId: string) => {
    try {
      const config = JSON.parse(editConfig);
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ruleId, config }),
      });

      if ((await res.json()).success) {
        setEditingRuleId(null);
        setEditConfig('');
        fetchRules();
      }
    } catch (e) {
      alert('JSON格式无效');
    }
  }, [editConfig, fetchRules]);

  const handlePreviewRule = useCallback(async (config: ParseRuleConfig) => {
    if (!uploadedFile) return;
    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('rule', JSON.stringify(config));
      const res = await fetch('/api/parse', { method: 'POST', body: formData });
      const data = await res.json();
      setPreviewResult(data.success ? data.data : null);
    } catch (e) {
      console.error('Preview failed:', e);
    } finally {
      setIsPreviewing(false);
    }
  }, [uploadedFile]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* File Info Card */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200/60 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-slate-800">{uploadedFile?.name}</p>
              <p className="text-sm text-slate-400">
                {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB` : ''}
              </p>
            </div>
          </div>
          <button onClick={onBack} className="text-sm text-primary hover:underline font-medium">
            重新上传
          </button>
        </div>
      </div>

      {/* Rule Selection */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200/60 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">选择解析规则</h2>
          <div className="flex gap-2">
            <button
              onClick={handleAiGenerate}
              disabled={isAiGenerating}
              className="btn-premium px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isAiGenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI分析中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI生成规则
                </>
              )}
            </button>
            <button
              onClick={() => {
                setNewRuleName('');
                setNewRuleConfig(JSON.stringify({
                  fileType: 'excel',
                  sheets: 'all',
                  dataRegion: { mode: 'tabular', headerRow: 0, dataStartRow: 1 },
                  fieldMappings: [],
                }, null, 2));
                setNewRuleDesc('');
                setAiConfidence({});
                setShowNewRule(true);
              }}
              className="px-4 py-1.5 border border-primary/30 text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-all duration-200"
            >
              + 新建规则
            </button>
          </div>
        </div>

        {/* AI Confidence Warning */}
        {Object.keys(aiConfidence).length > 0 && showNewRule && (
          <div className="mb-4 p-3 bg-amber-50/90 border border-amber-200/60 rounded-lg text-sm backdrop-blur-sm">
            <p className="font-medium text-amber-600 mb-1">AI推测标注：</p>
            {Object.entries(aiConfidence).map(([field, msg]) => (
              <p key={field} className="text-slate-600">- {field}: {msg}</p>
            ))}
            <p className="mt-1 text-slate-400">请确认以下规则配置是否正确，可手动调整后保存</p>
          </div>
        )}

        {/* New Rule Form */}
        {showNewRule && (
          <div className="mb-4 p-4 bg-gradient-to-br from-primary/5 to-primary/5 border border-primary/20 rounded-xl space-y-3 animate-scaleIn">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-800">新建解析规则</h3>
              <button
                onClick={() => { setShowNewRule(false); setAiConfidence({}); }}
                className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">规则名称</label>
              <input
                type="text"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus-ring bg-white/80"
                placeholder="请输入规则名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">说明</label>
              <input
                type="text"
                value={newRuleDesc}
                onChange={e => setNewRuleDesc(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus-ring bg-white/80"
                placeholder="规则描述（可选）"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">规则配置 (JSON)</label>
              <textarea
                value={newRuleConfig}
                onChange={e => setNewRuleConfig(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus-ring bg-white/80"
                placeholder="JSON格式的解析规则配置"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveRule}
                className="btn-premium px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-all"
              >
                保存规则
              </button>
              <button
                onClick={() => {
                  try {
                    const config = JSON.parse(newRuleConfig);
                    handlePreviewRule(config);
                  } catch { alert('JSON格式无效'); }
                }}
                disabled={isPreviewing}
                className="px-4 py-1.5 border border-primary/30 text-primary rounded-lg text-sm font-medium hover:bg-primary/5 disabled:opacity-50 transition-all duration-200"
              >
                {isPreviewing ? '试解析中...' : '试解析预览'}
              </button>
            </div>

            {/* Preview Result */}
            {previewResult && (
              <div className="mt-3 p-3 bg-white/90 border border-slate-200/60 rounded-lg backdrop-blur-sm">
                <p className="text-sm font-medium text-slate-800 mb-2">
                  试解析结果: {previewResult.flatRows?.length || 0} 条数据
                  {previewResult.errors?.length > 0 && `，${previewResult.errors.length} 个错误`}
                </p>
                {previewResult.errors?.length > 0 && (
                  <div className="text-xs text-red-500">
                    {previewResult.errors.slice(0, 3).map((e, i) => <p key={i}>{e}</p>)}
                    {previewResult.errors.length > 3 && <p>...还有 {previewResult.errors.length - 3} 个错误</p>}
                  </div>
                )}
                {previewResult.flatRows?.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400">
                    前3行: {JSON.stringify(previewResult.flatRows.slice(0, 3), null, 2).slice(0, 500)}...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-6 h-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-lg mb-2">暂无解析规则</p>
            <p className="text-sm">点击"AI生成规则"或"新建规则"创建第一条规则</p>
          </div>
        ) : (
          <div className="space-y-2 stagger-children">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`p-4 rounded-lg transition-all duration-200 cursor-pointer card-interactive ${
                  selectedRuleId === rule.id
                    ? 'border-primary bg-gradient-to-br from-primary/5 to-primary/5 !border-primary'
                    : ''
                }`}
                onClick={() => onRuleSelected(rule.id, rule.config)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      selectedRuleId === rule.id ? 'border-primary bg-primary' : 'border-slate-300'
                    }`}>
                      {selectedRuleId === rule.id && (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{rule.name}</p>
                      <p className="text-xs text-slate-400">
                        {rule.description || '无描述'} · {rule.config.fileType || 'excel'} · {rule.config.dataRegion?.mode || 'tabular'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handlePreviewRule(rule.config)}
                      className="px-2 py-1 text-xs text-primary hover:bg-primary/5 rounded transition-colors duration-200"
                      title="试解析"
                    >
                      试解析
                    </button>
                    <button
                      onClick={() => handleCopyRule(rule)}
                      className="px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 rounded transition-colors duration-200"
                      title="复制"
                    >
                      复制
                    </button>
                    {editingRuleId === rule.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(rule.id)}
                          className="px-2 py-1 text-xs text-emerald-500 hover:bg-emerald-50 rounded transition-colors duration-200"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingRuleId(null)}
                          className="px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 rounded transition-colors duration-200"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 rounded transition-colors duration-200"
                          title="编辑"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded transition-colors duration-200"
                          title="删除"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit form */}
                {editingRuleId === rule.id && (
                  <div className="mt-3">
                    <textarea
                      value={editConfig}
                      onChange={e => setEditConfig(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus-ring bg-white/80"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-5 py-2 text-slate-400 hover:text-slate-700 transition-colors duration-200"
        >
          ← 返回上传
        </button>
        <button
          onClick={onParse}
          disabled={!selectedRuleId || isParsing}
          className="btn-premium px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {isParsing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              解析中 {parseProgress}%
            </>
          ) : (
            '开始解析'
          )}
        </button>
      </div>

      {/* Progress Bar */}
      {isParsing && (
        <div className="mt-4 animate-fadeIn">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all duration-300 progress-pulse"
              style={{ width: `${parseProgress}%` }}
            />
          </div>
          <p className="text-sm text-slate-400 mt-1 text-center">
            正在解析文件... {parseProgress}%
          </p>
        </div>
      )}
    </div>
  );
}
