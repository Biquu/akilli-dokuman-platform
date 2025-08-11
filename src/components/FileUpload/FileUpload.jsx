'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, File, AlertCircle, CheckCircle2, FileText, Clock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
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

  // Track processing completion from Firestore after upload
  const [processedMap, setProcessedMap] = useState({}); // { docId: boolean }

  useEffect(() => {
    const unsubscribes = [];
    files.forEach((f) => {
      const docId = f?.result?.documentId;
      if (f.status === 'completed' && docId && processedMap[docId] === undefined) {
        const ref = doc(db, 'documents', docId);
        const unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const done = data?.processingStatus === 'completed' || data?.searchable === true;
            if (done) {
              setProcessedMap((prev) => ({ ...prev, [docId]: true }));
              // işlem tamamlandıysa artık dinlemeye gerek yok
              unsubscribe();
            }
          }
        });
        unsubscribes.push(unsubscribe);
      }
    });
    return () => unsubscribes.forEach((u) => u());
  }, [files, processedMap]);

  // Notify parent component when files are uploaded
  const handleFileUploaded = useCallback((fileResult) => {
    console.log('[FileUpload] FILE_UPLOADED', { documentId: fileResult?.documentId, storagePath: fileResult?.file?.storagePath });
    if (onFileUploaded) {
      onFileUploaded(fileResult);
    }
  }, [onFileUploaded]);

  // Handle file selection and upload
  const handleFiles = useCallback(async (selectedFiles) => {
    console.log('[FileUpload] HANDLE_FILES', { count: selectedFiles?.length });
    const result = await addAndUploadFiles(selectedFiles);
    
    // Notify parent about successful uploads
    if (result.success) {
      // We'll get notifications through the hook when files complete
      completedFiles.forEach(fileObj => {
        if (fileObj.result) {
          console.log('[FileUpload] COMPLETED_ITEM', { id: fileObj.id, name: fileObj.file?.name });
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
      console.log('[FileUpload] DROP', { count: e.dataTransfer.files.length });
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      console.log('[FileUpload] FILE_INPUT', { count: e.target.files.length });
      handleFiles(e.target.files);
    }
  };

  const getStatusBadge = (fileObj) => {
    const { status, progress } = fileObj;
    
    switch (status) {
      case 'pending':
        return (
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800">
            Beklemede
          </div>
        );
      case 'uploading':
        return (
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
            Yükleniyor
          </div>
        );
      case 'completed':
        return (
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
            ✅ Tamamlandı
          </div>
        );
      case 'error':
        return (
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
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
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-600';
      case 'uploading':
        return 'bg-blue-600';
      default:
        return 'bg-gray-600';
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

  const getReadableType = (fileObj) => {
    const type = fileObj?.file?.type || '';
    const name = fileObj?.file?.name || '';
    const ext = name.includes('.') ? name.split('.').pop().toUpperCase() : '';

    if (type.includes('pdf') || ext === 'PDF') return 'PDF';
    if (type.includes('word') || type.includes('doc') || ext === 'DOCX' || ext === 'DOC') return 'DOCX';
    if (type.includes('spreadsheet') || type.includes('excel') || ext === 'XLSX' || ext === 'XLS') return 'XLSX';
    if (type.includes('presentation') || ext === 'PPTX' || ext === 'PPT') return 'PPTX';
    if (type.includes('text/plain') || ext === 'TXT') return 'TXT';
    return ext || (type.split('/')[1]?.toUpperCase() || 'BİLİNMİYOR');
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Yükleme Alanı */}
      <div className={`relative rounded-3xl shadow-2xl border-2 border-dashed transition-all duration-300 overflow-hidden bg-card border-border ${
        dragActive 
          ? 'border-ring' 
          : 'hover:border-ring hover:shadow-xl'
      }`}>
        <div className="absolute inset-0"></div>
            <div className="relative p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="p-3 bg-secondary rounded-2xl shadow-lg">
                    <Upload className="h-8 w-8" />
              </div>
              <div className="text-left">
                    <h3 className="text-2xl font-bold text-foreground">Dosya Yükleme</h3>
                    <p className="text-muted-foreground font-medium">Çoklu dosya desteği</p>
              </div>
            </div>
                <p className="text-sm text-muted-foreground bg-secondary px-4 py-2 rounded-full inline-block">
              .pdf, .docx, .xlsx, .xls, .txt formatları • Maksimum 10MB
            </p>
          </div>
          
              <div
            className={`relative p-12 text-center rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group ${
              dragActive 
                    ? 'border-ring bg-muted scale-[1.02]' 
                    : 'border-border hover:border-ring hover:bg-muted'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput').click()}
          >
            <div className="absolute inset-0 rounded-2xl"></div>
            <div className="relative">
              <div className={`mx-auto mb-6 p-4 rounded-2xl transition-all duration-300 bg-secondary`}>
                <Upload className={`h-12 w-12 transition-transform duration-300 ${
                  dragActive ? 'scale-110' : 'group-hover:scale-110'
                }`} />
              </div>
              <h4 className="text-2xl font-bold text-neutral-100 mb-3">
                {dragActive ? 'Dosyaları Bırakın!' : 'Dosyalarınızı Sürükleyin'}
              </h4>
              <p className="text-muted-foreground mb-6 text-lg">
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
                className="bg-secondary border border-border hover:bg-muted text-foreground transition-all duration-300 px-8 py-3 text-lg font-semibold shadow-lg"
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
        <div className="relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-red-200/60 overflow-hidden">
          <div className="absolute inset-0 bg-red-50/70"></div>
          <div className="relative p-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-red-600 rounded-2xl shadow-lg">
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
        <div className="relative rounded-3xl shadow-2xl border border-border bg-card overflow-hidden">
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-secondary rounded-xl shadow-lg">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  Yükleme Durumu ({files.length})
                </h3>
              </div>
              <div className="bg-secondary text-foreground px-4 py-2 rounded-full text-sm font-medium shadow-lg border border-border">
                {files.filter(f => f.status === 'completed').length} / {files.length} Tamamlandı
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            {isUploading && (
              <div className="mb-6 p-4 rounded-2xl border border-border bg-background">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-foreground">Dosyalar yükleniyor...</span>
                  <span className="text-sm text-muted-foreground font-semibold">
                    {files.filter(f => f.status === 'completed').length} / {files.length}
                  </span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full bg-foreground/60 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${(files.filter(f => f.status === 'completed').length / files.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
    
            <div className="space-y-4">
              {files.map((fileObj) => (
                <div key={fileObj.id} className="relative rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
                  <div className="absolute inset-0"></div>
                  <div className="relative p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl shadow-lg bg-secondary flex-shrink-0`}>
                          {getStatusIcon(fileObj)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm truncate" title={fileObj.file.name}>
                              {fileObj.file.name}
                            </p>
                            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border bg-background text-foreground/70 border-border">
                              {getReadableType(fileObj)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{(fileObj.file.size / 1024 / 1024).toFixed(2)} MB</span>
                            {fileObj.status === 'error' && (
                              <>
                                <span className="w-1 h-1 bg-foreground/30 rounded-full"></span>
                                <span className="truncate max-w-[140px] sm:max-w-[240px]" title={fileObj.file.type}>
                                  {fileObj.file.type || 'Bilinmiyor'}
                                </span>
                              </>
                            )}
                          </div>
                          {fileObj.error && (
                            <div className="mt-2 p-2 bg-background border border-red-400/30 rounded-lg">
                              <p className="text-xs text-red-600 font-medium">{fileObj.error}</p>
                            </div>
                          )}
                          {fileObj.status === 'completed' && (
                            <div className="mt-2 w-full max-w-full p-2 border border-border rounded-lg bg-background overflow-hidden">
                              {processedMap[fileObj?.result?.documentId] ? (
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate whitespace-nowrap">
                                    İşleme tamamlandı, doküman eklendi.
                                  </p>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <p className="text-xs text-muted-foreground font-medium truncate whitespace-nowrap">
                                    Cloud Function işliyor, kısa süre sonra görünecek...
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {fileObj.status === 'uploading' && (
                          <div className="w-24 sm:w-32">
                            <Progress 
                              value={fileObj.progress?.progress || 0} 
                              className="h-2 bg-muted"
                            />
                          </div>
                        )}
                        {fileObj.status !== 'completed' && getStatusBadge(fileObj)}
                        {fileObj.status === 'error' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryFailedUploads()}
                            className="text-xs text-foreground border-border"
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