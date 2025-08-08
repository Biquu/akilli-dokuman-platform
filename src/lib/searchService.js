/** Basit Firestore Arama Servisi (Fuse.js ile sıralama + contains/startsWith/endsWith) */
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { db } from './firebase';
import Fuse from 'fuse.js';

async function fetchAllDocuments() {
  const ref = collection(db, 'documents');
  const q = query(ref, orderBy('uploadedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function normalize(str = '') {
  return String(str || '').toLowerCase();
}

// Cümle başlangıcı/sonu kontrolü için gerekli yardımcılar
const TRIM_START_PUNCT_RE = /^[\p{P}\s]+/u; // baştaki noktalama/boşlukları sil
const TRIM_END_PUNCT_RE = /[\p{P}\s]+$/u;   // sondaki noktalama/boşlukları sil

function splitIntoSentences(text = '') {
  const input = String(text || '');
  const out = [];
  // Basit cümle ayırma: cümle gövdesi + son işaret(ler)i (isteğe bağlı)
  const re = /([^.!?\n]+[.!?]*)(\s+|$)/g;
  let m;
  while ((m = re.exec(input)) !== null) {
    const sentence = m[1];
    const start = m.index;
    const end = start + sentence.length;
    if (sentence.trim().length === 0) continue;
    out.push({ text: sentence, start, end });
  }
  if (!out.length && input) out.push({ text: input, start: 0, end: input.length });
  return out;
}

function tokenizeWithOffsets(text = '') {
  const tokens = [];
  const re = /[\p{L}\p{N}]+/gu; // Unicode kelime
  let m;
  while ((m = re.exec(String(text))) !== null) {
    tokens.push({ word: m[0], start: m.index, end: m.index + m[0].length, lower: normalize(m[0]) });
  }
  return tokens;
}

function matchByType(haystack, needle, type) {
  const h = String(haystack || '');
  const n = normalize(needle);
  if (!n) return false;
  if (type === 'contains') return normalize(h).includes(n);
  // cümle bazlı: satır/cümle başı ve sonu
  const sentences = splitIntoSentences(h);
  if (type === 'startsWith') {
    return sentences.some((s) => normalize(s.text.replace(TRIM_START_PUNCT_RE, '')).startsWith(n));
  }
  if (type === 'endsWith') {
    return sentences.some((s) => normalize(s.text.replace(TRIM_END_PUNCT_RE, '')).endsWith(n));
  }
  return false;
}

function computeMatchInfo(text = '', query = '', type = 'contains') {
  const hay = String(text || '');
  const q = String(query || '');
  if (!hay || !q) return null;
  const lhay = normalize(hay);
  const lq = normalize(q);

  let idx = -1;
  if (type === 'contains') {
    idx = lhay.indexOf(lq);
    if (idx < 0) return null;
  } else {
    const sentences = splitIntoSentences(hay);
    for (const s of sentences) {
      if (type === 'startsWith') {
        const leftTrim = s.text.replace(TRIM_START_PUNCT_RE, '');
        if (normalize(leftTrim).startsWith(lq)) {
          const removed = s.text.length - leftTrim.length;
          idx = s.start + removed;
          break;
        }
      } else if (type === 'endsWith') {
        const rightTrim = s.text.replace(TRIM_END_PUNCT_RE, '');
        if (normalize(rightTrim).endsWith(lq)) {
          idx = s.start + rightTrim.length - q.length;
          break;
        }
      }
    }
    if (idx < 0) return null;
  }

  const snippetRadius = 220;
  const start = Math.max(0, idx - snippetRadius);
  const end = Math.min(hay.length, idx + q.length + snippetRadius);
  const prefix = hay.slice(start, idx);
  const match = hay.slice(idx, idx + q.length);
  const suffix = hay.slice(idx + q.length, end);
  const matchPercent = hay.length > 0 ? Math.round((idx / hay.length) * 100) : 0;
  const highlightedSnippet = `${start > 0 ? '…' : ''}${prefix}<mark class="search-highlight">${match}</mark>${suffix}${end < hay.length ? '…' : ''}`;
  return { index: idx, length: q.length, matchPercent, snippet: `${start > 0 ? '…' : ''}${prefix}${match}${suffix}${end < hay.length ? '…' : ''}`, highlightedSnippet };
}

function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightAll(text = '', query = '') {
  if (!text || !query) return text;
  const pattern = new RegExp(escapeRegExp(query), 'giu');
  return text.replace(pattern, (m) => `<mark class="search-highlight">${m}</mark>`);
}

function highlightRanges(text = '', ranges = []) {
  if (!ranges.length) return text;
  ranges.sort((a, b) => a.start - b.start);
  let out = '';
  let last = 0;
  for (const r of ranges) {
    out += text.slice(last, r.start);
    out += `<mark class="search-highlight">${text.slice(r.start, r.end)}</mark>`;
    last = r.end;
  }
  out += text.slice(last);
  return out;
}

function highlightByType(text = '', query = '', type = 'contains') {
  if (!text || !query) return text;
  if (type === 'contains') return highlightAll(text, query);
  const lq = normalize(query);
  const ranges = [];
  const sentences = splitIntoSentences(text);
  for (const s of sentences) {
    if (type === 'startsWith') {
      const leftTrim = s.text.replace(TRIM_START_PUNCT_RE, '');
      if (normalize(leftTrim).startsWith(lq)) {
        const removed = s.text.length - leftTrim.length;
        const start = s.start + removed;
        ranges.push({ start, end: start + lq.length });
      }
    } else if (type === 'endsWith') {
      const rightTrim = s.text.replace(TRIM_END_PUNCT_RE, '');
      if (normalize(rightTrim).endsWith(lq)) {
        const start = s.start + rightTrim.length - lq.length;
        ranges.push({ start, end: start + lq.length });
      }
    }
  }
  return highlightRanges(text, ranges);
}

export async function searchDocuments(searchQuery, searchType = 'contains', searchField = 'all') {
  const q = (searchQuery || '').trim();
  if (!q) return [];
  // Sadece noktalama/boşluk içeren sorgularda sonuç getirme (liste kaybolmasın)
  const hasAlphaNum = /[\p{L}\p{N}]/u.test(q);
  if (!hasAlphaNum) return [];
  let docs = await fetchAllDocuments();

  // Gerekiyorsa Storage'tan tam metni indir (textContent yok ama textContentStoragePath varsa)
  const storage = getStorage();
  await Promise.all(
    docs.map(async (doc) => {
      if (!doc.textContent && doc.textContentStoragePath) {
        try {
          const url = await getDownloadURL(ref(storage, doc.textContentStoragePath));
          const res = await fetch(url);
          const fullText = await res.text();
          doc.textContent = fullText || '';
        } catch {}
      }
    })
  );

  const candidates = docs.filter((doc) => {
    const text = String(doc.textContent || '');
    const name = String(doc.fileName || '');
    const author = String(doc.author || '');
    const title = String(doc.title || '');

    if (searchField === 'fileName') return matchByType(name, q, searchType);
    if (searchField === 'author') return matchByType(author, q, searchType);
    if (searchField === 'content') return matchByType(text, q, searchType);
    // all
    return (
      matchByType(text, q, searchType) ||
      matchByType(name, q, searchType) ||
      matchByType(author, q, searchType) ||
      matchByType(title, q, searchType)
    );
  });

  // Fuse.js ile sonuçları mantıklı şekilde sırala
  const fuse = new Fuse(candidates, {
    includeMatches: false,
    ignoreLocation: true,
    threshold: 0.2,
    keys: [
      { name: 'textContent', weight: 0.7 },
      { name: 'fileName', weight: 0.2 },
      { name: 'title', weight: 0.15 },
      { name: 'author', weight: 0.1 }
    ]
  });
  const ranked = fuse.search(q).map(r => r.item);
  const ordered = ranked.length ? ranked : candidates;

  // Enrich with match info for content
  const enriched = ordered.map((doc) => {
    const info = computeMatchInfo(doc.textContent || '', q, searchType);
    if (info) {
      const estimatedPage = doc.pageCount ? Math.min(doc.pageCount, Math.max(1, Math.ceil((info.matchPercent / 100) * doc.pageCount))) : null;
      return { 
        ...doc, 
        highlightedContent: info.highlightedSnippet, 
        highlightedFullContent: highlightByType(doc.textContent || '', q, searchType),
        highlightedFileName: highlightByType(doc.fileName || '', q, searchType),
        highlightedAuthor: highlightByType(doc.author || '', q, searchType),
        matchIndex: info.index, 
        matchPercent: info.matchPercent, 
        estimatedPage 
      };
    }
    return {
      ...doc,
      highlightedFileName: highlightByType(doc.fileName || '', q, searchType),
      highlightedAuthor: highlightByType(doc.author || '', q, searchType),
    };
  });

  return enriched.slice(0, 100);
}

export async function getSearchSuggestions(partial) {
  const q = (partial || '').trim();
  if (!q) return [];
  const docs = await fetchAllDocuments();
  return docs
    .filter((d) => matchByType(d.fileName, q, 'contains'))
    .slice(0, 5)
    .map((d) => ({ suggestion: d.fileName }));
}

export async function advancedSearch({ query: q = '', fileType = '', author = '', type = 'contains', field = 'all' } = {}) {
  let results = q ? await searchDocuments(q, type, field) : await fetchAllDocuments();
  if (fileType) results = results.filter((d) => (d.fileExtension || '').toLowerCase().includes(fileType.toLowerCase()));
  if (author) results = results.filter((d) => normalize(d.author).includes(normalize(author)));
  return results.slice(0, 100);
}

export async function debugListAllDocuments() {
  const docs = await fetchAllDocuments();
  if (typeof console !== 'undefined') {
    console.log(`[debugListAllDocuments] count=${docs.length}`);
    docs.slice(0, 5).forEach((d, i) => {
      console.log(`${i + 1}. ${d.fileName} | len=${(d.textContent || '').length}`);
    });
  }
  return docs;
}

const SearchAPI = { searchDocuments, getSearchSuggestions, advancedSearch, debugListAllDocuments };
export default SearchAPI;
