const express = require('express');
const router = express.Router();
const {
  getFolders,
  getFolder,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderTree
} = require('../controllers/folderController');
const { authenticateToken } = require('../middleware/auth');
const { validate, folderSchema } = require('../middleware/validation');

// 모든 폴더 라우트는 인증 필요
router.use(authenticateToken);

// 폴더 목록 조회
router.get('/', getFolders);

// 폴더 트리 구조 조회
router.get('/tree', getFolderTree);

// 폴더 상세 조회
router.get('/:folderId', getFolder);

// 폴더 생성
router.post('/', validate(folderSchema), createFolder);

// 폴더 수정
router.put('/:folderId', validate(folderSchema), updateFolder);

// 폴더 삭제
router.delete('/:folderId', deleteFolder);

module.exports = router;
