'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { searchDocuments, getSearchSuggestions } from '@/lib/searchService';

export default function AdvancedSearch({ onSearchResults, onSearchLoading }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('contains'); // contains, startsWith, endsWith
  const [searchField, setSearchField] = useState('all'); // all, content, fileName, author
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  // Arama tipleri - basit metin eşleştirme
  const searchTypes = [
    { value: 'contains', label: 'İçeren' },
    { value: 'startsWith', label: 'Başlayan' },
    { value: 'endsWith', label: 'Biten' }
  ];

  // Arama alanları
  const searchFields = [
    { value: 'all', label: 'Tümü' },
    { value: 'content', label: 'İçerik' },
    { value: 'fileName', label: 'Ad' },
    { value: 'author', label: 'Yazar' }
  ];

  // Yerel debounced suggestions
  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (searchQuery.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await getSearchSuggestions(searchQuery);
          setSuggestions(results);
          setShowSuggestions(true);
        } catch (e) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  // Arama yap
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      onSearchResults([]);
      return;
    }

    setIsSearching(true);
    onSearchLoading?.(true);
    setShowSuggestions(false);

    try {
      const results = await searchDocuments(searchQuery, searchType, searchField);
      // Zengin alanları (highlight, sayfa tahmini vb.) korumak için doğrudan ilet
      onSearchResults(results);

      const newSearch = {
        query: searchQuery,
        type: searchType,
        field: searchField,
        timestamp: Date.now(),
        resultCount: results.length
      };

      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.query !== searchQuery);
        return [newSearch, ...filtered].slice(0, 5);
      });
      
    } catch (error) {
      console.error('Search error:', error);
      onSearchResults([]);
    } finally {
      setIsSearching(false);
      onSearchLoading?.(false);
    }
  };

  // Enter tuşu ile arama
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  // Öneri seç
  const selectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.fileName || suggestion.suggestion || '');
    setShowSuggestions(false);
    performSearch();
  };

  // Son aramayı tekrarla
  const repeatSearch = (search) => {
    setSearchQuery(search.query);
    setTimeout(() => performSearch(), 100);
  };

  // Arama temizle
  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onSearchResults([]);
  };

  return (
    <div className="space-y-6 text-neutral-100">
      {/* Arama Alanı */}
      <div className="relative rounded-3xl shadow-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <div className="relative p-6">
          <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
              <div className="p-2 bg-neutral-800 rounded-xl shadow-lg">
                <Search className="h-6 w-6 text-neutral-200" />
              </div>
              <h3 className="text-xl font-bold text-neutral-100">Gelişmiş Arama</h3>
          </div>
            <div className="flex items-center space-x-2" />
      </div>

          {/* Arama Input'u */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
              <Input
              type="text"
                placeholder="Dosya adı, içerik veya yazar ara..."
              value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 pr-12 py-3 text-lg border border-neutral-800 bg-neutral-900 text-neutral-100 placeholder-neutral-500 focus:border-neutral-600 focus:ring-0 rounded-2xl"
            />
            {searchQuery && (
                <Button
                  size="sm"
                  variant="ghost"
                onClick={clearSearch}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                  <X className="h-4 w-4" />
                </Button>
            )}
          </div>

          {/* Öneriler */}
          {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                  <div
                  key={index}
                    onClick={() => selectSuggestion(suggestion)}
                    className="p-3 hover:bg-neutral-800 cursor-pointer border-b border-neutral-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-neutral-100">{suggestion.fileName || suggestion.suggestion}</p>
                      </div>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>

          {/* Arama Seçenekleri */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Arama Tipi */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Arama Tipi</label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-800 bg-neutral-900 text-neutral-100 rounded-xl focus:outline-none"
              >
                {searchTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
        </div>

            {/* Arama Alanı */}
              <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Arama Alanı</label>
                <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-800 bg-neutral-900 text-neutral-100 rounded-xl focus:outline-none"
              >
                {searchFields.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
                </select>
              </div>

            {/* Arama Butonu */}
            <div className="flex items-end">
              <Button
                onClick={performSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold py-2 px-6 rounded-xl border border-neutral-700 transition-all duration-300"
              >
                {isSearching ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Aranıyor...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Search className="h-4 w-4" />
                    <span>Ara</span>
                  </div>
                )}
              </Button>
              </div>
              </div>
              </div>
            </div>

      {/* Son Aramalar */}
      {recentSearches.length > 0 && (
        <div className="relative rounded-3xl shadow-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
          <div className="relative p-6">
            <h4 className="text-lg font-bold text-neutral-100 mb-4">Son Aramalar</h4>
            <div className="space-y-2">
              {recentSearches.map((search, index) => (
                <div
                  key={index}
                  onClick={() => repeatSearch(search)}
                  className="flex items-center justify-between p-3 bg-neutral-900 rounded-xl cursor-pointer hover:bg-neutral-800 transition-colors border border-neutral-800"
                >
                  <div className="flex items-center space-x-3">
                    <Search className="h-4 w-4 text-neutral-500" />
                    <div>
                      <p className="font-medium text-neutral-100">{search.query}</p>
                      <p className="text-xs text-neutral-400">
                        {search.type} • {search.field} • {search.resultCount} sonuç
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {new Date(search.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}