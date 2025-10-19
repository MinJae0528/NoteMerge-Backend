const express = require('express');
const router = express.Router();
const {
  getQuizzes,
  getQuiz,
  createQuiz,
  createQuizFromNote,
  updateQuiz,
  deleteQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  regenerateQuiz
} = require('../controllers/quizController');
const {
  getQuizAttempts,
  getQuizAttempt,
  submitQuiz,
  getQuizStats,
  deleteQuizAttempt
} = require('../controllers/quizAttemptController');
const { authenticateToken } = require('../middleware/auth');
const { validate, quizSchema } = require('../middleware/validation');
const Joi = require('joi');

// 문제 추가/수정 검증 스키마
const questionSchema = Joi.object({
  question_text: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.min': '문제 내용은 최소 1자 이상이어야 합니다.',
      'any.required': '문제 내용은 필수입니다.'
    }),
  type: Joi.string()
    .valid('multiple_choice', 'short_answer')
    .required()
    .messages({
      'any.only': '문제 유형은 multiple_choice 또는 short_answer여야 합니다.',
      'any.required': '문제 유형은 필수입니다.'
    }),
  options: Joi.array()
    .items(Joi.string())
    .when('type', {
      is: 'multiple_choice',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'any.required': '객관식 문제의 경우 선택지가 필요합니다.'
    }),
  correct_answer: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.min': '정답은 최소 1자 이상이어야 합니다.',
      'any.required': '정답은 필수입니다.'
    })
});

// 퀴즈 제출 검증 스키마
const submitSchema = Joi.object({
  answers: Joi.object()
    .pattern(Joi.number().integer().positive(), Joi.string().allow(''))
    .required()
    .messages({
      'any.required': '답안은 필수입니다.'
    })
});

// 모든 퀴즈 라우트는 인증 필요
router.use(authenticateToken);

// 퀴즈 생성 (수동)
router.post('/', createQuiz);
// 노트로부터 퀴즈 생성 (AI)
router.post('/from-note/:noteId', createQuizFromNote);

// 퀴즈 목록 조회
router.get('/', getQuizzes);
// 퀴즈 상세 조회
router.get('/:quizId', getQuiz);
// 퀴즈 수정
router.put('/:quizId', updateQuiz);
// 퀴즈 삭제
router.delete('/:quizId', deleteQuiz);
// 퀴즈 재생성
router.post('/:quizId/regenerate', regenerateQuiz);

// --- 문제 관련 ---
router.post('/:quizId/questions', validate(questionSchema), addQuestion);
router.put('/:quizId/questions/:questionId', validate(questionSchema), updateQuestion);
router.delete('/:quizId/questions/:questionId', deleteQuestion);

// --- 퀴즈 응시 관련 ---
router.get('/attempts/history', getQuizAttempts);
router.get('/attempts/:attemptId', getQuizAttempt);
router.post('/:quizId/submit', validate(submitSchema), submitQuiz);
router.get('/stats/overview', getQuizStats);
router.delete('/attempts/:attemptId', deleteQuizAttempt);


module.exports = router;