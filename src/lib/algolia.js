// Algolia konfigürasyonu ve arama fonksiyonları
import { liteClient as algoliasearch } from 'algoliasearch/lite';

// Algolia istemcisini başlat
const searchClient = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY
);

// Arama indeksi adı
const DOCUMENTS_INDEX = 'documents';

/**
 * Dokümanlarda arama yapar
 * @param {string} query - Arama sorgusu
 * @param {string} searchMode - Arama modu: 'contains', 'startsWith', 'endsWith'
 * @param {number} hitsPerPage - Sayfa başına sonuç sayısı
 * @returns {Promise} Arama sonuçları
 */
export const searchDocuments = async (query, searchMode = 'contains', hitsPerPage = 20) => {
  const index = searchClient.initIndex(DOCUMENTS_INDEX);
  
  let searchQuery = query;
  
  // Arama moduna göre sorguyu düzenle
  switch (searchMode) {
    case 'startsWith':
      searchQuery = `${query}*`;
      break;
    case 'endsWith':
      searchQuery = `*${query}`;
      break;
    case 'contains':
    default:
      // Varsayılan olarak contains modu kullan
      break;
  }
  
  try {
    const results = await index.search(searchQuery, {
      hitsPerPage,
      attributesToHighlight: ['content', 'fileName'], // Vurgulama için
      highlightPreTag: '<mark class="bg-yellow-200">',
      highlightPostTag: '</mark>',
    });
    
    return results;
  } catch (error) {
    console.error('Algolia arama hatası:', error);
    throw error;
  }
};

/**
 * Otomatik tamamlama önerileri getirir
 * @param {string} query - Kısmi arama sorgusu
 * @returns {Promise} Öneri listesi
 */
export const getSearchSuggestions = async (query) => {
  const index = searchClient.initIndex(DOCUMENTS_INDEX);
  
  try {
    const results = await index.search(query, {
      hitsPerPage: 5,
      attributesToRetrieve: ['fileName', 'content'],
    });
    
    return results.hits.map(hit => ({
      suggestion: hit.fileName,
      content: hit.content?.substring(0, 100) + '...'
    }));
  } catch (error) {
    console.error('Algolia öneri hatası:', error);
    return [];
  }
};

export default searchClient;