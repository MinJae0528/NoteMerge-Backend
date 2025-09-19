const express = require('express');
const router = express.Router();
const {
  getLearningProgress,
  checkAttendance,
  recordStudyTime,
  recordNoteCreation,
  recordQuizCompletion,
  getLearningStats,
  getTodayQuiz,
  setTodayQuiz
} = require('../controllers/calendarController');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// 학습 시간 기록 검증 스키마
const studyTimeSchema = Joi.object({
  minutes: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': '학습 시간은 숫자여야 합니다.',
      'number.integer': '학습 시간은 정수여야 합니다.',
      'number.positive': '학습 시간은 양수여야 합니다.',
      'any.required': '학습 시간은 필수입니다.'
    }),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': '날짜는 YYYY-MM-DD 형식이어야 합니다.'
    })
});

// 오늘의 퀴즈 설정 검증 스키마
const todayQuizSchema = Joi.object({
  quiz_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': '퀴즈 ID는 숫자여야 합니다.',
      'number.integer': '퀴즈 ID는 정수여야 합니다.',
      'number.positive': '퀴즈 ID는 양수여야 합니다.',
      'any.required': '퀴즈 ID는 필수입니다.'
    }),
  date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': '날짜는 YYYY-MM-DD 형식이어야 합니다.'
    })
});

// 모든 캘린더 라우트는 인증 필요
router.use(authenticateToken);

// 학습 현황 조회 (캘린더)
router.get('/progress', getLearningProgress);

// 학습 통계 조회
router.get('/stats', getLearningStats);

// 오늘의 퀴즈 조회
router.get('/today-quiz', getTodayQuiz);

// 출석체크
router.post('/attendance', checkAttendance);

// 학습 시간 기록
router.post('/study-time', validate(studyTimeSchema), recordStudyTime);

// 노트 생성 기록
router.post('/note-creation', recordNoteCreation);

// 퀴즈 완료 기록
router.post('/quiz-completion', recordQuizCompletion);

// 오늘의 퀴즈 설정
router.post('/today-quiz', validate(todayQuizSchema), setTodayQuiz);

module.exports = router;
