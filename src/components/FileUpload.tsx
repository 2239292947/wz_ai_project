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
    <div className="bg-white rounded-xl shadow-sm border border-border p-8 fade-in">
      <h2 className="text-lg font-semibold text-text mb-2">上传文件</h2>
      <p className="text-sm text-text-muted mb-6">支持 Excel (.xlsx/.xls)、Word (.docx)、PDF 文件，可拖拽上传或点击选择</p>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-primary bg-primary-light'
            : 'border-gray-300 hover:border-primary hover:bg-primary-light/30'
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
            isDragging ? 'bg-primary' : 'bg-primary-light'
          }`}>
            <svg className={`w-8 h-8 ${isDragging ? 'text-white' : 'text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <p className="text-text font-medium">
              {isDragging ? '松开鼠标上传文件' : '点击选择文件或拖拽到此处'}
            </p>
            <p className="text-sm text-text-muted mt-1">
              支持 .xlsx, .xls, .docx, .pdf 格式，最大 50MB
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedExtensions.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-error-bg border border-red-200 rounded-lg text-sm text-error flex items-center gap-2">
          <span>✕</span>
          {error}
        </div>
      )}
    </div>
  );
}
