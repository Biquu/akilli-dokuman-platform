/**
 * Basitleştirilmiş File Validator
 */
export class SimpleFileValidator {
  static SUPPORTED_TYPES = {
    'application/pdf': { ext: '.pdf', maxSize: 50 * 1024 * 1024 },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', maxSize: 25 * 1024 * 1024 },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', maxSize: 25 * 1024 * 1024 },
    'application/vnd.ms-excel': { ext: '.xls', maxSize: 25 * 1024 * 1024 },
    'text/plain': { ext: '.txt', maxSize: 5 * 1024 * 1024 }
  };

  static DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Tek dosya validation
   */
  static validateFile(file) {
    const errors = [];
    
    if (!file || file.size === 0) {
      errors.push('Dosya boş veya geçersiz');
      return { isValid: false, errors };
    }

    // Dosya tipi kontrolü
    if (!this.SUPPORTED_TYPES[file.type]) {
      errors.push(`Desteklenmeyen dosya formatı: ${file.type}`);
    }

    // Dosya boyutu kontrolü
    const maxSize = this.SUPPORTED_TYPES[file.type]?.maxSize || this.DEFAULT_MAX_SIZE;
    if (file.size > maxSize) {
      errors.push(`Dosya çok büyük: ${this.formatFileSize(file.size)}. Maksimum: ${this.formatFileSize(maxSize)}`);
    }

    // Dosya adı kontrolü
    if (!file.name || file.name.trim() === '') {
      errors.push('Geçersiz dosya adı');
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileInfo: {
        name: file.name,
        size: file.size,
        formattedSize: this.formatFileSize(file.size),
        type: file.type
      }
    };
  }

  /**
   * Çoklu dosya validation
   */
  static validateFiles(files, options = {}) {
    const fileArray = Array.from(files);
    const results = fileArray.map(file => ({
      file,
      validation: this.validateFile(file)
    }));

    const validFiles = results.filter(r => r.validation.isValid);
    const invalidFiles = results.filter(r => !r.validation.isValid);
    
    const totalSize = validFiles.reduce((sum, r) => sum + r.file.size, 0);
    const batchErrors = [];
    
    // Batch kontrolleri
    if (options.maxFileCount && fileArray.length > options.maxFileCount) {
      batchErrors.push(`Çok fazla dosya: ${fileArray.length}. Maksimum: ${options.maxFileCount}`);
    }
    
    if (options.maxBatchSize && totalSize > options.maxBatchSize) {
      batchErrors.push(`Toplam boyut çok büyük: ${this.formatFileSize(totalSize)}`);
    }

    return {
      validFiles: validFiles.map(r => r.file),
      invalidFiles,
      filesWithWarnings: [], // Basit implementasyon için boş array
      hasErrors: invalidFiles.length > 0 || batchErrors.length > 0,
      hasSecurity: false, // SimpleValidator'da security kontrolü yok
      batchErrors,
      totalSize,
      formattedTotalSize: this.formatFileSize(totalSize),
      stats: {
        total: fileArray.length,
        valid: validFiles.length,
        invalid: invalidFiles.length,
        warnings: 0,
        security: 0
      }
    };
  }

  /**
   * Dosya boyutunu formatla
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Desteklenen dosya tiplerini al
   */
  static getSupportedTypes() {
    return Object.keys(this.SUPPORTED_TYPES);
  }
}