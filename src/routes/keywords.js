const express = require('express');
const router = express.Router();
const {
  getKeywords,
  getKeyword,
  deleteKeyword,
  getPopularKeywords,
  searchKeywords,
  getKeywordStats
} = require('../controllers/keywordController');
const { authenticateToken } = require('../middleware/auth');

// 모든 키워드 라우트는 인증 필요
router.use(authenticateToken);

// 키워드 목록 조회
router.get('/', getKeywords);

// 인기 키워드 조회
router.get('/popular', getPopularKeywords);

// 키워드 검색
router.get('/search', searchKeywords);

// 키워드 통계 조회
router.get('/stats', getKeywordStats);

// 키워드 상세 조회
router.get('/:keywordId', getKeyword);

// 키워드 삭제
router.delete('/:keywordId', deleteKeyword);

module.exports = router;
