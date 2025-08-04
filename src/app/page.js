'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload/FileUpload';
import FirebaseTest from '@/components/FirebaseTest';
import { Search, FileText, Database, TrendingUp, Shield, Zap } from 'lucide-react';

export default function Home() {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFileUploaded = (fileData) => {
    setUploadedFiles(prev => [...prev, fileData]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="relative bg-white/90 backdrop-blur-md shadow-xl border-b border-gray-200/50">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-indigo-600/5"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-30"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg">
                  <Database className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Akıllı Doküman Arama Platformu
                </h1>
                <p className="text-gray-600 mt-2 text-lg font-medium">
                  Dosyalarınızı yükleyin, içeriklerini arayın ve kolayca erişin
                </p>
                <div className="flex items-center space-x-4 mt-3">
                  <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">Hızlı Arama</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Güvenli</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden lg:flex items-center space-x-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{uploadedFiles.length}</div>
                <div className="text-sm text-gray-600 font-medium">Yüklenen Dosya</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">0</div>
                <div className="text-sm text-gray-600 font-medium">İşlenen Dosya</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sol Panel - Dosya Yükleme */}
          <div className="lg:col-span-2 space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-3xl blur-3xl"></div>
              <div className="relative">
                {/* Firebase Test Component */}
                <FirebaseTest />
                
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Dosya Yükleme
                  </h2>
                </div>
                <FileUpload onFileUploaded={handleFileUploaded} />
              </div>
            </div>

            {/* Yüklenen Dokümanlar Tablosu */}
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-gray-50/50"></div>
              <div className="relative p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl">
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Yüklenen Dokümanlar
                    </h3>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium">
                      {uploadedFiles.length} Dosya
                    </div>
                  )}
                </div>
                
                {uploadedFiles.length > 0 ? (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/50">
                    <div className="flex items-center space-x-3 text-blue-800">
                      <TrendingUp className="h-5 w-5" />
                      <span className="font-medium">
                        {uploadedFiles.length} dosya başarıyla yüklendi. Metadata tablosu yakında eklenecek...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="relative inline-block">
                      <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full blur-lg opacity-20"></div>
                      <FileText className="relative mx-auto h-16 w-16 text-gray-400 mb-4" />
                    </div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">Henüz dosya yüklenmedi</h4>
                    <p className="text-gray-600">Yukarıdan dosyalarınızı yükleyerek başlayın</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sağ Panel - Arama ve İstatistikler */}
          <div className="space-y-6">
            {/* Arama Paneli */}
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-blue-50/50"></div>
              <div className="relative p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl">
                    <Search className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Doküman Arama
                  </h3>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200/50">
                  <p className="text-purple-800 font-medium">
                    🔍 Arama özelliği yakında eklenecek...
                  </p>
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-green-50/50"></div>
              <div className="relative p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    İstatistikler
                  </h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border border-blue-200/50">
                    <span className="text-blue-800 font-medium">Toplam Dosya</span>
                    <span className="text-2xl font-bold text-blue-600">{uploadedFiles.length}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border border-green-200/50">
                    <span className="text-green-800 font-medium">İşlenen Dosya</span>
                    <span className="text-2xl font-bold text-green-600">0</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl border border-purple-200/50">
                    <span className="text-purple-800 font-medium">Aranabilir Dosya</span>
                    <span className="text-2xl font-bold text-purple-600">0</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Desteklenen Formatlar */}
            <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-orange-50/50"></div>
              <div className="relative p-6">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="p-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Desteklenen Formatlar
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200/50">
                    <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-lg"></div>
                    <span className="font-medium text-red-800">PDF</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200/50">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg"></div>
                    <span className="font-medium text-blue-800">DOCX</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200/50">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-lg"></div>
                    <span className="font-medium text-green-800">XLSX/XLS</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200/50">
                    <div className="w-3 h-3 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full shadow-lg"></div>
                    <span className="font-medium text-gray-800">TXT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
