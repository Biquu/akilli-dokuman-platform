'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Calendar, 
  User, 
  Search,
  Eye,
  EyeOff,
  Star,
  TrendingUp
} from 'lucide-react';

export default function SearchResults({ results, isLoading }) {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
    console.log('[SearchResults] TOGGLE', { id, expanded: newExpanded.has(id) });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Bilinmiyor';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (contentType) => {
    if (contentType.includes('pdf')) return '📄';
    if (contentType.includes('wordprocessingml') || contentType.includes('docx')) return '📝';
    if (contentType.includes('spreadsheetml') || contentType.includes('excel')) return '📊';
    if (contentType.includes('text/plain')) return '📄';
    return '📁';
  };

  const getScoreColor = (score) => {
    if (!score) return 'text-neutral-500';
    const normalizedScore = 1 - score; // Fuse.js score'u tersine çevir
    if (normalizedScore > 0.8) return 'text-green-400';
    if (normalizedScore > 0.6) return 'text-blue-400';
    if (normalizedScore > 0.4) return 'text-yellow-400';
    return 'text-neutral-500';
  };

  const getScoreBadge = (score) => {
    if (!score) return null;
    const normalizedScore = 1 - score;
    const percentage = Math.round(normalizedScore * 100);
    
    let color = 'bg-neutral-800 text-neutral-200 border border-neutral-700';
    if (percentage > 80) color = 'bg-green-900/40 text-green-300 border border-green-700/40';
    else if (percentage > 60) color = 'bg-blue-900/40 text-blue-300 border border-blue-700/40';
    else if (percentage > 40) color = 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/40';
    
    return (
      <Badge className={`text-xs ${color}`}>
        <Star className="h-3 w-3 mr-1" />
        {percentage}% Eşleşme
      </Badge>
    );
  };

  // Sonuçları score'a göre sırala (Fuse.js score'u varsa)
  const sortedResults = [...results].sort((a, b) => {
    if (a.score !== undefined && b.score !== undefined) {
      return a.score - b.score; // Düşük score daha iyi eşleşme
    }
    return 0;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-border border-t-transparent rounded-full animate-spin"></div>
          <span>Arama sonuçları yükleniyor...</span>
        </div>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Sonuç Bulunamadı</h3>
        <p>Arama kriterlerinize uygun dosya bulunamadı.</p>
      </div>
    );
  }

  return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Arama Sonuçları ({results.length})
        </h3>
        <div className="flex items-center space-x-2">
          {results.some(r => r.score !== undefined) && (
            <Badge variant="secondary" className="bg-green-900/40 text-green-300 border border-green-700/40">
              <TrendingUp className="h-3 w-3 mr-1" />
              Akıllı Sıralama
            </Badge>
          )}
          <Badge variant="secondary" className="bg-secondary text-foreground border border-border">
            {results.length} dosya bulundu
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {sortedResults.map((doc) => (
          <Card key={doc.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{getFileIcon(doc.contentType)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        {doc.highlightedFileName ? (
                          <span dangerouslySetInnerHTML={{ __html: doc.highlightedFileName }} />
                        ) : (
                          doc.fileName
                        )}
                      </CardTitle>
                      {getScoreBadge(doc.score)}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{doc.highlightedAuthor ? (
                          <span dangerouslySetInnerHTML={{ __html: doc.highlightedAuthor }} />
                        ) : (doc.author || 'Bilinmeyen Yazar')}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(doc.createdAt)}</span>
                      </div>
                      <Badge variant="outline" className="text-xs bg-background border border-border text-foreground/80">
                        {formatFileSize(doc.size)}
                      </Badge>
                      {doc.estimatedPage && (
                        <Badge variant="outline" className="text-xs bg-background border border-border text-foreground/80">
                          Tahmini Sayfa: {doc.estimatedPage}
                        </Badge>
                      )}
                      {doc.score !== undefined && (
                        <div className={`flex items-center space-x-1 text-xs ${getScoreColor(doc.score)}`}>
                          <Star className="h-3 w-3" />
                          <span>{(1 - doc.score).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleExpanded(doc.id)}
                    className="flex items-center space-x-1 bg-secondary border border-border text-foreground hover:bg-muted"
                  >
                    {expandedItems.has(doc.id) ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span>Gizle</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>Göster</span>
                      </>
                    )}
                  </Button>
                  
                  {doc.downloadURL && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.downloadURL, '_blank')}
                      className="flex items-center space-x-1 bg-secondary border border-border text-foreground hover:bg-muted"
                    >
                      <Download className="h-4 w-4" />
                      <span>İndir</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {expandedItems.has(doc.id) && (
              <CardContent className="pt-0">
                <div className="border-t border-border pt-4">
                  <h4 className="font-medium text-foreground mb-3">Dosya İçeriği</h4>
                  
                  <div className="bg-background rounded-lg p-4 text-sm text-foreground/80 leading-relaxed max-h-96 overflow-y-auto border border-border">
                    {doc.highlightedFullContent ? (
                      <div dangerouslySetInnerHTML={{ __html: doc.highlightedFullContent }} />
                    ) : doc.highlightedContent ? (
                      <div dangerouslySetInnerHTML={{ __html: doc.highlightedContent }} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{doc.textContent || 'İçerik yok'}</div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
