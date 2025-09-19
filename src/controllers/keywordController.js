const { pool } = require('../config/database');

// 키워드 목록 조회
const getKeywords = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { note_id, search, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        k.keyword_id,
        k.word,
        k.score,
        k.created_at,
        n.note_id,
        n.title as note_title
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ?
    `;
    
    const queryParams = [userId];

    if (note_id) {
      query += ' AND k.note_id = ?';
      queryParams.push(note_id);
    }

    if (search) {
      query += ' AND k.word LIKE ?';
      queryParams.push(`%${search}%`);
    }

    query += ' ORDER BY k.score DESC, k.word ASC';

    // 페이지네이션
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [keywords] = await pool.execute(query, queryParams);

    // 총 개수 조회
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ?
    `;
    
    const countParams = [userId];

    if (note_id) {
      countQuery += ' AND k.note_id = ?';
      countParams.push(note_id);
    }

    if (search) {
      countQuery += ' AND k.word LIKE ?';
      countParams.push(`%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        keywords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get keywords error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 목록을 가져오는데 실패했습니다.'
    });
  }
};

// 키워드 상세 조회 (해당 키워드가 포함된 노트들)
const getKeyword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { keywordId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // 키워드 정보 조회
    const [keywords] = await pool.execute(
      `SELECT 
        k.keyword_id,
        k.word,
        k.score,
        k.created_at,
        n.note_id,
        n.title as note_title
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE k.keyword_id = ? AND n.user_id = ?`,
      [keywordId, userId]
    );

    if (keywords.length === 0) {
      return res.status(404).json({
        success: false,
        message: '키워드를 찾을 수 없습니다.'
      });
    }

    const keyword = keywords[0];

    // 같은 키워드를 가진 다른 노트들 조회
    const offset = (page - 1) * limit;
    const [relatedNotes] = await pool.execute(
      `SELECT 
        n.note_id,
        n.title,
        n.summary,
        n.file_type,
        n.file_url,
        n.created_at,
        f.name as folder_name
      FROM notes n
      LEFT JOIN folders f ON n.folder_id = f.folder_id
      INNER JOIN keywords k ON n.note_id = k.note_id
      WHERE k.word = ? AND n.user_id = ? AND n.note_id != ?
      ORDER BY k.score DESC, n.created_at DESC
      LIMIT ? OFFSET ?`,
      [keyword.word, userId, keyword.note_id, parseInt(limit), offset]
    );

    // 총 관련 노트 개수 조회
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total 
      FROM notes n
      INNER JOIN keywords k ON n.note_id = k.note_id
      WHERE k.word = ? AND n.user_id = ? AND n.note_id != ?`,
      [keyword.word, userId, keyword.note_id]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        keyword,
        related_notes: relatedNotes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get keyword error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 정보를 가져오는데 실패했습니다.'
    });
  }
};

// 키워드 삭제
const deleteKeyword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { keywordId } = req.params;

    // 키워드 소유권 확인
    const [keywords] = await pool.execute(
      `SELECT k.keyword_id 
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE k.keyword_id = ? AND n.user_id = ?`,
      [keywordId, userId]
    );

    if (keywords.length === 0) {
      return res.status(404).json({
        success: false,
        message: '키워드를 찾을 수 없습니다.'
      });
    }

    await pool.execute('DELETE FROM keywords WHERE keyword_id = ?', [keywordId]);

    res.json({
      success: true,
      message: '키워드가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Delete keyword error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 삭제에 실패했습니다.'
    });
  }
};

// 인기 키워드 조회
const getPopularKeywords = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 20, min_score = 0.1 } = req.query;

    const [keywords] = await pool.execute(
      `SELECT 
        k.word,
        COUNT(*) as note_count,
        AVG(k.score) as avg_score,
        MAX(k.score) as max_score
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ? AND k.score >= ?
      GROUP BY k.word
      ORDER BY avg_score DESC, note_count DESC
      LIMIT ?`,
      [userId, parseFloat(min_score), parseInt(limit)]
    );

    res.json({
      success: true,
      data: {
        keywords
      }
    });

  } catch (error) {
    console.error('Get popular keywords error:', error);
    res.status(500).json({
      success: false,
      message: '인기 키워드를 가져오는데 실패했습니다.'
    });
  }
};

// 키워드 검색 (유사한 키워드 찾기)
const searchKeywords = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '검색어를 입력해주세요.'
      });
    }

    const searchTerm = q.trim();

    const [keywords] = await pool.execute(
      `SELECT 
        k.word,
        COUNT(*) as note_count,
        AVG(k.score) as avg_score
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ? AND k.word LIKE ?
      GROUP BY k.word
      ORDER BY avg_score DESC, note_count DESC
      LIMIT ?`,
      [userId, `%${searchTerm}%`, parseInt(limit)]
    );

    res.json({
      success: true,
      data: {
        keywords,
        search_term: searchTerm
      }
    });

  } catch (error) {
    console.error('Search keywords error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 검색에 실패했습니다.'
    });
  }
};

// 키워드 통계 조회
const getKeywordStats = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // 전체 키워드 통계
    const [totalStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_keywords,
        COUNT(DISTINCT k.word) as unique_words,
        AVG(k.score) as avg_score,
        MAX(k.score) as max_score,
        MIN(k.score) as min_score
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ?`,
      [userId]
    );

    // 점수별 키워드 분포
    const [scoreDistribution] = await pool.execute(
      `SELECT 
        CASE 
          WHEN k.score >= 0.8 THEN 'high'
          WHEN k.score >= 0.5 THEN 'medium'
          WHEN k.score >= 0.2 THEN 'low'
          ELSE 'very_low'
        END as score_range,
        COUNT(*) as count
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ?
      GROUP BY score_range
      ORDER BY 
        CASE score_range
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          WHEN 'very_low' THEN 4
        END`,
      [userId]
    );

    // 최근 키워드 트렌드 (최근 30일)
    const [recentTrends] = await pool.execute(
      `SELECT 
        DATE(k.created_at) as date,
        COUNT(*) as keyword_count,
        COUNT(DISTINCT k.word) as unique_words
      FROM keywords k
      INNER JOIN notes n ON k.note_id = n.note_id
      WHERE n.user_id = ? AND k.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(k.created_at)
      ORDER BY date DESC
      LIMIT 30`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        total_stats: totalStats[0],
        score_distribution: scoreDistribution,
        recent_trends: recentTrends
      }
    });

  } catch (error) {
    console.error('Get keyword stats error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 통계를 가져오는데 실패했습니다.'
    });
  }
};

module.exports = {
  getKeywords,
  getKeyword,
  deleteKeyword,
  getPopularKeywords,
  searchKeywords,
  getKeywordStats
};
