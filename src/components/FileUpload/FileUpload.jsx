'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, File, AlertCircle, CheckCircle2, FileText, Clock } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

export default function FileUpload({ onFileUploaded }) {
  const [dragActive, setDragActive] = useState(false);
  
  // Use custom hook for file upload logic
  const {
    files,
    error,
    uploadStats,
    completedFiles,
    hasErrors,
    isUploading,
    addAndUploadFiles,
    removeFile,
    retryFailedUploads
  } = useFileUpload();

  // Notify parent component when files are uploaded
  const handleFileUploaded = useCallback((fileResult) => {
    if (onFileUploaded) {
      onFileUploaded(fileResult);
    }
  }, [onFileUploaded]);

  // Handle file selection and upload
  const handleFiles = useCallback(async (selectedFiles) => {
    const result = await addAndUploadFiles(selectedFiles);
    
    // Notify parent about successful uploads
    if (result.success) {
      // We'll get notifications through the hook when files complete
      completedFiles.forEach(fileObj => {
        if (fileObj.result) {
          handleFileUploaded(fileObj.result);
        }
      });
    }
  }, [addAndUploadFiles, completedFiles, handleFileUploaded]);

  // Drag & Drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const getStatusBadge = (fileObj) => {
    const { status, progress } = fileObj;
    
    switch (status) {
      case 'pending':
        return (
          <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            Beklemede
          </div>
        );
      case 'uploading':
        return (
          <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            Yükleniyor
          </div>
        );
      case 'completed':
        return (
          <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            ✅ Tamamlandı
          </div>
        );
      case 'error':
        return (
          <div className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            ❌ Hata
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusIcon = (fileObj) => {
    const { status } = fileObj;
    
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-white" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-white" />;
      case 'uploading':
        return <Upload className="h-5 w-5 text-white" />;
      default:
        return <File className="h-5 w-5 text-white" />;
    }
  };

  const getStatusColor = (fileObj) => {
    const { status } = fileObj;
    
    switch (status) {
      case 'completed':
        return 'bg-gradient-to-r from-green-500 to-emerald-500';
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-red-600';
      case 'uploading':
        return 'bg-gradient-to-r from-blue-500 to-indigo-500';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const getStatusMessage = (fileObj) => {
    const { status, progress } = fileObj;
    
    switch (status) {
      case 'completed':
        return 'Dosya yüklendi, Cloud Function işliyor...';
      case 'uploading':
        return `Yükleniyor... ${progress?.progress || 0}%`;
      case 'error':
        return fileObj.error || 'Hata oluştu';
      default:
        return 'Beklemede';
    }
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Yükleme Alanı */}
      <div className={`relative rounded-3xl shadow-2xl border-2 border-dashed transition-all duration-300 overflow-hidden bg-neutral-900/60 border-neutral-800 ${
        dragActive 
          ? 'border-neutral-500' 
          : 'hover:border-neutral-500 hover:shadow-xl'
      }`}>
        <div className="absolute inset-0"></div>
        <div className="relative p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 bg-neutral-800 rounded-2xl shadow-lg">
                <Upload className="h-8 w-8 text-neutral-200" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-neutral-100">Dosya Yükleme</h3>
                <p className="text-neutral-400 font-medium">Çoklu dosya desteği</p>
              </div>
            </div>
            <p className="text-sm text-neutral-400 bg-neutral-800 px-4 py-2 rounded-full inline-block">
              .pdf, .docx, .xlsx, .xls, .txt formatları • Maksimum 10MB
            </p>
          </div>
          
          <div
            className={`relative p-12 text-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group ${
              dragActive 
                ? 'border-neutral-500 bg-neutral-800 scale-[1.02]' 
                : 'border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/30 rounded-2xl"></div>
            <div className="relative">
              <div className={`mx-auto mb-6 p-4 rounded-2xl transition-all duration-300 bg-neutral-800`}>
                <Upload className={`h-12 w-12 text-neutral-200 transition-transform duration-300 ${
                  dragActive ? 'scale-110' : 'group-hover:scale-110'
                }`} />
              </div>
              <h4 className="text-2xl font-bold text-neutral-100 mb-3">
                {dragActive ? 'Dosyaları Bırakın!' : 'Dosyalarınızı Sürükleyin'}
              </h4>
              <p className="text-neutral-400 mb-6 text-lg">
                {dragActive 
                  ? 'Dosyalar yüklenmeye hazır' 
                  : 'Birden fazla dosyayı aynı anda yükleyebilirsiniz'
                }
              </p>
              <input
                id="fileInput"
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.xls,.txt"
                onChange={handleFileInput}
                className="hidden"
              />
              <Button 
                variant="outline" 
                className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-neutral-100 transition-all duration-300 px-8 py-3 text-lg font-semibold shadow-lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                Dosya Seç
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hata Mesajları */}
      {error && (
        <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-red-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50/80 to-orange-50/80"></div>
          <div className="relative p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl shadow-lg">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-red-900 mb-2">Dosya Yükleme Hatası</h4>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-red-800 font-medium whitespace-pre-line text-sm leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Yüklenen Dosyalar Listesi */}
      {files.length > 0 && (
        <div className="relative rounded-3xl shadow-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-neutral-800 rounded-xl shadow-lg">
                  <FileText className="h-6 w-6 text-neutral-200" />
                </div>
                <h3 className="text-xl font-bold text-neutral-100">
                  Yükleme Durumu ({files.length})
                </h3>
              </div>
              <div className="bg-neutral-800 text-neutral-200 px-4 py-2 rounded-full text-sm font-medium shadow-lg border border-neutral-700">
                {files.filter(f => f.status === 'completed').length} / {files.length} Tamamlandı
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            {isUploading && (
              <div className="mb-6 p-4 rounded-2xl border border-neutral-800 bg-neutral-900">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-300">Dosyalar yükleniyor...</span>
                  <span className="text-sm text-neutral-400 font-semibold">
                    {files.filter(f => f.status === 'completed').length} / {files.length}
                  </span>
                </div>
                <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-neutral-200 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${(files.filter(f => f.status === 'completed').length / files.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
    
            <div className="space-y-4">
              {files.map((fileObj) => (
                <div key={fileObj.id} className="relative rounded-2xl border border-neutral-800 bg-neutral-900 shadow-lg overflow-hidden">
                  <div className="absolute inset-0"></div>
                  <div className="relative p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-xl shadow-lg bg-neutral-800`}>
                          {getStatusIcon(fileObj)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-neutral-100 text-sm truncate max-w-xs">
                            {fileObj.file.name}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-xs text-neutral-400 font-medium">
                              {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <p className="text-xs text-neutral-400 font-medium">
                              {fileObj.file.type.split('/')[1]?.toUpperCase() || 'Unknown'}
                            </p>
                          </div>
                          {fileObj.error && (
                            <div className="mt-2 p-2 bg-neutral-900 border border-red-400/30 rounded-lg">
                              <p className="text-xs text-red-400 font-medium">{fileObj.error}</p>
                            </div>
                          )}
                          {fileObj.status === 'completed' && (
                            <div className="mt-2 p-2 border border-neutral-800 rounded-lg bg-neutral-900">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-3 w-3 text-neutral-400" />
                                <p className="text-xs text-neutral-400 font-medium">
                                  Cloud Function işliyor, kısa süre sonra görünecek...
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {fileObj.status === 'uploading' && (
                          <div className="w-24">
                            <Progress 
                              value={fileObj.progress?.progress || 0} 
                              className="h-2 bg-neutral-800"
                            />
                          </div>
                        )}
                        {getStatusBadge(fileObj)}
                        {fileObj.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryFailedUploads()}
                            className="text-xs text-neutral-200 border-neutral-700"
                          >
                            Tekrar Dene
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {hasErrors && (
                <div className="flex justify-center mt-4">
                  <Button
                    onClick={retryFailedUploads}
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Hatalı Yüklemeleri Tekrar Dene
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}