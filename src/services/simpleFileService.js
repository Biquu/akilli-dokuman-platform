import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL
} from 'firebase/storage';
import { 
  collection, 
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';

/**
 * Basitleştirilmiş File Service - Sadece Storage upload
 * Firestore'a yazma Cloud Function'da yapılacak
 */
export class SimpleFileService {
  

  /**
   * Dosya yükleme - Sadece Storage'a upload
   */
  static async uploadFile(file, onProgress = null, customMetadata = {}) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Dosya yolu: customMetadata.filePath varsa onu kullan; yoksa üret
      const filePath = (customMetadata && customMetadata.filePath)
        ? customMetadata.filePath
        : (() => {
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            return `documents/${timestamp}_${randomId}_${fileName}`;
          })();
      console.log('[FileService.uploadFile] START', {
        uploadId,
        fileName: file?.name,
        size: file?.size,
        type: file?.type,
        filePath,
        metaKeys: Object.keys(customMetadata || {})
      });
      
      const storageRef = ref(storage, filePath);
      // Storage metadata'ya filePath yazmayalım; sadece ref yolu olarak kullanıyoruz
      const { filePath: _omitFilePath, ...storageMeta } = customMetadata || {};
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || undefined,
        customMetadata: {
          originalFileName: file.name,
          ...storageMeta,
        }
      });

      // Promise ile upload'ı wrap et
      const uploadResult = await new Promise((resolve, reject) => {
        let lastLoggedProgress = -1; // yüzde bazlı temel log azaltma
        uploadTask.on('state_changed',
          // Progress
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress({
                progress: Math.round(progress),
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes
              });
            }
            const rounded = Math.floor(progress);
            if (rounded === 100 || rounded >= lastLoggedProgress + 25 || lastLoggedProgress < 0) {
              console.log('[FileService.uploadFile] PROGRESS', {
                uploadId,
                fileName: file?.name,
                progress: Math.round(progress),
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes
              });
              lastLoggedProgress = rounded;
            }
          },
          // Error
          (error) => {
            console.error('[FileService.uploadFile] ERROR', { uploadId, fileName: file?.name, message: error?.message, code: error?.code });
            reject(error);
          },
          // Success
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                success: true,
                downloadURL,
                storageRef: uploadTask.snapshot.ref.fullPath,
                storagePath: filePath,
                uploadId,
                metadata: {
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date().toISOString()
                }
              });
              console.log('[FileService.uploadFile] SUCCESS', {
                uploadId,
                fileName: file?.name,
                storagePath: filePath,
                storageRef: uploadTask.snapshot.ref.fullPath,
                downloadURLLength: downloadURL?.length
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      return uploadResult;

    } catch (error) {
      console.error('[FileService.uploadFile] FATAL', { uploadId, fileName: file?.name, message: error?.message, code: error?.code });
      throw new Error(`Dosya yükleme hatası: ${error.message}`);
    }
  }

  /**
   * Tam yükleme işlemi (sadece Storage upload)
   * Cloud Function otomatik olarak Firestore'a yazacak
   */
  static async uploadFileComplete(file, onProgress = null, metadata = {}) {
    try {
      console.log('[FileService.uploadFileComplete] START', {
        fileName: file?.name,
        size: file?.size,
        type: file?.type,
        metaKeys: Object.keys(metadata || {})
      });
      // Placeholder Firestore dokümanı oluştur
      const placeholderRef = doc(collection(db, 'documents'));
      const docId = placeholderRef.id;
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `documents/${timestamp}_${randomId}_${safeName}`;

      const ownerId = metadata.userId || metadata.ownerId || 'anonymous';
      const ownerName = metadata.ownerName || null;

      await setDoc(placeholderRef, {
        id: docId,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size || 0,
        filePath: storagePath,
        ownerId,
        ownerName,
        processingStatus: 'uploading',
        uploadedAt: serverTimestamp(),
        searchable: false,
      }, { merge: true });
      console.log('[FileService.uploadFileComplete] PLACEHOLDER_CREATED', { docId, storagePath, ownerId, ownerName });

      // Upload dosyayı (custom metadata ile)
      if (onProgress) onProgress({ stage: 'uploading', progress: 0, docId });
      console.log('[FileService.uploadFileComplete] UPLOAD_BEGIN', { docId, fileName: file?.name });
      
      const uploadResult = await this.uploadFile(file, (progressData) => {
        if (onProgress) {
          onProgress({
            stage: 'uploading',
            progress: progressData.progress,
            bytesTransferred: progressData.bytesTransferred,
            totalBytes: progressData.totalBytes
          });
        }
      }, { docId, userId: ownerId, ownerName, filePath: storagePath, fileLastModified: String(file.lastModified || '') });
      console.log('[FileService.uploadFileComplete] UPLOAD_RESULT', { docId, success: uploadResult?.success, storagePath });
      
      // Cloud Function'ın işlemesini bekle
      if (onProgress) onProgress({ stage: 'processing', progress: 90 });
      console.log('[FileService.uploadFileComplete] PROCESSING', { docId });
      
      // Not: Upload sonrası placeholder'ı tekrar 'uploaded' olarak güncellemiyoruz.
      // Cloud Function çok hızlı tamamlandığında 'completed' durumunu geriye düşürmemek için bu adımı kaldırdık.

      // Cloud Function otomatik olarak çalışacak ve Firestore'a yazacak
      // Burada sadece upload sonucunu döndür
      if (onProgress) onProgress({ stage: 'completed', progress: 100 });
      console.log('[FileService.uploadFileComplete] COMPLETED', { docId });
      
      return {
        success: true,
        file: uploadResult,
        documentId: docId,
        // Cloud Function'ın oluşturacağı document ID'si henüz bilinmiyor
        // Kullanıcı dokümanları yeniden yükleyerek görebilir
        message: 'Dosya yüklendi, işleniyor...'
      };

    } catch (error) {
      console.error('[FileService.uploadFileComplete] ERROR', { fileName: file?.name, message: error?.message, code: error?.code });
      
      if (onProgress) {
        onProgress({ 
          stage: 'error', 
          progress: 0, 
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Upload'ı iptal et (basit implementasyon)
   */
  static abortUpload(uploadId) {
    // Basit implementasyon - gerçek abort logic'i gerekirse eklenebilir
    console.warn('[FileService.abortUpload] Called without implementation', { uploadId });
    return false;
  }

  /**
   * Hatanın tekrar denenebilir olup olmadığını kontrol et
   */
  static isRetryableError(error) {
    const retryableMessages = [
      'network',
      'timeout',
      'unknown',
      'retry-limit-exceeded'
    ];
    
    const result = retryableMessages.some(msg => 
      error.message?.toLowerCase().includes(msg) || 
      error.code?.includes(msg)
    );
    console.log('[FileService.isRetryableError]', { message: error?.message, code: error?.code, retryable: result });
    return result;
  }

  /**
   * Firestore dokümanından storage yolu çıkar (güvenli)
   */
  static async getStoragePathFromDocument(documentId) {
    // Kaldırıldı: Artık kullanılmıyor.
    return null;
  }

  /**
   * Dosya silme - storage ve Firestore'dan (güvenli)
   */
  static async deleteFile(documentId) {
    try {
      console.log('[FileService.deleteFile] START', { documentId });
      // Önce Firestore dokümanını sil
      await deleteDoc(doc(db, 'documents', documentId));
      // Storage silme işini Cloud Function (onDocumentDelete) yapacak.
      // İstemcinin Storage delete izni yok; bu nedenle burada storage silmeye çalışmayız.
      console.log('[FileService.deleteFile] SUCCESS', { documentId });
      return { success: true, message: 'Dosya başarıyla silindi' };
    } catch (error) {
      console.error('[FileService.deleteFile] ERROR', { documentId, message: error?.message, code: error?.code });
      throw new Error(`Dosya silme hatası: ${error.message}`);
    }
  }

  /**
   * Çoklu dosya silme (id veya {id, storagePath} destekler)
   */
  static async deleteMultipleFiles(documentsData) {
    try {
      console.log('[FileService.deleteMultipleFiles] START', { count: documentsData?.length });
      const results = [];
      
      for (const item of documentsData) {
        const documentId = typeof item === 'string' ? item : item?.id;
        const storagePath = typeof item === 'object' ? item?.storagePath : undefined;
        if (!documentId) {
          results.push({ id: null, success: false, error: 'Geçersiz doküman' });
          continue;
        }
        try {
          await this.deleteFile(documentId);
          results.push({ id: documentId, success: true });
          console.log('[FileService.deleteMultipleFiles] ITEM_SUCCESS', { documentId });
        } catch (error) {
          results.push({ id: documentId, success: false, error: error.message });
          console.error('[FileService.deleteMultipleFiles] ITEM_ERROR', { documentId, message: error?.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      const summary = { total: documentsData.length, success: successCount, errors: errorCount };
      console.log('[FileService.deleteMultipleFiles] SUMMARY', summary);
      return {
        success: errorCount === 0,
        results,
        summary
      };
      
    } catch (error) {
      console.error('[FileService.deleteMultipleFiles] ERROR', { message: error?.message });
      throw new Error(`Çoklu dosya silme hatası: ${error.message}`);
    }
  }
}