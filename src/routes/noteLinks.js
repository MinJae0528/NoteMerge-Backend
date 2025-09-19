// src/routes/noteLinks.js

const express = require('express');
const router = express.Router();
const noteLinkController = require('../controllers/noteLinkController');
const { authenticateToken: authMiddleware } = require('../middleware/auth');

// 노트 링크 생성 (POST /api/links)
// 12번째 줄: 여기서 `noteLinkController.createNoteLink`가 정확히 함수여야 합니다.
router.post('/', authMiddleware, noteLinkController.createNoteLink); // <-- 이 줄이 12번째 줄일 것입니다.

// 특정 노트의 연결된 링크 조회 (GET /api/links/:noteId)
router.get('/:noteId', authMiddleware, noteLinkController.getNoteLinks);

// 노트 링크 삭제 (DELETE /api/links/:linkId)
router.delete('/:linkId', authMiddleware, noteLinkController.deleteNoteLink);

module.exports = router;