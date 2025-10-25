// src/routes/notes.js

const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const quizController = require('../controllers/quizController');
const noteLinkController = require('../controllers/noteLinkController'); // ✨ noteLinkController 임포트 추가
const { authenticateToken: authMiddleware } = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { body } = require('express-validator');

// --- 노트 CRUD ---
// 노트 목록 조회 (GET /api/notes)
router.get('/', authMiddleware, noteController.getNotes);

// 노트 상세 조회 (GET /api/notes/:noteId)
router.get('/:noteId', authMiddleware, noteController.getNote);

// 노트 생성 (POST /api/notes) - 다중 파일 업로드 지원
router.post(
  '/',
  authMiddleware,
  uploadMultiple('files', 5), // 'files' 필드명으로 최대 5개 파일
  [
    body('title', '제목(title)은 반드시 입력해야 합니다.').not().isEmpty().trim(),
    body('tags', '태그(tags)는 배열 형태여야 합니다.').optional().isArray()
  ],
  noteController.createNote
);

// 노트 수정 (PUT /api/notes/:noteId) - 다중 파일 업로드 지원
router.put('/:noteId', authMiddleware, uploadMultiple('files', 5), noteController.updateNote);

// 노트 삭제 (DELETE /api/notes/:noteId)
router.delete('/:noteId', authMiddleware, noteController.deleteNote);


// --- 노트와 관련된 추가 기능 ---

// ✨ 특정 노트로부터 퀴즈 생성
router.post('/:noteId/quiz', authMiddleware, quizController.createQuizFromNote);

// ✨ 특정 노트의 백링크 목록 조회
router.get('/:noteId/links', authMiddleware, noteLinkController.getNoteLinks);


module.exports = router;

