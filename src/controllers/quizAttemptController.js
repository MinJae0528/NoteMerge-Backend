// src/controllers/quizAttemptController.js
const quizAttemptService = require('../services/quizAttemptService');

const getQuizAttempts = async (req, res) => {
    try {
        const { attempts, total } = await quizAttemptService.getQuizAttemptsFromDB(req.user.user_id, req.query);
        const { page = 1, limit = 20 } = req.query;
        res.json({
            success: true,
            data: {
                attempts,
                pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        console.error('Get quiz attempts error:', error);
        res.status(500).json({ success: false, message: '퀴즈 시도 기록을 가져오는데 실패했습니다.' });
    }
};

const getQuizAttempt = async (req, res) => {
    try {
        const attempt = await quizAttemptService.getQuizAttemptById(req.user.user_id, req.params.attemptId);
        if (!attempt) {
            return res.status(404).json({ success: false, message: '퀴즈 시도 기록을 찾을 수 없습니다.' });
        }
        res.json({ success: true, data: { attempt } });
    } catch (error) {
        console.error('Get quiz attempt error:', error);
        res.status(500).json({ success: false, message: '퀴즈 시도 기록을 가져오는데 실패했습니다.' });
    }
};

const submitQuiz = async (req, res) => {
    try {
        const { answers } = req.body;
        if (!answers || Object.keys(answers).length === 0) {
            return res.status(400).json({ success: false, message: '제출된 답안이 없습니다.' });
        }
        const result = await quizAttemptService.submitQuizAttempt(req.user.user_id, req.params.quizId, answers);
        res.status(201).json({ success: true, message: '퀴즈 제출 및 채점이 완료되었습니다.', data: result });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({ success: false, message: '퀴즈 제출에 실패했습니다.' });
    }
};

const deleteQuizAttempt = async (req, res) => {
    try {
        const success = await quizAttemptService.deleteQuizAttemptById(req.user.user_id, req.params.attemptId);
        if (!success) {
            return res.status(404).json({ success: false, message: '퀴즈 시도 기록을 찾을 수 없거나 삭제 권한이 없습니다.' });
        }
        res.json({ success: true, message: '퀴즈 시도 기록이 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete quiz attempt error:', error);
        res.status(500).json({ success: false, message: '퀴즈 시도 기록 삭제에 실패했습니다.' });
    }
};

const getQuizStats = async (req, res) => {
    // TODO: 퀴즈 통계 조회 로직 구현
    res.send('getQuizStats function is ready.');
};

module.exports = {
    getQuizAttempts,
    getQuizAttempt,
    submitQuiz,
    getQuizStats,
    deleteQuizAttempt,
};