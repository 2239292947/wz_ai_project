'use client';

import { useState, useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileUploaded: (file: File) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
  ];
  const acceptedExtensions = ['.xlsx', '.xls', '.docx', '.pdf'];

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedExtensions.includes(ext)) {
      return `不支持的文件格式: ${ext}，请上传 Excel、Word 或 PDF 文件`;
    }
    if (file.size > 50 * 1024 * 1024) {
      return '文件大小不能超过 50MB';
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    setError('');
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    onFileUploaded(file);
  }, [validateFile, onFileUploaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="space-y-6 animate-fadeIn stagger-children">
      {/* Instructions card */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg border border-slate-200/60 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          使用说明
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
            <div>
              <p className="text-sm font-medium text-gray-800">上传文件</p>
              <p className="text-xs text-slate-500 mt-0.5">拖拽或点击选择文件</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
            <div>
              <p className="text-sm font-medium text-gray-800">选择规则</p>
              <p className="text-xs text-slate-500 mt-0.5">系统智能匹配列映射</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
            <div>
              <p className="text-sm font-medium text-gray-800">预览编辑</p>
              <p className="text-xs text-slate-500 mt-0.5">检查数据，修正异常行</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">4</div>
            <div>
              <p className="text-sm font-medium text-gray-800">提交下单</p>
              <p className="text-xs text-slate-500 mt-0.5">一键批量提交，实时查看进度</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload zone */}
      <div className="bg-white/90 backdrop-blur-sm rounded-lg border border-slate-200/60 p-1 shadow-sm">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center w-full min-h-[280px] border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
            isDragging
              ? 'border-primary bg-gradient-to-br from-primary/5 to-primary/5 shadow-md'
              : 'border-slate-200/60 bg-gradient-to-br from-slate-50/50 to-white hover:border-primary/40 hover:from-primary/5 hover:shadow-md'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-transparent to-primary/0 transition-all duration-500 opacity-0" />

          <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 bg-gradient-to-br from-slate-50 to-slate-100/50 shadow-sm">
            <svg className={`w-10 h-10 transition-all duration-300 ${isDragging ? 'text-primary' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div className="relative text-center">
            <p className="text-slate-600 text-base mb-2 font-medium">
              {isDragging ? '松开鼠标上传文件' : (
                <>拖拽文件到此处，或<span className="text-primary font-semibold hover:underline">点击选择文件</span></>
              )}
            </p>
            <p className="text-slate-400 text-sm">
              支持 .xlsx, .xls, .docx, .pdf 格式，最大 50MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedExtensions.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50/90 border border-red-200/60 rounded-xl text-sm text-red-600 flex items-center gap-2 backdrop-blur-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
