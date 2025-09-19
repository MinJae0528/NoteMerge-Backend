const express = require('express');
const router = express.Router();
const {
  search,
  getSuggestions,
  getSearchStats,
  advancedSearch
} = require('../controllers/searchController');
const { authenticateToken } = require('../middleware/auth');

// 모든 검색 라우트는 인증 필요
router.use(authenticateToken);

// 통합 검색
router.get('/', search);

// 검색어 자동완성
router.get('/suggestions', getSuggestions);

// 검색 통계
router.get('/stats', getSearchStats);

// 고급 검색
router.get('/advanced', advancedSearch);

module.exports = router;
