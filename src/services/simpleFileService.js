import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  limit,
  getDoc
} from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';

/**
 * Basitleştirilmiş File Service - Sadece Storage upload
 * Firestore'a yazma Cloud Function'da yapılacak
 */
export class SimpleFileService {
  static activeUploads = new Map();

  /**
   * Duplicate kontrol fonksiyonu
   */
  static async checkForDuplicate(fileName, contentType, fileSize, allowDuplicates = true) {
    try {
      if (allowDuplicates) {
        return { isDuplicate: false };
      }
      // Son 1 saat içinde aynı dosya adı ve boyutu ile yüklenen dosya var mı?
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existingDocs = await getDocs(
        query(
          collection(db, 'documents'),
          where('fileName', '==', fileName),
          where('contentType', '==', contentType),
          where('size', '==', fileSize),
          limit(1)
        )
      );
      
      if (!existingDocs.empty) {
        console.log(`Duplicate detected for fileName: ${fileName}`);
        return { isDuplicate: true, existingDoc: existingDocs.docs[0] };
      }
      
      return { isDuplicate: false };
    } catch (error) {
      console.error('Duplicate check error:', error);
      return { isDuplicate: false, error: error.message };
    }
  }

  /**
   * Dosya yükleme - Sadece Storage'a upload
   */
  static async uploadFile(file, onProgress = null, customMetadata = {}) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Duplicate kontrolü (isteğe bağlı)
      const duplicateCheck = await this.checkForDuplicate(
        file.name,
        file.type,
        file.size,
        Boolean(customMetadata.allowDuplicates ?? true)
      );
      if (duplicateCheck.isDuplicate) {
        throw new Error(`Bu dosya zaten yüklenmiş: ${file.name}`);
      }

      // Dosya yolu oluştur
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `documents/${timestamp}_${randomId}_${fileName}`;
      
      const storageRef = ref(storage, filePath);
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type || undefined,
        customMetadata: {
          originalFileName: file.name,
          ...customMetadata,
        }
      });

      // Promise ile upload'ı wrap et
      const uploadResult = await new Promise((resolve, reject) => {
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
          },
          // Error
          (error) => reject(error),
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
            } catch (error) {
              reject(error);
            }
          }
        );
      });

      return uploadResult;

    } catch (error) {
      console.error('Upload error:', error);
      throw new Error(`Dosya yükleme hatası: ${error.message}`);
    }
  }

  /**
   * Tam yükleme işlemi (sadece Storage upload)
   * Cloud Function otomatik olarak Firestore'a yazacak
   */
  static async uploadFileComplete(file, onProgress = null, metadata = {}) {
    try {
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
        storagePath,
        ownerId,
        ownerName,
        author: ownerName || 'Bilinmeyen Kullanıcı',
        title: file.name,
        createdAt: file.lastModified ? new Date(file.lastModified) : serverTimestamp(),
        processingStatus: 'uploading',
        uploadedAt: serverTimestamp(),
        searchable: false,
      }, { merge: true });

      // Upload dosyayı (custom metadata ile)
      if (onProgress) onProgress({ stage: 'uploading', progress: 0, docId });
      
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
      
      // Cloud Function'ın işlemesini bekle
      if (onProgress) onProgress({ stage: 'processing', progress: 90 });
      
      // Hızlı geri bildirim için placeholder'ı güncelle
      try {
        await updateDoc(placeholderRef, {
          processingStatus: 'uploaded',
          downloadURL: uploadResult.downloadURL || null,
          uploadedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Placeholder update after upload failed:', e);
      }

      // Cloud Function otomatik olarak çalışacak ve Firestore'a yazacak
      // Burada sadece upload sonucunu döndür
      if (onProgress) onProgress({ stage: 'completed', progress: 100 });
      
      return {
        success: true,
        file: uploadResult,
        documentId: docId,
        // Cloud Function'ın oluşturacağı document ID'si henüz bilinmiyor
        // Kullanıcı dokümanları yeniden yükleyerek görebilir
        message: 'Dosya yüklendi, işleniyor...'
      };

    } catch (error) {
      console.error('Complete upload error:', error);
      
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
    
    return retryableMessages.some(msg => 
      error.message?.toLowerCase().includes(msg) || 
      error.code?.includes(msg)
    );
  }

  /**
   * Firestore dokümanından storage yolu çıkar (güvenli)
   */
  static async getStoragePathFromDocument(documentId) {
    try {
      const snapshot = await getDoc(doc(db, 'documents', documentId));
      if (!snapshot.exists()) return null;
      const data = snapshot.data() || {};
      return data.storagePath || data.filePath || data.storageRef || null;
    } catch (e) {
      console.warn('getStoragePathFromDocument error:', e);
      return null;
    }
  }

  /**
   * Dosya silme - storage ve Firestore'dan (güvenli)
   */
  static async deleteFile(documentId, storagePath) {
    try {
      // Önce Firestore dokümanını sil
      await deleteDoc(doc(db, 'documents', documentId));
      // Storage silme işini Cloud Function (onDocumentDelete) yapacak.
      // İstemcinin Storage delete izni yok; bu nedenle burada storage silmeye çalışmayız.
      return { success: true, message: 'Dosya başarıyla silindi' };
    } catch (error) {
      console.error('Delete file error:', error);
      throw new Error(`Dosya silme hatası: ${error.message}`);
    }
  }

  /**
   * Çoklu dosya silme (id veya {id, storagePath} destekler)
   */
  static async deleteMultipleFiles(documentsData) {
    try {
      const results = [];
      
      for (const item of documentsData) {
        const documentId = typeof item === 'string' ? item : item?.id;
        const storagePath = typeof item === 'object' ? item?.storagePath : undefined;
        if (!documentId) {
          results.push({ id: null, success: false, error: 'Geçersiz doküman' });
          continue;
        }
        try {
          await this.deleteFile(documentId, storagePath);
          results.push({ id: documentId, success: true });
        } catch (error) {
          results.push({ id: documentId, success: false, error: error.message });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      return {
        success: errorCount === 0,
        results,
        summary: { total: documentsData.length, success: successCount, errors: errorCount }
      };
      
    } catch (error) {
      console.error('Delete multiple files error:', error);
      throw new Error(`Çoklu dosya silme hatası: ${error.message}`);
    }
  }
}