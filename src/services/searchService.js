const natural = require('natural');
const { pool } = require('../config/database');
const AIService = require('./aiService'); // ✨ AIService 임포트

// 코사인 유사도 계산 함수 (헬퍼 함수로 추가)
// 벡터 데이터가 DB에서 JSON 문자열로 저장되어 있으므로, JSON.parse 후 계산
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}


class SearchService {
  constructor() {
    this.tfidf = new natural.TfIdf();
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    // this.aiService = new AIService(); // AIService는 싱글톤이므로 직접 인스턴스화 하지 않고 임포트된 객체를 사용
  }

  // TF-IDF 기반 검색
  async searchByTfIdf(query, userId, options = {}) {
    try {
      const { 
        folder_id = null, 
        page = 1, 
        limit = 20, 
        include_content = false 
      } = options;

      // 사용자의 모든 노트 가져오기
      let notesQuery = `
        SELECT 
          n.note_id,
          n.title,
          n.content,
          n.summary,
          n.file_type,
          n.file_url,
          n.created_at,
          f.name as folder_name
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.folder_id
        WHERE n.user_id = ?
      `;
      
      const queryParams = [userId];

      if (folder_id) {
        notesQuery += ' AND n.folder_id = ?';
        queryParams.push(folder_id);
      }

      const [notes] = await pool.execute(notesQuery, queryParams);

      if (notes.length === 0) {
        return {
          results: [],
          pagination: { page: 1, limit, total: 0, totalPages: 0 },
          search_term: query
        };
      }

      // TF-IDF 모델 구축
      this.tfidf = new natural.TfIdf();
      
      notes.forEach(note => {
        const text = `${note.title} ${note.summary || ''} ${include_content ? note.content || '' : ''}`;
        this.tfidf.addDocument(text);
      });

      // 검색어로 점수 계산
      const searchTerms = this.tokenizer.tokenize(query.toLowerCase());
      const scores = [];

      notes.forEach((note, index) => {
        let score = 0;
        searchTerms.forEach(term => {
          score += this.tfidf.tfidf(term, index);
        });
        
        if (score > 0) {
          scores.push({
            note,
            score,
            index
          });
        }
      });

      // 점수순으로 정렬
      scores.sort((a, b) => b.score - a.score);

      // 페이지네이션
      const offset = (page - 1) * limit;
      const paginatedResults = scores.slice(offset, offset + limit);

      return {
        results: paginatedResults.map(item => ({
          ...item.note,
          relevance_score: item.score
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: scores.length,
          totalPages: Math.ceil(scores.length / limit)
        },
        search_term: query
      };

    } catch (error) {
      console.error('TF-IDF search error:', error);
      throw error;
    }
  }

  // 키워드 기반 검색 (하이라이트 포함)
  async searchByKeywords(query, userId, options = {}) {
    try {
      const { 
        folder_id = null, 
        page = 1, 
        limit = 20 
      } = options;

      const searchTerms = this.tokenizer.tokenize(query.toLowerCase());
      const stemmedTerms = searchTerms.map(term => this.stemmer.stem(term));

      // 키워드 매칭 검색
      let keywordQuery = `
        SELECT 
          n.note_id,
          n.title,
          n.content,
          n.summary,
          n.file_type,
          n.file_url,
          n.created_at,
          f.name as folder_name,
          k.word,
          k.score as keyword_score
        FROM notes n
        LEFT JOIN folders f ON n.folder_id = f.folder_id
        INNER JOIN keywords k ON n.note_id = k.note_id
        WHERE n.user_id = ? AND (
      `;
      
      const queryParams = [userId];
      const conditions = [];

      // 원본 검색어와 스테밍된 검색어 모두 검색
      // 텍스트 검색에 더 유연하게 LIKE 대신 INSTR 또는 Full-Text Search를 고려할 수 있음
      [...searchTerms, ...stemmedTerms].forEach((term, index) => {
        conditions.push(`k.word LIKE ?`);
        queryParams.push(`%${term}%`);
      });

      keywordQuery += conditions.join(' OR ') + ')';

      if (folder_id) {
        keywordQuery += ' AND n.folder_id = ?';
        queryParams.push(folder_id);
      }

      keywordQuery += ' ORDER BY k.score DESC, n.created_at DESC';

      const [results] = await pool.execute(keywordQuery, queryParams);

      // 노트별로 그룹화하고 점수 합계 계산
      const noteMap = new Map();
      
      results.forEach(row => {
        const noteId = row.note_id;
        if (!noteMap.has(noteId)) {
          noteMap.set(noteId, {
            ...row,
            total_score: 0,
            matched_keywords: []
          });
        }
        
        const note = noteMap.get(noteId);
        note.total_score += row.keyword_score;
        note.matched_keywords.push({
          word: row.word,
          score: row.keyword_score
        });
      });

      // 점수순으로 정렬
      const sortedResults = Array.from(noteMap.values())
        .sort((a, b) => b.total_score - a.total_score);

      // 페이지네이션
      const offset = (page - 1) * limit;
      const paginatedResults = sortedResults.slice(offset, offset + limit);

      return {
        results: paginatedResults.map(note => ({
          note_id: note.note_id,
          title: note.title,
          content: note.content,
          summary: note.summary,
          file_type: note.file_type,
          file_url: note.file_url,
          created_at: note.created_at,
          folder_name: note.folder_name,
          relevance_score: note.total_score,
          matched_keywords: note.matched_keywords
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: sortedResults.length,
          totalPages: Math.ceil(sortedResults.length / limit)
        },
        search_term: query
      };

    } catch (error) {
      console.error('Keyword search error:', error);
      throw error;
    }
  }

  // 하이브리드 검색 (TF-IDF + 키워드)
  async hybridSearch(query, userId, options = {}) {
    try {
      const { 
        folder_id = null, 
        page = 1, 
        limit = 20,
        tfidf_weight = 0.6,
        keyword_weight = 0.4
      } = options;

      // TF-IDF 검색
      const tfidfResults = await this.searchByTfIdf(query, userId, {
        folder_id,
        page: 1,
        limit: 1000, // 더 많은 결과를 가져와서 하이브리드 점수 계산
        include_content: true
      });

      // 키워드 검색
      const keywordResults = await this.searchByKeywords(query, userId, {
        folder_id,
        page: 1,
        limit: 1000
      });

      // 결과 병합
      const noteMap = new Map();

      // TF-IDF 결과 추가
      tfidfResults.results.forEach(note => {
        noteMap.set(note.note_id, {
          ...note,
          tfidf_score: note.relevance_score || 0,
          keyword_score: 0,
          hybrid_score: 0
        });
      });

      // 키워드 결과 추가/업데이트
      keywordResults.results.forEach(note => {
        if (noteMap.has(note.note_id)) {
          const existing = noteMap.get(note.note_id);
          existing.keyword_score = note.relevance_score || 0;
          existing.matched_keywords = note.matched_keywords || [];
        } else {
          noteMap.set(note.note_id, {
            ...note,
            tfidf_score: 0,
            keyword_score: note.relevance_score || 0,
            hybrid_score: 0
          });
        }
      });

      // 하이브리드 점수 계산
      const hybridResults = Array.from(noteMap.values()).map(note => {
        const hybridScore = (note.tfidf_score * tfidf_weight) + (note.keyword_score * keyword_weight);
        return {
          ...note,
          hybrid_score: hybridScore
        };
      });

      // 하이브리드 점수순으로 정렬
      hybridResults.sort((a, b) => b.hybrid_score - a.hybrid_score);

      // 페이지네이션
      const offset = (page - 1) * limit;
      const paginatedResults = hybridResults.slice(offset, offset + limit);

      return {
        results: paginatedResults.map(note => ({
          note_id: note.note_id,
          title: note.title,
          content: note.content,
          summary: note.summary,
          file_type: note.file_type,
          file_url: note.file_url,
          created_at: note.created_at,
          folder_name: note.folder_name,
          relevance_score: note.hybrid_score,
          tfidf_score: note.tfidf_score,
          keyword_score: note.keyword_score,
          matched_keywords: note.matched_keywords || []
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: hybridResults.length,
          totalPages: Math.ceil(hybridResults.length / limit)
        },
        search_term: query
      };

    } catch (error) {
      console.error('Hybrid search error:', error);
      throw error;
    }
  }

  // 검색어 자동완성
  async getSearchSuggestions(query, userId, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return { suggestions: [] };
      }

      const searchTerm = query.trim().toLowerCase();

      // 제목에서 검색어로 시작하는 노트들
      const [titleSuggestions] = await pool.execute(
        `SELECT DISTINCT n.title
        FROM notes n
        WHERE n.user_id = ? AND n.title LIKE ?
        ORDER BY n.title
        LIMIT ?`,
        [userId, `${searchTerm}%`, limit]
      );

      // 태그에서 검색어로 시작하는 태그들
      const [tagSuggestions] = await pool.execute(
        `SELECT DISTINCT t.name
        FROM tags t
        INNER JOIN note_tag_link ntl ON t.tag_id = ntl.tag_id
        INNER JOIN notes n ON ntl.note_id = n.note_id
        WHERE n.user_id = ? AND t.name LIKE ?
        ORDER BY t.name
        LIMIT ?`,
        [userId, `${searchTerm}%`, limit]
      );

      // 키워드에서 검색어로 시작하는 키워드들
      const [keywordSuggestions] = await pool.execute(
        `SELECT DISTINCT k.word
        FROM keywords k
        INNER JOIN notes n ON k.note_id = n.note_id
        WHERE n.user_id = ? AND k.word LIKE ?
        ORDER BY k.score DESC
        LIMIT ?`,
        [userId, `${searchTerm}%`, limit]
      );

      const suggestions = [
        ...titleSuggestions.map(item => ({ type: 'title', text: item.title })),
        ...tagSuggestions.map(item => ({ type: 'tag', text: item.name })),
        ...keywordSuggestions.map(item => ({ type: 'keyword', text: item.word }))
      ];

      // 중복 제거 및 정렬
      const uniqueSuggestions = suggestions
        .filter((item, index, self) => 
          index === self.findIndex(t => t.text === item.text)
        )
        .slice(0, limit);

      return { suggestions: uniqueSuggestions };

    } catch (error) {
      console.error('Search suggestions error:', error);
      return { suggestions: [] };
    }
  }

  // 검색 통계
  async getSearchStats(userId) {
    try {
      // 전체 노트 수
      const [noteCount] = await pool.execute(
        'SELECT COUNT(*) as total FROM notes WHERE user_id = ?',
        [userId]
      );

      // 전체 태그 수
      const [tagCount] = await pool.execute(
        `SELECT COUNT(DISTINCT t.tag_id) as total
        FROM tags t
        INNER JOIN note_tag_link ntl ON t.tag_id = ntl.tag_id
        INNER JOIN notes n ON ntl.note_id = n.note_id
        WHERE n.user_id = ?`,
        [userId]
      );

      // 전체 키워드 수
      const [keywordCount] = await pool.execute(
        `SELECT COUNT(DISTINCT k.word) as total
        FROM keywords k
        INNER JOIN notes n ON k.note_id = n.note_id
        WHERE n.user_id = ?`,
        [userId]
      );

      // 인기 검색어 (키워드 기반)
      const [popularKeywords] = await pool.execute(
        `SELECT k.word, COUNT(*) as frequency
        FROM keywords k
        INNER JOIN notes n ON k.note_id = n.note_id
        WHERE n.user_id = ?
        GROUP BY k.word
        ORDER BY frequency DESC
        LIMIT 10`,
        [userId]
      );

      return {
        total_notes: noteCount[0].total,
        total_tags: tagCount[0].total,
        total_keywords: keywordCount[0].total,
        popular_keywords: popularKeywords
      };

    } catch (error) {
      console.error('Search stats error:', error);
      throw error;
    }
  }

  // ✨ 의미 기반 정밀 검색 함수 (새로운 메서드 추가)
  async semanticSearchNotes(queryText, userId, threshold = 0.5) { // 유사도 임계값
    try {
      // 1. 검색 쿼리의 임베딩 벡터 생성
      const queryEmbedding = await AIService.getEmbedding(queryText); // ✅ AIService 사용
      if (!queryEmbedding) {
        console.warn("검색 쿼리 임베딩 생성 실패.");
        return [];
      }

      // 2. DB에서 사용자 소유의 모든 노트 중 임베딩이 있는 노트 가져오기
      // 주의: 대규모 데이터셋에서는 이 방식은 비효율적입니다.
      // 실제 서비스에서는 벡터 DB (예: Pinecone, Weaviate) 또는 DB 확장 (PostGIS, pgvector)을 고려해야 합니다.
      // MySQL의 JSON_TABLE 함수 등을 사용하여 DB 내에서 유사도를 계산하는 방법도 있으나 복잡합니다.
      const sql = 'SELECT note_id, title, content, embedding FROM notes WHERE user_id = ? AND embedding IS NOT NULL';
      const [allNotes] = await pool.execute(sql, [userId]);

      // 3. 각 노트의 임베딩과 쿼리 임베딩 간의 유사도 계산
      const rankedNotes = allNotes
        .map(note => {
          // DB에 JSON 문자열로 저장된 임베딩을 다시 배열로 파싱
          const noteEmbedding = JSON.parse(note.embedding); 
          const similarity = cosineSimilarity(queryEmbedding, noteEmbedding);
          return {
            note_id: note.note_id,
            title: note.title,
            content: note.content,
            similarity: similarity,
          };
        })
        .filter(note => note.similarity >= threshold) // 임계값 이상만 필터링
        .sort((a, b) => b.similarity - a.similarity); // 유사도 높은 순으로 정렬

      return rankedNotes;

    } catch (error) {
      console.error('의미 기반 검색 중 오류 발생:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();