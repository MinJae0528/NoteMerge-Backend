// src/controllers/quizController.js
const aiService = require('../services/aiService');
const quizService = require('../services/quizService');
const noteService = require('../services/noteService');

const createQuizFromNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const note = await noteService.getNoteById(noteId, req.user.user_id);
        if (!note) {
            return res.status(404).json({ success: false, message: '퀴즈를 생성할 노트를 찾을 수 없습니다.' });
        }
        const textForQuiz = `${note.title}\n\n${note.extracted_text || note.content}`;
        const aiResult = await aiService.generateQuizQuestions(textForQuiz);
        if (!aiResult.success || aiResult.questions.length === 0) {
            return res.status(500).json({ success: false, message: 'AI가 퀴즈를 생성하는데 실패했습니다.' });
        }
        const quizTitle = `${note.title} - 복습 퀴즈`;
        const newQuiz = await quizService.createQuizInDB(req.user.user_id, noteId, quizTitle, aiResult.questions);
        res.status(201).json({ success: true, message: '퀴즈가 성공적으로 생성되었습니다.', data: newQuiz });
    } catch (error) {
        console.error('Create quiz error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// --- 나머지 함수들의 뼈대 ---
const getQuizzes = async (req, res) => { res.send('getQuizzes is ready.'); };
const getQuiz = async (req, res) => { res.send('getQuiz is ready.'); };
const createQuiz = async (req, res) => { res.send('createQuiz is ready.'); };
const updateQuiz = async (req, res) => { res.send('updateQuiz is ready.'); };
const deleteQuiz = async (req, res) => { res.send('deleteQuiz is ready.'); };
const addQuestion = async (req, res) => { res.send('addQuestion is ready.'); };
const updateQuestion = async (req, res) => { res.send('updateQuestion is ready.'); };
const deleteQuestion = async (req, res) => { res.send('deleteQuestion is ready.'); };
const regenerateQuiz = async (req, res) => { res.send('regenerateQuiz is ready.'); };


// --- ✨ 최종 module.exports ---
module.exports = {
    createQuizFromNote, // 👈 이 함수를 포함시켰습니다.
    getQuizzes,
    getQuiz,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    regenerateQuiz
};