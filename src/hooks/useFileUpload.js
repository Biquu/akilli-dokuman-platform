// Enterprise-Grade Custom Hook for File Upload Operations
import { useState, useCallback, useEffect, useRef } from 'react';
import { FileService, FileValidator } from '@/services/fileService';

/**
 * Enterprise-Grade Custom hook for handling file uploads
 * Provides comprehensive state management and error handling for file operations
 */
export function useFileUpload(options = {}) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    totalSize: 0,
    uploadedSize: 0
  });
  
  // Network status monitoring
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState(navigator.connection?.effectiveType || 'unknown');
  
  // Upload performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    averageSpeed: 0,
    totalTime: 0,
    successRate: 0
  });
  
  // Refs for cleanup
  const activeUploadsRef = useRef(new Map());
  const performanceStartRef = useRef(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleConnectionChange = () => {
      if (navigator.connection) {
        setConnectionType(navigator.connection.effectiveType);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if (navigator.connection) {
      navigator.connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const activeUploads = activeUploadsRef.current;
    return () => {
      // Abort any active uploads
      activeUploads.forEach((uploadInfo, uploadId) => {
        FileService.abortUpload(uploadId);
      });
      activeUploads.clear();
    };
  }, []);

  /**
   * Add files to upload queue with comprehensive validation
   */
  const addFiles = useCallback((selectedFiles, additionalOptions = {}) => {
    try {
      setError(null);
      setGlobalError(null);
      
      // Check network connectivity
      if (!isOnline) {
        const error = 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.';
        setGlobalError(error);
        return { success: false, error };
      }

      const fileArray = Array.from(selectedFiles);
      
      // Enhanced validation with security checks
      const validationOptions = {
        maxFileCount: options.maxFileCount || 10,
        maxBatchSize: options.maxBatchSize || 100 * 1024 * 1024, // 100MB
        allowedCategories: options.allowedCategories,
        ...additionalOptions
      };
      
      const validation = FileValidator.validateFiles(selectedFiles, validationOptions);
      
      // Handle validation errors
      if (validation.hasErrors) {
        const errorMessages = [
          ...validation.batchErrors,
          ...validation.invalidFiles.flatMap(item => item.validation.errors)
        ].join('\n');
        
        setError(errorMessages);
        return { success: false, error: errorMessages, validation };
      }

      // Handle security warnings
      if (validation.hasSecurity) {
        const securityMessage = validation.securityIssues
          .flatMap(item => item.validation.securityFlags)
          .join(', ');
        
        console.warn('Security flags detected:', securityMessage);
        
        if (!options.allowSecurityWarnings) {
          const error = 'Güvenlik nedeniyle bu dosyalar yüklenemez.';
          setError(error);
          return { success: false, error, validation };
        }
      }

      // Handle warnings (non-blocking)
      if (validation.filesWithWarnings.length > 0) {
        const warnings = validation.filesWithWarnings
          .flatMap(item => item.validation.warnings)
          .join('\n');
        console.warn('File warnings:', warnings);
      }
      
      // Create enhanced file objects with metadata
      const newFiles = validation.validFiles.map((file, index) => {
        const fileId = `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
          id: fileId,
          file,
          status: 'pending', // pending -> uploading -> completed -> error -> retrying
          progress: { 
            stage: 'pending', 
            progress: 0, 
            bytesTransferred: 0,
            totalBytes: file.size,
            speed: 0,
            eta: null
          },
          error: null,
          result: null,
          uploadId: null,
          startTime: null,
          endTime: null,
          retryCount: 0,
          maxRetries: options.maxRetries || 3,
          metadata: {
            addedAt: new Date().toISOString(),
            originalIndex: index,
            validationResult: validation.validFiles.find((_, i) => i === index) // Store validation info
          }
        };
      });
      
      // Update state
      setFiles(prev => [...prev, ...newFiles]);
      setUploadStats(prev => ({
        ...prev,
        total: prev.total + newFiles.length,
        totalSize: prev.totalSize + validation.totalSize
      }));

      // Start performance tracking if first upload
      if (files.length === 0 && newFiles.length > 0) {
        performanceStartRef.current = Date.now();
      }
      
      return { 
        success: true, 
        addedCount: newFiles.length,
        totalSize: validation.totalSize,
        validation,
        warnings: validation.filesWithWarnings.length > 0 ? 'Some files have warnings' : null
      };
      
    } catch (error) {
      console.error('Add files error:', error);
      const errorMessage = 'Dosya ekleme sırasında beklenmeyen bir hata oluştu.';
      setGlobalError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [isOnline, options, files.length]);

  /**
   * Upload a single file with comprehensive error handling and progress tracking
   */
  const uploadFile = useCallback(async (fileObj) => {
    const updateFile = (updates) => {
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, ...updates } : f
      ));
    };

    let startTime = Date.now();
    let uploadId = null;

    try {
      // Update file state to uploading
      updateFile({ 
        status: 'uploading',
        startTime,
        error: null
      });

      // Add to active uploads tracking
      activeUploadsRef.current.set(fileObj.id, {
        fileObj,
        startTime,
        abortController: new AbortController()
      });

      // Enhanced progress handler with performance metrics
      const progressHandler = (progressData) => {
        const now = Date.now();
        const elapsed = now - startTime;
        const speed = progressData.bytesTransferred / elapsed * 1000; // bytes per second
        const eta = speed > 0 ? (progressData.totalBytes - progressData.bytesTransferred) / speed : null;

        const enhancedProgress = {
          ...progressData,
          speed,
          eta,
          elapsed
        };

        updateFile({ progress: enhancedProgress });

        // Update upload ID when available
        if (progressData.uploadId && !uploadId) {
          uploadId = progressData.uploadId;
          updateFile({ uploadId });
        }
      };

      // Use enterprise service for upload
      const result = await FileService.uploadFileComplete(
        fileObj.file,
        progressHandler,
        {
          userId: options.userId,
          tags: options.defaultTags || [],
          category: options.defaultCategory,
          allowDuplicates: options.allowDuplicates || false
        }
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Update successful upload
      updateFile({ 
        status: 'completed', 
        result,
        endTime,
        progress: { 
          stage: 'completed', 
          progress: 100,
          totalTime
        }
      });
      
      // Update stats
      setUploadStats(prev => ({
        ...prev,
        completed: prev.completed + 1,
        uploadedSize: prev.uploadedSize + fileObj.file.size
      }));

      // Update performance metrics
      setPerformanceMetrics(prev => {
        const newTotalTime = prev.totalTime + totalTime;
        const newAverageSpeed = fileObj.file.size / totalTime * 1000; // bytes per second
        const newSuccessRate = (prev.successRate * prev.completed + 100) / (prev.completed + 1);
        
        return {
          averageSpeed: (prev.averageSpeed + newAverageSpeed) / 2,
          totalTime: newTotalTime,
          successRate: newSuccessRate
        };
      });
      
      return result;
      
    } catch (error) {
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Handle retry logic
      const canRetry = fileObj.retryCount < fileObj.maxRetries && 
                      FileService.isRetryableError && 
                      FileService.isRetryableError(error);
      
      if (canRetry) {
        updateFile({ 
          status: 'retrying',
          retryCount: fileObj.retryCount + 1,
          error: error.message,
          progress: { 
            stage: 'retrying', 
            progress: 0, 
            error: error.message,
            retryCount: fileObj.retryCount + 1,
            maxRetries: fileObj.maxRetries
          }
        });

        // Wait before retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, fileObj.retryCount), 10000);
        setTimeout(() => {
          uploadFile({ ...fileObj, retryCount: fileObj.retryCount + 1 });
        }, retryDelay);
        
        return null; // Don't throw error for retryable uploads
      }
      
      // Final failure
      updateFile({ 
        status: 'error', 
        error: error.message,
        endTime,
        progress: { 
          stage: 'error', 
          progress: 0, 
          error: error.message,
          totalTime,
          finalFailure: true
        }
      });
      
      setUploadStats(prev => ({ ...prev, failed: prev.failed + 1 }));
      
      // Update performance metrics for failed upload
      setPerformanceMetrics(prev => ({
        ...prev,
        successRate: (prev.successRate * uploadStats.completed) / (uploadStats.completed + 1)
      }));
      
      throw error;
      
    } finally {
      // Always cleanup tracking
      activeUploadsRef.current.delete(fileObj.id);
    }
  }, [options, uploadStats.completed]);

  /**
   * Upload all pending files
   */
  const uploadAllFiles = useCallback(async () => {
    if (isUploading) return;
    
    setIsUploading(true);
    setError(null);
    
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      setIsUploading(false);
      return;
    }
    
    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const fileObj of pendingFiles) {
        await uploadFile(fileObj);
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      setError(`Upload error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [files, isUploading, uploadFile]);

  /**
   * Upload files immediately when added (auto-upload)
   */
  const addAndUploadFiles = useCallback(async (selectedFiles) => {
    const addResult = addFiles(selectedFiles);
    
    if (!addResult.success) {
      return addResult;
    }
    
    // Auto-upload newly added files
    setTimeout(() => uploadAllFiles(), 100);
    
    return addResult;
  }, [addFiles, uploadAllFiles]);

  /**
   * Remove file from list
   */
  const removeFile = useCallback((fileId) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.id !== fileId);
      const removed = prev.find(f => f.id === fileId);
      
      if (removed) {
        if (removed.status === 'completed') {
          setUploadStats(stats => ({ ...stats, completed: stats.completed - 1 }));
        } else if (removed.status === 'error') {
          setUploadStats(stats => ({ ...stats, failed: stats.failed - 1 }));
        }
        setUploadStats(stats => ({ ...stats, total: stats.total - 1 }));
      }
      
      return newFiles;
    });
  }, []);

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
    setUploadStats({ total: 0, completed: 0, failed: 0 });
  }, []);

  /**
   * Retry failed uploads
   */
  const retryFailedUploads = useCallback(async () => {
    const failedFiles = files.filter(f => f.status === 'error');
    
    for (const fileObj of failedFiles) {
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, status: 'pending', error: null, progress: { stage: 'pending', progress: 0 } }
          : f
      ));
    }
    
    setUploadStats(prev => ({ 
      ...prev, 
      failed: prev.failed - failedFiles.length 
    }));
    
    await uploadAllFiles();
  }, [files, uploadAllFiles]);

  // Computed values
  const completedFiles = files.filter(f => f.status === 'completed');
  const pendingFiles = files.filter(f => f.status === 'pending');
  const errorFiles = files.filter(f => f.status === 'error');
  const uploadingFiles = files.filter(f => f.status === 'uploading');
  
  const isComplete = files.length > 0 && pendingFiles.length === 0 && uploadingFiles.length === 0;
  const hasErrors = errorFiles.length > 0;

  return {
    // Core State
    files,
    isUploading,
    error,
    globalError,
    uploadStats,
    
    // Network & Performance
    isOnline,
    connectionType,
    performanceMetrics,
    
    // Computed States
    completedFiles,
    pendingFiles,
    errorFiles,
    uploadingFiles,
    retryingFiles: files.filter(f => f.status === 'retrying'),
    isComplete,
    hasErrors,
    hasWarnings: files.some(f => f.metadata?.validationResult?.warnings?.length > 0),
    
    // Enhanced Statistics
    enhancedStats: {
      ...uploadStats,
      averageSpeed: performanceMetrics.averageSpeed,
      successRate: performanceMetrics.successRate,
      totalTime: performanceMetrics.totalTime,
      activeUploads: activeUploadsRef.current.size
    },
    
    // Core Actions
    addFiles,
    addAndUploadFiles,
    uploadFile,
    uploadAllFiles,
    removeFile,
    clearFiles,
    retryFailedUploads,
    
    // Enhanced Actions
    abortUpload: useCallback((fileId) => {
      const uploadInfo = activeUploadsRef.current.get(fileId);
      if (uploadInfo?.abortController) {
        uploadInfo.abortController.abort();
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: 'cancelled', error: 'Upload cancelled by user' }
            : f
        ));
        return true;
      }
      return false;
    }, []),
    
    abortAllUploads: useCallback(() => {
      let abortedCount = 0;
      activeUploadsRef.current.forEach((uploadInfo, fileId) => {
        if (uploadInfo.abortController) {
          uploadInfo.abortController.abort();
          abortedCount++;
        }
      });
      
      if (abortedCount > 0) {
        setFiles(prev => prev.map(f => 
          f.status === 'uploading' 
            ? { ...f, status: 'cancelled', error: 'Upload cancelled by user' }
            : f
        ));
      }
      
      return abortedCount;
    }, []),
    
    getFileById: useCallback((fileId) => {
      return files.find(f => f.id === fileId);
    }, [files]),
    
    getUploadProgress: useCallback(() => {
      if (files.length === 0) return { progress: 0, stage: 'idle' };
      
      const totalFiles = files.length;
      const completedFiles = files.filter(f => f.status === 'completed').length;
      const uploadingFiles = files.filter(f => f.status === 'uploading').length;
      const errorFiles = files.filter(f => f.status === 'error').length;
      
      const overallProgress = (completedFiles / totalFiles) * 100;
      
      let stage = 'idle';
      if (uploadingFiles > 0) stage = 'uploading';
      else if (completedFiles === totalFiles) stage = 'completed';
      else if (errorFiles > 0) stage = 'error';
      
      return {
        progress: Math.round(overallProgress),
        stage,
        completed: completedFiles,
        total: totalFiles,
        uploading: uploadingFiles,
        errors: errorFiles
      };
    }, [files])
  };
}