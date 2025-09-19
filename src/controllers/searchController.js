const searchService = require('../services/searchService');

// 통합 검색
const search = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { 
      q, 
      type = 'hybrid', 
      folder_id, 
      page = 1, 
      limit = 20,
      include_content = false 
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '검색어를 입력해주세요.'
      });
    }

    const searchTerm = q.trim();
    const options = {
      folder_id: folder_id || null,
      page: parseInt(page),
      limit: parseInt(limit),
      include_content: include_content === 'true'
    };

    let results;

    switch (type) {
      case 'tfidf':
        results = await searchService.searchByTfIdf(searchTerm, userId, options);
        break;
      case 'keyword':
        results = await searchService.searchByKeywords(searchTerm, userId, options);
        break;
      case 'hybrid':
      default:
        results = await searchService.hybridSearch(searchTerm, userId, options);
        break;
    }

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: '검색에 실패했습니다.'
    });
  }
};

// 검색어 자동완성
const getSuggestions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [] }
      });
    }

    const suggestions = await searchService.getSearchSuggestions(q, userId, parseInt(limit));

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      message: '검색 제안을 가져오는데 실패했습니다.'
    });
  }
};

// 검색 통계
const getSearchStats = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const stats = await searchService.getSearchStats(userId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get search stats error:', error);
    res.status(500).json({
      success: false,
      message: '검색 통계를 가져오는데 실패했습니다.'
    });
  }
};

// 고급 검색 (다중 필터)
const advancedSearch = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { 
      q,
      folder_id,
      tags,
      file_types,
      date_from,
      date_to,
      sort_by = 'relevance',
      sort_order = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // 기본 검색 실행
    const searchOptions = {
      folder_id: folder_id || null,
      page: parseInt(page),
      limit: parseInt(limit),
      include_content: true
    };

    let results = await searchService.hybridSearch(q || '', userId, searchOptions);

    // 태그 필터링
    if (tags && tags.length > 0) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',');
      results.results = results.results.filter(note => {
        // 노트의 태그 정보를 가져와서 필터링
        // 실제 구현에서는 데이터베이스에서 태그 정보를 조인해서 가져와야 함
        return true; // 임시로 모든 결과 통과
      });
    }

    // 파일 타입 필터링
    if (file_types && file_types.length > 0) {
      const typeList = Array.isArray(file_types) ? file_types : file_types.split(',');
      results.results = results.results.filter(note => 
        typeList.includes(note.file_type)
      );
    }

    // 날짜 필터링
    if (date_from) {
      results.results = results.results.filter(note => 
        new Date(note.created_at) >= new Date(date_from)
      );
    }

    if (date_to) {
      results.results = results.results.filter(note => 
        new Date(note.created_at) <= new Date(date_to)
      );
    }

    // 정렬
    if (sort_by === 'date') {
      results.results.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sort_order === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else if (sort_by === 'title') {
      results.results.sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        return sort_order === 'desc' ? 
          titleB.localeCompare(titleA) : 
          titleA.localeCompare(titleB);
      });
    }
    // relevance는 이미 정렬되어 있음

    // 필터링 후 페이지네이션 재계산
    const total = results.results.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    results.results = results.results.slice(offset, offset + parseInt(limit));
    
    results.pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    };

    res.json({
      success: true,
      data: {
        ...results,
        filters: {
          folder_id,
          tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : null,
          file_types: file_types ? (Array.isArray(file_types) ? file_types : file_types.split(',')) : null,
          date_from,
          date_to,
          sort_by,
          sort_order
        }
      }
    });

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: '고급 검색에 실패했습니다.'
    });
  }
};

module.exports = {
  search,
  getSuggestions,
  getSearchStats,
  advancedSearch
};
