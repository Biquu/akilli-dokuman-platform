import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SimpleFileService } from '@/services/simpleFileService';

/**
 * Hook for managing and displaying uploaded documents
 */
export function useDocuments(options = {}) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documentsError, setError] = useState(null);

  useEffect(() => {
    const {
      limitCount = 50,
      orderField = 'uploadedAt',
      orderDirection = 'desc'
    } = options;

    try {
      console.log('[useDocuments] SUBSCRIBE_START', { limitCount, orderField, orderDirection });
      // Create query
      let q = query(
        collection(db, 'documents'),
        orderBy(orderField, orderDirection)
      );

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const docs = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                uploadedAt: data.uploadedAt?.toDate?.() || data.uploadedAt,
                createdAt: data.createdAt?.toDate?.() || data.createdAt,
                modifiedAt: data.modifiedAt?.toDate?.() || data.modifiedAt,
              };
            });
            
            setDocuments(docs);
            setError(null);
            console.log('[useDocuments] SNAPSHOT', { count: docs.length });
          } catch (err) {
            console.error('[useDocuments] PROCESSING_ERROR', { message: err?.message });
            setError('Dokümanlar yüklenirken hata oluştu');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error('[useDocuments] SUBSCRIPTION_ERROR', { message: err?.message });
          setError('Veritabanı bağlantı hatası');
          setLoading(false);
        }
      );

      return () => {
        console.log('[useDocuments] UNSUBSCRIBE');
        unsubscribe();
      };
    } catch (err) {
      console.error('[useDocuments] SETUP_ERROR', { message: err?.message });
      setError('Veritabanı kurulum hatası');
      setLoading(false);
    }
  }, [options.limitCount, options.orderField, options.orderDirection]);

  // Tek dosya silme
  const deleteDocument = useCallback(async (documentId) => {
    try {
      console.log('[useDocuments.deleteDocument] START', { documentId });
      await SimpleFileService.deleteFile(documentId);
      console.log('[useDocuments.deleteDocument] SUCCESS', { documentId });
      return { success: true, message: 'Dosya başarıyla silindi' };
    } catch (error) {
      console.error('[useDocuments.deleteDocument] ERROR', { documentId, message: error?.message });
      return { success: false, error: error.message };
    }
  }, []);

  // Çoklu dosya silme
  const deleteMultipleDocuments = useCallback(async (documentsToDelete) => {
    try {
      console.log('[useDocuments.deleteMultipleDocuments] START', { count: documentsToDelete?.length });
      const result = await SimpleFileService.deleteMultipleFiles(documentsToDelete);
      console.log('[useDocuments.deleteMultipleDocuments] RESULT', { success: result?.success, total: result?.summary?.total, errors: result?.summary?.errors });
      return result;
    } catch (error) {
      console.error('[useDocuments.deleteMultipleDocuments] ERROR', { message: error?.message });
      return { success: false, error: error.message };
    }
  }, []);

  return {
    documents,
    loading,
    error: documentsError,
    isEmpty: documents.length === 0,
    count: documents.length,
    
    // Actions
    deleteDocument,
    deleteMultipleDocuments
  };
}