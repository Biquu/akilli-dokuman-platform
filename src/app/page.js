'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload/FileUpload';
import { useDocuments } from '@/hooks/useDocuments';
import AdvancedSearch from '@/components/Search/AdvancedSearch';
import SearchResults from '@/components/Search/SearchResults';
import { Database, Trash2 } from 'lucide-react';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const { documents, loading, documentsError, deleteDocument, deleteMultipleDocuments } = useDocuments({ limitCount: 20 });

  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);

  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');
  const [showAlert, setShowAlert] = useState(false);

  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleFileUploaded = (fileData) => setUploadedFiles(prev => [...prev, fileData]);

  const handleDeleteDocument = (doc) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteMultiple = async () => {
    if (selectedDocuments.length === 0) {
      setAlertMessage('Silinecek dosya seçilmedi');
      setAlertType('warning');
      setShowAlert(true);
      return;
    }

    setDeleteLoading(true);
    try {
      const result = await deleteMultipleDocuments(selectedDocuments);
      if (result.success) {
        setAlertMessage(`${result.summary.success} dosya başarıyla silindi`);
        setAlertType('success');
        setSelectedDocuments([]);
      } else {
        setAlertMessage(`Silme hatası: ${result.summary.errors} dosya silinemedi`);
        setAlertType('error');
      }
    } catch (error) {
      setAlertMessage(`Silme hatası: ${error.message}`);
      setAlertType('error');
    } finally {
      setDeleteLoading(false);
      setShowAlert(true);
    }
  };

  const handleSelectDocument = (docId, checked) => {
    setSelectedDocuments(prev => checked ? [...prev, docId] : prev.filter(id => id !== docId));
  };

  const handleSelectAll = (checked) => {
    setSelectedDocuments(checked ? documents.map(doc => doc.id) : []);
  };

  const handleSearchResults = (results) => setSearchResults(results);
  const handleSearchLoading = (loading) => setSearchLoading(loading);

  return (
    <div className="min-h-screen bg-black">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Panel - Dosya Yükleme */}
          <div className="lg:col-span-1">
            <FileUpload onFileUploaded={handleFileUploaded} />
          </div>

          {/* Sağ Panel - Arama ve Sonuçlar */}
          <div className="lg:col-span-2 space-y-8">
            {/* Arama Bölümü */}
            <AdvancedSearch onSearchResults={handleSearchResults} onSearchLoading={handleSearchLoading} />

            {/* Arama Sonuçları - boşken liste kaybolmasın */}
            <SearchResults results={searchResults} isLoading={searchLoading} />

            {/* Mevcut Dokümanlar */}
            {!searchResults.length && (
              <div className="relative rounded-3xl border border-neutral-800 bg-neutral-900/60 backdrop-blur-md shadow-2xl overflow-hidden">
                <div className="relative p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-neutral-800 rounded-xl shadow-lg">
                        <Database className="h-6 w-6 text-neutral-200" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-100">Yüklenen Dokümanlar</h3>
                    </div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.length === documents.length && documents.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-neutral-700 text-neutral-200 focus:ring-neutral-400 bg-neutral-900"
                      />
                      <span className="text-sm text-neutral-400">Tümünü Seç</span>
                    </label>
                  </div>

                  {/* Doküman Listesi */}
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-4 p-4 bg-neutral-900 rounded-xl hover:bg-neutral-800 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={(e) => handleSelectDocument(doc.id, e.target.checked)}
                          className="rounded border-neutral-700 text-neutral-200 focus:ring-neutral-400 bg-neutral-900"
                        />

                        <div className="flex items-center space-x-3 flex-1">
                          <div className="text-2xl">📄</div>
                          <div className="flex-1">
                            <p className="font-semibold text-neutral-100 text-sm truncate">{doc.fileName}</p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-[11px] text-neutral-400">
                              <div className="flex items-center gap-1">
                                <span className="text-neutral-500">Yazar:</span>
                                {doc.processingStatus !== 'completed' ? (
                                  <span className="inline-flex items-center gap-1"> 
                                    <span className="inline-block h-3 w-3 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                                    <span>İşleniyor…</span>
                                  </span>
                                ) : (
                                  <span>{doc.author || 'Bilinmeyen'}</span>
                                )}
                              </div>
                              <div><span className="text-neutral-500">Oluşturma:</span> {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '-'}</div>
                              <div><span className="text-neutral-500">Sahip:</span> {doc.ownerName || '-'}</div>
                              <div><span className="text-neutral-500">Boyut:</span> {(doc.size/1024/1024).toFixed(2)} MB</div>
                              {doc.pageCount ? (
                                <div><span className="text-neutral-500">Sayfa:</span> {doc.pageCount}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-neutral-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Toplu Sil */}
                  {selectedDocuments.length > 0 && (
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-sm text-neutral-400">{selectedDocuments.length} dosya seçildi</span>
                      <button
                        onClick={handleDeleteMultiple}
                        disabled={deleteLoading}
                        className="flex items-center space-x-2 px-4 py-2 bg-neutral-800 text-neutral-100 border border-neutral-700 rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                      >
                        {deleteLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-200"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>Seçilenleri Sil</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Yükleme Durumu */}
            {loading && (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-gray-600">Dokümanlar yükleniyor...</span>
                </div>
              </div>
            )}

            {/* Hata Durumu */}
            {documentsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800">Hata: {documentsError}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Uyarılar */}
      {showAlert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg ${
          alertType === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          alertType === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          alertType === 'warning' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            <span className="font-medium">{alertMessage}</span>
            <button onClick={() => setShowAlert(false)} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
        </div>
      )}

      {/* Silme Dialog'u */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={async () => {
          if (documentToDelete) {
            try {
              await deleteDocument(documentToDelete.id);
              setAlertMessage('Doküman başarıyla silindi');
              setAlertType('success');
            } catch (error) {
              setAlertMessage(`Silme hatası: ${error.message}`);
              setAlertType('error');
            } finally {
              setShowAlert(true);
              setDeleteDialogOpen(false);
              setDocumentToDelete(null);
            }
          }
        }}
        title="Dokümanı Sil"
        message={`"${documentToDelete?.fileName}" dosyasını silmek istediğinizden emin misiniz?`}
      />
    </div>
  );
}
