const express = require('express');
const router = express.Router();
const {
  createKeyword,
  getKeywords,
  deleteKeyword
} = require('../controllers/keywordController');
const { authenticateToken } = require('../middleware/auth');

// 모든 키워드 라우트는 인증 필요
router.use(authenticateToken);

// 키워드 생성
router.post('/', createKeyword);

// 키워드 목록 조회 (특정 노트의 키워드들)
router.get('/', getKeywords);

// 키워드 삭제
router.delete('/:keywordId', deleteKeyword);

module.exports = router;
