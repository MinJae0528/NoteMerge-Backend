// src/controllers/quizController.js
const aiService = require('../services/aiService');
const quizService = require('../services/quizService');
const noteService = require('../services/noteService');

const createQuizFromNote = async (req, res) => {
    try {
        console.log('createQuizFromNote - 시작:', { noteId: req.params.noteId, userId: req.user.user_id });
        
        const { noteId } = req.params;
        const note = await noteService.getNoteById(noteId, req.user.user_id);
        
        console.log('조회된 노트:', note ? `노트 ID: ${note.note_id}, 제목: ${note.title}` : '노트 없음');
        
        if (!note) {
            console.log('노트를 찾을 수 없음 - 404 반환');
            return res.status(404).json({ success: false, message: '퀴즈를 생성할 노트를 찾을 수 없습니다.' });
        }
        
        const textForQuiz = `${note.title}\n\n${note.content || ''}`;
        console.log('퀴즈 생성용 텍스트 길이:', textForQuiz.length);
        
        let aiResult;
        
        try {
            // AI 서비스 시도
            console.log('AI 서비스로 퀴즈 생성 시도 중...');
            aiResult = await aiService.generateQuizQuestions(textForQuiz);
            console.log('AI 퀴즈 생성 결과:', aiResult.success ? '성공' : '실패');
            console.log('AI 반환 questions:', JSON.stringify(aiResult.questions, null, 2));
        } catch (error) {
            console.warn('AI 서비스 사용 불가, 기본 퀴즈 생성:', error.message);
            // AI 실패 시 기본 퀴즈 생성
            aiResult = {
                success: true,
                questions: [
                    {
                        type: "multiple_choice",
                        question: `"${note.title}"의 주요 내용은 무엇인가요?`,
                        options: ["내용을 복습해보세요", "키워드를 정리해보세요", "요약을 작성해보세요", "모든 것이 중요합니다"],
                        correct_answer: "모든 것이 중요합니다"
                    },
                    {
                        type: "short_answer", 
                        question: `이 노트에서 가장 중요한 포인트는 무엇이라고 생각하시나요?`,
                        options: [],
                        correct_answer: "복습"
                    }
                ]
            };
        }
        
        if (!aiResult.success || !aiResult.questions || aiResult.questions.length === 0) {
            console.error('퀴즈 생성 실패:', aiResult);
            return res.status(500).json({ success: false, message: '퀴즈 생성에 실패했습니다.' });
        }
        
        const quizTitle = `${note.title} - 복습 퀴즈`;
        console.log('DB에 퀴즈 저장 시도:', { userId: req.user.user_id, noteId, quizTitle, questionsCount: aiResult.questions.length });
        
        const newQuiz = await quizService.createQuizInDB(req.user.user_id, noteId, quizTitle, aiResult.questions);
        console.log('퀴즈 생성 완료:', newQuiz);
        
        res.status(201).json({ success: true, message: '퀴즈가 성공적으로 생성되었습니다.', data: newQuiz });
    } catch (error) {
        console.error('Create quiz error - 상세:', error.message);
        console.error('Create quiz error - 스택:', error.stack);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.', error: error.message });
    }
};

// --- 나머지 함수들의 뼈대 ---
const getQuizzes = async (req, res) => {
  try {
    const { quizzes, total } = await quizService.getQuizzesFromDB(req.user.user_id, req.query);
    const { page = 1, limit = 20 } = req.query;
    
    res.json({
      success: true,
      data: {
        quizzes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      message: '퀴즈 목록을 가져오는데 실패했습니다.'
    });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quiz = await quizService.getQuizDetailsById(req.user.user_id, req.params.quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: '퀴즈를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: { quiz }
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      message: '퀴즈 정보를 가져오는데 실패했습니다.'
    });
  }
};

const createQuiz = async (req, res) => { 
  try {
    const { note_id, title, questions } = req.body;
    
    if (!note_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'note_id와 title은 필수 항목입니다.'
      });
    }
    
    const newQuiz = await quizService.createQuizInDB(req.user.user_id, note_id, title, questions || []);
    
    res.status(201).json({
      success: true,
      message: '퀴즈가 성공적으로 생성되었습니다.',
      data: newQuiz
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      message: '퀴즈 생성에 실패했습니다.'
    });
  }
};

const updateQuiz = async (req, res) => { res.send('updateQuiz is ready.'); };

const deleteQuiz = async (req, res) => {
  try {
    const success = await quizService.deleteQuizFromDB(req.user.user_id, req.params.quizId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        message: '퀴즈를 찾을 수 없거나 삭제 권한이 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '퀴즈가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: '퀴즈 삭제에 실패했습니다.'
    });
  }
};

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