'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, File, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
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
          <div className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 shadow-sm">
            Bekliyor
          </div>
        );
      case 'uploading':
        return (
          <div className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-blue-300 shadow-sm animate-pulse">
            {progress?.stage === 'uploading' ? 'Yükleniyor' : 
             progress?.stage === 'saving' ? 'Kaydediliyor' : 'İşleniyor'}
          </div>
        );
      case 'completed':
        return (
          <div className="bg-gradient-to-r from-green-100 to-green-200 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-green-300 shadow-sm">
            Tamamlandı
          </div>
        );
      case 'error':
        return (
          <div className="bg-gradient-to-r from-red-100 to-red-200 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-red-300 shadow-sm">
            Hata
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
        return <Upload className="h-5 w-5 text-white animate-bounce" />;
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

  return (
    <div className="space-y-6">
      {/* Yükleme Alanı */}
      <div className={`relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
        dragActive 
          ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-blue-200/50' 
          : 'border-gray-300 hover:border-blue-400 hover:shadow-xl'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-blue-50/30"></div>
        <div className="relative p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <Upload className="h-8 w-8 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-bold text-gray-900">Dosya Yükleme</h3>
                <p className="text-gray-600 font-medium">Çoklu dosya desteği</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-full inline-block">
              .pdf, .docx, .xlsx, .xls, .txt formatları • Maksimum 10MB
            </p>
          </div>
          
          <div
            className={`relative p-12 text-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group ${
              dragActive 
                ? 'border-blue-500 bg-gradient-to-br from-blue-100 to-indigo-100 scale-[1.02]' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-blue-50/30 rounded-2xl"></div>
            <div className="relative">
              <div className={`mx-auto mb-6 p-4 rounded-2xl transition-all duration-300 ${
                dragActive 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg' 
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 group-hover:from-blue-500 group-hover:to-indigo-500'
              }`}>
                <Upload className={`h-12 w-12 text-white transition-transform duration-300 ${
                  dragActive ? 'scale-110' : 'group-hover:scale-110'
                }`} />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">
                {dragActive ? 'Dosyaları Bırakın!' : 'Dosyalarınızı Sürükleyin'}
              </h4>
              <p className="text-gray-600 mb-6 text-lg">
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
                className="bg-white/80 backdrop-blur-sm border-2 border-blue-200 hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-transparent transition-all duration-300 px-8 py-3 text-lg font-semibold shadow-lg"
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
        <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-green-50/30"></div>
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl shadow-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Yükleme Durumu ({files.length})
                </h3>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                {files.filter(f => f.status === 'completed').length} / {files.length} Tamamlandı
              </div>
            </div>
            
            <div className="space-y-4">
              {files.map((fileObj) => (
                <div key={fileObj.id} className="relative bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-50/20"></div>
                  <div className="relative p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-xl shadow-lg ${getStatusColor(fileObj)}`}>
                          {getStatusIcon(fileObj)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 text-sm truncate max-w-xs">
                            {fileObj.file.name}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-xs text-gray-500 font-medium">
                              {(fileObj.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                            <p className="text-xs text-gray-500 font-medium">
                              {fileObj.file.type.split('/')[1]?.toUpperCase() || 'Unknown'}
                            </p>
                          </div>
                          {fileObj.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-xs text-red-600 font-medium">{fileObj.error}</p>
                            </div>
                          )}
                          {fileObj.progress?.stage && fileObj.status === 'uploading' && (
                            <div className="mt-1">
                              <p className="text-xs text-blue-600 font-medium">
                                {fileObj.progress.stage === 'uploading' && 'Storage\'a yükleniyor...'}
                                {fileObj.progress.stage === 'saving' && 'Metadata kaydediliyor...'}
                                {fileObj.progress.stage === 'completed' && 'Tamamlandı!'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {fileObj.status === 'uploading' && fileObj.progress?.progress && (
                          <div className="w-24">
                            <Progress 
                              value={fileObj.progress.progress} 
                              className="h-2" 
                            />
                            <p className="text-xs text-gray-500 mt-1 text-center">
                              {fileObj.progress.progress}%
                            </p>
                          </div>
                        )}
                        {getStatusBadge(fileObj)}
                        {fileObj.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryFailedUploads()}
                            className="text-xs"
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