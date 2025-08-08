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
          } catch (err) {
            console.error('Document processing error:', err);
            setError('Dokümanlar yüklenirken hata oluştu');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error('Firestore subscription error:', err);
          setError('Veritabanı bağlantı hatası');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Subscription setup error:', err);
      setError('Veritabanı kurulum hatası');
      setLoading(false);
    }
  }, [options.limitCount, options.orderField, options.orderDirection]);

  // Tek dosya silme
  const deleteDocument = useCallback(async (documentId, storagePath) => {
    try {
      await SimpleFileService.deleteFile(documentId, storagePath);
      return { success: true, message: 'Dosya başarıyla silindi' };
    } catch (error) {
      console.error('Delete document error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  // Çoklu dosya silme
  const deleteMultipleDocuments = useCallback(async (documentsToDelete) => {
    try {
      const result = await SimpleFileService.deleteMultipleFiles(documentsToDelete);
      return result;
    } catch (error) {
      console.error('Delete multiple documents error:', error);
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