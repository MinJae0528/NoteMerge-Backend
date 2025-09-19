const express = require('express');
const router = express.Router();
const {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
  getPopularTags
} = require('../controllers/tagController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// 태그 생성/수정 검증 스키마
const tagSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.min': '태그명은 최소 1자 이상이어야 합니다.',
      'string.max': '태그명은 최대 100자까지 가능합니다.',
      'any.required': '태그명은 필수입니다.'
    })
});

// 노트에 태그 추가 검증 스키마
const addTagSchema = Joi.object({
  tag_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': '태그 ID는 숫자여야 합니다.',
      'number.integer': '태그 ID는 정수여야 합니다.',
      'number.positive': '태그 ID는 양수여야 합니다.',
      'any.required': '태그 ID는 필수입니다.'
    })
});

// 모든 태그 라우트는 인증 필요
router.use(authenticateToken);

// 태그 목록 조회
router.get('/', getTags);

// 인기 태그 조회
router.get('/popular', getPopularTags);

// 태그 상세 조회
router.get('/:tagId', getTag);

// 태그 생성
router.post('/', validate(tagSchema), createTag);

// 태그 수정
router.put('/:tagId', validate(tagSchema), updateTag);

// 태그 삭제
router.delete('/:tagId', deleteTag);

// 노트에 태그 추가
router.post('/:noteId/notes', validate(addTagSchema), addTagToNote);

// 노트에서 태그 제거
router.delete('/:tagId/notes/:noteId', removeTagFromNote);

module.exports = router;
