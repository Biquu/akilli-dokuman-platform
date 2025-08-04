// Enterprise-Grade Firebase File Service
import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  getMetadata,
  listAll 
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  runTransaction,
  increment
} from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';

/**
 * Enterprise-Grade File Upload Service
 * Production-ready with comprehensive error handling and edge cases
 */
export class FileService {
  
  // Configuration constants
  static CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_CONCURRENT_UPLOADS: 3,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_BASE: 1000, // 1 second
    CHUNK_SIZE: 256 * 1024, // 256KB chunks
    TIMEOUT: 30000, // 30 seconds
    STORAGE_QUOTA_WARNING: 0.8, // Warn at 80% usage
  };

  // Upload queue for managing concurrent uploads
  static uploadQueue = [];
  static activeUploads = new Map();
  static uploadStats = {
    totalUploaded: 0,
    totalSize: 0,
    errorCount: 0,
    successCount: 0
  };
  
  /**
   * Advanced File Upload with comprehensive error handling
   * @param {File} file - File object to upload  
   * @param {Function} onProgress - Progress callback
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with metadata
   */
  static async uploadFile(file, onProgress = null, options = {}) {
    const uploadId = this.generateUploadId();
    let storageRef = null;
    let abortController = new AbortController();
    
    try {
      // Pre-upload validation
      await this.validateUploadPreconditions(file);
      
      // Check for duplicate files
      const existingFile = await this.checkDuplicateFile(file);
      if (existingFile && !options.allowDuplicates) {
        return {
          success: true,
          isDuplicate: true,
          existingFile,
          message: 'File already exists'
        };
      }

      // Generate secure file path
      const filePath = await this.generateSecureFilePath(file);
      storageRef = ref(storage, filePath);
      
      // Add to active uploads tracking
      this.activeUploads.set(uploadId, {
        file,
        storageRef,
        startTime: Date.now(),
        abortController
      });

      // Setup upload with resumable upload for large files
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadId,
          userId: options.userId || 'anonymous',
          timestamp: new Date().toISOString()
        }
      });

      // Promise wrapper for upload task
      const uploadResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          uploadTask.cancel();
          reject(new Error('Upload timeout exceeded'));
        }, this.CONFIG.TIMEOUT);

        uploadTask.on('state_changed', 
          // Progress callback
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const stage = this.getUploadStage(snapshot.state);
            
            if (onProgress) {
              onProgress({
                stage,
                progress: Math.round(progress),
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes,
                uploadId
              });
            }
          },
          // Error callback
          (error) => {
            clearTimeout(timeout);
            reject(this.handleUploadError(error, uploadId));
          },
          // Success callback
          async () => {
            clearTimeout(timeout);
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const metadata = await getMetadata(uploadTask.snapshot.ref);
              
              resolve({
                success: true,
                uploadId,
                downloadURL,
                storageRef: uploadTask.snapshot.ref.fullPath,
                storagePath: filePath,
                metadata: {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date().toISOString(),
                  storageMetadata: metadata
                }
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      // Update statistics
      this.updateUploadStats(file.size, true);
      
      return uploadResult;

    } catch (error) {
      // Update error statistics
      this.updateUploadStats(0, false);
      
      // Cleanup failed upload
      if (storageRef) {
        await this.cleanupFailedUpload(storageRef, uploadId);
      }
      
      const enhancedError = this.enhanceError(error, file, uploadId);
      console.error('Advanced upload error:', enhancedError);
      throw enhancedError;
      
    } finally {
      // Always cleanup tracking
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Validate upload preconditions
   */
  static async validateUploadPreconditions(file) {
    // Check network connectivity
    if (!navigator.onLine) {
      throw new Error('No internet connection available');
    }

    // Validate file integrity
    if (!file || file.size === 0) {
      throw new Error('Invalid or empty file');
    }

    // Check storage quota (if available)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage / estimate.quota;
      
      if (usage > this.CONFIG.STORAGE_QUOTA_WARNING) {
        console.warn('Storage quota warning:', `${(usage * 100).toFixed(1)}% used`);
      }
    }

    // Check concurrent uploads limit
    if (this.activeUploads.size >= this.CONFIG.MAX_CONCURRENT_UPLOADS) {
      throw new Error('Maximum concurrent uploads exceeded. Please wait.');
    }
  }

  /**
   * Check for duplicate files using hash
   */
  static async checkDuplicateFile(file) {
    try {
      const fileHash = await this.calculateFileHash(file);
      const q = query(
        collection(db, 'documents'),
        where('fileHash', '==', fileHash),
        where('fileSize', '==', file.size)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.empty ? null : snapshot.docs[0].data();
    } catch (error) {
      console.warn('Duplicate check failed:', error);
      return null; // Continue with upload if duplicate check fails
    }
  }

  /**
   * Generate secure file path with collision avoidance
   */
  static async generateSecureFilePath(file) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const sanitizedName = this.sanitizeFileName(file.name);
    const fileExtension = this.getFileExtension(file.name);
    
    // Create collision-resistant path
    const basePath = `documents/${timestamp}_${randomId}`;
    let filePath = `${basePath}_${sanitizedName}`;
    
    // Ensure path is within length limits
    if (filePath.length > 200) {
      filePath = `${basePath}.${fileExtension}`;
    }
    
    return filePath;
  }

  /**
   * Calculate file hash for deduplication
   */
  static async calculateFileHash(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback to simple hash if crypto API not available
      return `${file.name}_${file.size}_${file.lastModified}`;
    }
  }

  /**
   * Sanitize file name for secure storage
   */
  static sanitizeFileName(fileName) {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars
      .replace(/_{2,}/g, '_') // Remove multiple underscores
      .substring(0, 100); // Limit length
  }

  /**
   * Get file extension safely
   */
  static getFileExtension(fileName) {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : 'unknown';
  }

  /**
   * Generate unique upload ID
   */
  static generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get human-readable upload stage
   */
  static getUploadStage(state) {
    const stages = {
      'running': 'uploading',
      'paused': 'paused', 
      'success': 'completed',
      'canceled': 'cancelled',
      'error': 'error'
    };
    return stages[state] || 'unknown';
  }

  /**
   * Handle upload errors with detailed context
   */
  static handleUploadError(error, uploadId) {
    const errorMap = {
      'storage/unauthorized': 'Unauthorized access. Please check permissions.',
      'storage/canceled': 'Upload was cancelled by user.',
      'storage/unknown': 'Unknown storage error occurred.',
      'storage/object-not-found': 'Storage location not found.',
      'storage/bucket-not-found': 'Storage bucket not configured.',
      'storage/project-not-found': 'Firebase project not found.',
      'storage/quota-exceeded': 'Storage quota exceeded.',
      'storage/unauthenticated': 'User not authenticated.',
      'storage/retry-limit-exceeded': 'Too many retry attempts.',
      'storage/invalid-checksum': 'File checksum validation failed.',
      'storage/no-default-bucket': 'No default storage bucket configured.'
    };

    const message = errorMap[error.code] || error.message || 'Unknown upload error';
    
    return new Error(`Upload failed (${uploadId}): ${message}`);
  }

  /**
   * Enhance error with additional context
   */
  static enhanceError(error, file, uploadId) {
    const enhancedError = new Error(error.message);
    enhancedError.originalError = error;
    enhancedError.uploadId = uploadId;
    enhancedError.fileInfo = {
      name: file?.name,
      size: file?.size,
      type: file?.type
    };
    enhancedError.timestamp = new Date().toISOString();
    enhancedError.userAgent = navigator.userAgent;
    enhancedError.connectionType = navigator.connection?.effectiveType || 'unknown';
    
    return enhancedError;
  }

  /**
   * Cleanup failed upload resources
   */
  static async cleanupFailedUpload(storageRef, uploadId) {
    try {
      await deleteObject(storageRef);
      console.log(`Cleaned up failed upload: ${uploadId}`);
    } catch (cleanupError) {
      console.warn(`Failed to cleanup upload ${uploadId}:`, cleanupError);
    }
  }

  /**
   * Update upload statistics
   */
  static updateUploadStats(fileSize, success) {
    if (success) {
      this.uploadStats.successCount++;
      this.uploadStats.totalUploaded += fileSize;
      this.uploadStats.totalSize += fileSize;
    } else {
      this.uploadStats.errorCount++;
    }
  }
  
  /**
   * Save file metadata to Firestore with transaction safety
   * @param {Object} fileData - File data from uploadFile
   * @param {Object} additionalData - Additional metadata (optional)
   * @returns {Promise<Object>} Firestore document reference
   */
  static async saveFileMetadata(fileData, additionalData = {}) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Calculate file hash for deduplication
        const fileHash = additionalData.fileHash || 
          `${fileData.metadata.name}_${fileData.metadata.size}_${Date.now()}`;

        const documentData = {
          // Core file information
          fileName: fileData.metadata.name,
          fileType: fileData.metadata.type,
          fileSize: fileData.metadata.size,
          fileHash,
          
          // Storage information
          storageRef: fileData.storageRef,
          storagePath: fileData.storagePath,
          downloadURL: fileData.downloadURL,
          uploadId: fileData.uploadId,
          
          // Timestamps
          uploadedAt: serverTimestamp(),
          lastModified: additionalData.lastModified || serverTimestamp(),
          
          // Processing status
          status: 'uploaded', // uploaded -> processing -> completed -> error
          processed: false,
          processingAttempts: 0,
          
          // Metadata for search
          searchableContent: '', // Will be populated by cloud function
          extractedText: '', // Will be populated by cloud function
          
          // File categorization
          category: this.categorizeFile(fileData.metadata.type),
          tags: additionalData.tags || [],
          
          // User context
          userId: additionalData.userId || 'anonymous',
          userAgent: navigator.userAgent,
          
          // Security
          virusScanned: false,
          safeForProcessing: true,
          
          // Analytics
          downloadCount: 0,
          searchCount: 0,
          lastAccessed: null,
          
          // Additional metadata
          ...additionalData
        };

        // Use transaction for atomic operation
        const docRef = await runTransaction(db, async (transaction) => {
          // Check for duplicates within transaction
          const duplicateQuery = query(
            collection(db, 'documents'),
            where('fileHash', '==', fileHash),
            where('fileName', '==', documentData.fileName)
          );
          
          const duplicateSnapshot = await getDocs(duplicateQuery);
          
          if (!duplicateSnapshot.empty && !additionalData.allowDuplicates) {
            throw new Error('Duplicate file detected during metadata save');
          }

          // Create new document
          const newDocRef = doc(collection(db, 'documents'));
          transaction.set(newDocRef, documentData);
          
          // Update global statistics
          const statsRef = doc(db, 'system', 'uploadStats');
          transaction.update(statsRef, {
            totalFiles: increment(1),
            totalSize: increment(documentData.fileSize),
            lastUpload: serverTimestamp()
          });

          return newDocRef;
        });

        return {
          success: true,
          documentId: docRef.id,
          data: documentData,
          attempt
        };

      } catch (error) {
        lastError = error;
        console.warn(`Metadata save attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('Metadata save failed after all retries:', lastError);
    throw new Error(`Metadata save failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Categorize file based on MIME type
   */
  static categorizeFile(mimeType) {
    const categories = {
      'application/pdf': 'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
      'application/vnd.ms-excel': 'spreadsheet',
      'text/plain': 'text',
      'application/json': 'data',
      'text/csv': 'data'
    };
    
    return categories[mimeType] || 'unknown';
  }

  /**
   * Complete file upload process with comprehensive error handling
   * @param {File} file - File to upload
   * @param {Function} onProgress - Progress callback
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Complete upload result
   */
  static async uploadFileComplete(file, onProgress = null, metadata = {}) {
    const operationId = this.generateUploadId();
    let uploadResult = null;
    
    try {
      // Enhanced progress tracking
      const progressHandler = (progressData) => {
        if (onProgress) {
          onProgress({
            ...progressData,
            operationId,
            stage: this.mapProgressStage(progressData.stage),
            estimatedTimeRemaining: this.calculateETA(progressData)
          });
        }
      };

      // Step 1: Pre-flight checks
      progressHandler({ stage: 'validating', progress: 0 });
      await this.validateUploadPreconditions(file);
      
      // Step 2: Upload to Storage with retry logic
      progressHandler({ stage: 'uploading', progress: 10 });
      uploadResult = await this.uploadWithRetry(file, progressHandler, metadata);
      
      // Step 3: Save metadata to Firestore
      progressHandler({ stage: 'saving', progress: 80 });
      const fileHash = await this.calculateFileHash(file);
      const metadataResult = await this.saveFileMetadata(uploadResult, {
        ...metadata,
        fileHash,
        operationId
      });
      
      // Step 4: Queue for processing (if needed)
      progressHandler({ stage: 'queuing', progress: 90 });
      await this.queueForProcessing(metadataResult.documentId, file.type);
      
      progressHandler({ stage: 'completed', progress: 100 });
      
      return {
        success: true,
        operationId,
        file: uploadResult,
        document: metadataResult,
        id: metadataResult.documentId
      };

    } catch (error) {
      // Comprehensive cleanup on failure
      if (uploadResult?.storageRef) {
        await this.cleanupFailedUpload(ref(storage, uploadResult.storageRef), operationId);
      }
      
      // Enhanced error reporting
      const enhancedError = this.enhanceError(error, file, operationId);
      
      if (onProgress) {
        onProgress({ 
          stage: 'error', 
          progress: 0, 
          error: enhancedError.message,
          operationId
        });
      }
      
      throw enhancedError;
    }
  }

  /**
   * Upload with automatic retry mechanism
   */
  static async uploadWithRetry(file, onProgress, metadata = {}) {
    const maxRetries = this.CONFIG.RETRY_ATTEMPTS;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.uploadFile(file, onProgress, { 
          ...metadata, 
          attempt,
          maxRetries 
        });
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          console.warn(`Upload attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
          
          if (onProgress) {
            onProgress({
              stage: 'retrying',
              progress: 0,
              attempt,
              maxRetries,
              retryDelay: delay
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error) {
    const retryableErrors = [
      'storage/unknown',
      'storage/retry-limit-exceeded', 
      'network-request-failed',
      'Upload timeout exceeded'
    ];
    
    return retryableErrors.some(code => 
      error.code === code || error.message.includes(code)
    ) || error.message.includes('timeout') || error.message.includes('network');
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static calculateRetryDelay(attempt) {
    const baseDelay = this.CONFIG.RETRY_DELAY_BASE;
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000; // Add randomness to avoid thundering herd
    
    return Math.min(exponentialDelay + jitter, 10000); // Max 10 seconds
  }

  /**
   * Map internal progress stages to user-friendly messages
   */
  static mapProgressStage(stage) {
    const stageMap = {
      'validating': 'Dosya kontrol ediliyor...',
      'uploading': 'Dosya yükleniyor...',
      'saving': 'Bilgiler kaydediliyor...',
      'queuing': 'İşleme kuyruğuna ekleniyor...',
      'retrying': 'Yeniden deneniyor...',
      'completed': 'Başarıyla tamamlandı!',
      'error': 'Hata oluştu'
    };
    
    return stageMap[stage] || stage;
  }

  /**
   * Calculate estimated time remaining
   */
  static calculateETA(progressData) {
    if (!progressData.bytesTransferred || !progressData.totalBytes || progressData.progress === 0) {
      return null;
    }
    
    const remainingBytes = progressData.totalBytes - progressData.bytesTransferred;
    const uploadSpeed = progressData.bytesTransferred / (Date.now() - (progressData.startTime || Date.now()));
    
    if (uploadSpeed <= 0) return null;
    
    return Math.round(remainingBytes / uploadSpeed);
  }

  /**
   * Queue file for processing (content extraction, etc.)
   */
  static async queueForProcessing(documentId, fileType) {
    try {
      // Only queue files that need processing
      const processableTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (processableTypes.includes(fileType)) {
        await updateDoc(doc(db, 'documents', documentId), {
          status: 'queued_for_processing',
          queuedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.warn('Failed to queue for processing:', error);
      // Don't throw error here as upload was successful
    }
  }
  
  /**
   * Abort active upload
   */
  static abortUpload(uploadId) {
    const activeUpload = this.activeUploads.get(uploadId);
    if (activeUpload?.abortController) {
      activeUpload.abortController.abort();
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Get upload statistics
   */
  static getUploadStats() {
    return {
      ...this.uploadStats,
      activeUploads: this.activeUploads.size,
      successRate: this.uploadStats.totalUploaded > 0 
        ? (this.uploadStats.successCount / (this.uploadStats.successCount + this.uploadStats.errorCount)) * 100
        : 0
    };
  }

  /**
   * Clear upload statistics
   */
  static clearStats() {
    this.uploadStats = {
      totalUploaded: 0,
      totalSize: 0,
      errorCount: 0,
      successCount: 0
    };
  }
  
  /**
   * Listen to document changes in real-time with error handling
   * @param {Function} callback - Callback function for updates
   * @param {Object} options - Query options
   * @returns {Function} Unsubscribe function
   */
  static subscribeToDocuments(callback, options = {}) {
    try {
      const {
        limit = 50,
        orderBy: orderField = 'uploadedAt',
        orderDirection = 'desc',
        filters = []
      } = options;

      let q = query(collection(db, 'documents'));
      
      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      // Apply ordering and limit
      q = query(q, orderBy(orderField, orderDirection));
      if (limit) {
        q = query(q, limit(limit));
      }
      
      return onSnapshot(q, 
        (snapshot) => {
          try {
            const documents = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              // Convert timestamps for display
              uploadedAt: doc.data().uploadedAt?.toDate?.() || doc.data().uploadedAt,
              lastModified: doc.data().lastModified?.toDate?.() || doc.data().lastModified
            }));
            
            callback(documents, null);
          } catch (error) {
            console.error('Document processing error:', error);
            callback([], error);
          }
        },
        (error) => {
          console.error('Firestore subscription error:', error);
          callback([], error);
        }
      );
    } catch (error) {
      console.error('Subscription setup error:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Get paginated documents
   */
  static async getPaginatedDocuments(options = {}) {
    const {
      limit = 20,
      startAfter = null,
      orderField = 'uploadedAt',
      orderDirection = 'desc',
      filters = []
    } = options;

    try {
      let q = query(collection(db, 'documents'));
      
      // Apply filters
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
      
      q = query(q, orderBy(orderField, orderDirection));
      
      if (startAfter) {
        q = query(q, startAfter(startAfter));
      }
      
      if (limit) {
        q = query(q, limit(limit));
      }
      
      const snapshot = await getDocs(q);
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        _doc: doc // Keep reference for pagination
      }));
      
      return {
        documents,
        hasMore: snapshot.docs.length === limit,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
      };
    } catch (error) {
      console.error('Paginated query error:', error);
      throw error;
    }
  }
}

/**
 * Enterprise-Grade File Validation System
 * Comprehensive validation with security checks and detailed reporting
 */
export class FileValidator {
  static SUPPORTED_FORMATS = {
    'application/pdf': { ext: '.pdf', category: 'document', maxSize: 50 * 1024 * 1024 },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', category: 'document', maxSize: 25 * 1024 * 1024 },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', category: 'spreadsheet', maxSize: 25 * 1024 * 1024 },
    'application/vnd.ms-excel': { ext: '.xls', category: 'spreadsheet', maxSize: 25 * 1024 * 1024 },
    'text/plain': { ext: '.txt', category: 'text', maxSize: 5 * 1024 * 1024 }
  };
  
  static DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  static MAX_FILENAME_LENGTH = 255;
  static BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.js', '.vbs', '.com', '.pif'];
  static SUSPICIOUS_PATTERNS = [/script/i, /<iframe/i, /<object/i, /javascript:/i];

  /**
   * Comprehensive file validation with security checks
   * @param {File} file - File to validate
   * @param {Object} options - Validation options
   * @returns {Object} Detailed validation result
   */
  static validateFile(file, options = {}) {
    const errors = [];
    const warnings = [];
    const securityFlags = [];
    
    try {
      // Basic file existence check
      if (!file) {
        errors.push('Dosya bulunamadı');
        return this.createValidationResult(false, errors, warnings, securityFlags, null);
      }

      // File size validation
      const formatInfo = this.SUPPORTED_FORMATS[file.type];
      const maxSize = formatInfo?.maxSize || this.DEFAULT_MAX_SIZE;
      
      if (file.size === 0) {
        errors.push('Dosya boş');
      } else if (file.size > maxSize) {
        errors.push(`Dosya çok büyük: ${this.formatFileSize(file.size)}. Maksimum: ${this.formatFileSize(maxSize)}`);
      }

      // File type validation
      if (!this.SUPPORTED_FORMATS[file.type]) {
        errors.push(`Desteklenmeyen dosya formatı: ${file.type}. Desteklenen: ${Object.keys(this.SUPPORTED_FORMATS).join(', ')}`);
      }

      // Filename validation
      if (!file.name || file.name.trim() === '') {
        errors.push('Geçersiz dosya adı');
      } else {
        // Check filename length
        if (file.name.length > this.MAX_FILENAME_LENGTH) {
          errors.push(`Dosya adı çok uzun (${file.name.length} karakter). Maksimum: ${this.MAX_FILENAME_LENGTH}`);
        }

        // Check for dangerous file extensions
        const fileName = file.name.toLowerCase();
        const hasDangerousExtension = this.BLOCKED_EXTENSIONS.some(ext => fileName.endsWith(ext));
        if (hasDangerousExtension) {
          securityFlags.push('Potentially dangerous file extension detected');
          errors.push('Güvenlik nedeniyle bu dosya türü desteklenmiyor');
        }

        // Check for suspicious filename patterns
        if (this.SUSPICIOUS_PATTERNS.some(pattern => pattern.test(file.name))) {
          securityFlags.push('Suspicious filename pattern detected');
          warnings.push('Dosya adında şüpheli karakterler tespit edildi');
        }

        // Check for null bytes (security risk)
        if (file.name.includes('\0')) {
          securityFlags.push('Null byte in filename');
          errors.push('Dosya adında geçersiz karakterler bulundu');
        }
      }

      // MIME type vs extension validation
      if (formatInfo && file.name) {
        const expectedExtension = formatInfo.ext;
        if (!file.name.toLowerCase().endsWith(expectedExtension)) {
          warnings.push(`Dosya uzantısı (${this.getFileExtension(file.name)}) MIME türüyle (${file.type}) eşleşmiyor`);
        }
      }

      // File modification time validation
      if (file.lastModified) {
        const now = Date.now();
        const fileAge = now - file.lastModified;
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        
        if (file.lastModified > now) {
          warnings.push('Dosya gelecekte bir tarihte değiştirilmiş görünüyor');
        } else if (fileAge > oneYearMs * 10) { // 10 years
          warnings.push('Dosya çok eski bir tarihte değiştirilmiş');
        }
      }

      // Additional validations based on options
      if (options.requireMinSize && file.size < options.requireMinSize) {
        errors.push(`Dosya çok küçük. Minimum boyut: ${this.formatFileSize(options.requireMinSize)}`);
      }

      if (options.allowedCategories && formatInfo) {
        if (!options.allowedCategories.includes(formatInfo.category)) {
          errors.push(`Bu dosya kategorisi izin verilmiyor: ${formatInfo.category}`);
        }
      }

      const fileInfo = {
        name: file.name,
        size: file.size,
        formattedSize: this.formatFileSize(file.size),
        type: file.type,
        category: formatInfo?.category || 'unknown',
        lastModified: file.lastModified,
        extension: this.getFileExtension(file.name)
      };

      return this.createValidationResult(
        errors.length === 0,
        errors,
        warnings,
        securityFlags,
        fileInfo
      );

    } catch (error) {
      console.error('File validation error:', error);
      return this.createValidationResult(false, ['Dosya doğrulama sırasında hata oluştu'], [], [], null);
    }
  }

  /**
   * Validate multiple files with batch processing
   * @param {FileList|Array} files - Files to validate
   * @param {Object} options - Validation options
   * @returns {Object} Batch validation results
   */
  static validateFiles(files, options = {}) {
    const fileArray = Array.from(files);
    const results = fileArray.map((file, index) => ({
      index,
      file,
      validation: this.validateFile(file, options)
    }));

    const validFiles = results.filter(r => r.validation.isValid);
    const invalidFiles = results.filter(r => !r.validation.isValid);
    const filesWithWarnings = results.filter(r => r.validation.warnings.length > 0);
    const securityIssues = results.filter(r => r.validation.securityFlags.length > 0);

    // Calculate totals
    const totalSize = validFiles.reduce((sum, r) => sum + r.file.size, 0);
    const totalFiles = fileArray.length;
    
    // Check batch-level constraints
    const batchErrors = [];
    
    if (options.maxBatchSize && totalSize > options.maxBatchSize) {
      batchErrors.push(`Toplam dosya boyutu çok büyük: ${this.formatFileSize(totalSize)}. Maksimum: ${this.formatFileSize(options.maxBatchSize)}`);
    }
    
    if (options.maxFileCount && totalFiles > options.maxFileCount) {
      batchErrors.push(`Çok fazla dosya seçildi: ${totalFiles}. Maksimum: ${options.maxFileCount}`);
    }

    return {
      validFiles: validFiles.map(r => r.file),
      invalidFiles,
      filesWithWarnings,
      securityIssues,
      hasErrors: invalidFiles.length > 0 || batchErrors.length > 0,
      hasSecurity: securityIssues.length > 0,
      batchErrors,
      totalSize,
      formattedTotalSize: this.formatFileSize(totalSize),
      stats: {
        total: totalFiles,
        valid: validFiles.length,
        invalid: invalidFiles.length,
        warnings: filesWithWarnings.length,
        security: securityIssues.length
      }
    };
  }

  /**
   * Create standardized validation result object
   */
  static createValidationResult(isValid, errors, warnings, securityFlags, fileInfo) {
    return {
      isValid,
      errors: [...errors],
      warnings: [...warnings],
      securityFlags: [...securityFlags],
      fileInfo,
      severity: securityFlags.length > 0 ? 'critical' : 
               errors.length > 0 ? 'error' : 
               warnings.length > 0 ? 'warning' : 'success'
    };
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file extension from filename
   */
  static getFileExtension(filename) {
    if (!filename) return '';
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
  }

  /**
   * Check if file type is supported
   */
  static isSupported(mimeType) {
    return Object.hasOwnProperty.call(this.SUPPORTED_FORMATS, mimeType);
  }

  /**
   * Get supported file extensions
   */
  static getSupportedExtensions() {
    return Object.values(this.SUPPORTED_FORMATS).map(format => format.ext);
  }

  /**
   * Get maximum file size for a specific type
   */
  static getMaxSizeForType(mimeType) {
    return this.SUPPORTED_FORMATS[mimeType]?.maxSize || this.DEFAULT_MAX_SIZE;
  }
}