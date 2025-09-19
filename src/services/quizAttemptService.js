// src/services/quizAttemptService.js
const { pool } = require('../config/database');

const getQuizAttemptsFromDB = async (userId, { quiz_id, page = 1, limit = 20 }) => {
    let query = `
      SELECT qa.attempt_id, qa.quiz_id, qa.score, qa.attempted_at, q.title as quiz_title, n.title as note_title
      FROM Quiz_Attempts qa
      INNER JOIN Quizzes q ON qa.quiz_id = q.quiz_id
      INNER JOIN Notes n ON q.note_id = n.note_id
      WHERE qa.user_id = ?`;
    const params = [userId];
    if (quiz_id) { query += ' AND qa.quiz_id = ?'; params.push(quiz_id); }
    query += ' ORDER BY qa.attempted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (page - 1) * limit);
    const [attempts] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM Quiz_Attempts qa WHERE qa.user_id = ?';
    const countParams = [userId];
    if (quiz_id) { countQuery += ' AND qa.quiz_id = ?'; countParams.push(quiz_id); }
    const [countResult] = await pool.execute(countQuery, countParams);

    return { attempts, total: countResult[0].total };
};

const getQuizAttemptById = async (userId, attemptId) => {
    const [attempts] = await pool.execute(
        `SELECT qa.*, q.title as quiz_title, n.title as note_title
         FROM Quiz_Attempts qa
         INNER JOIN Quizzes q ON qa.quiz_id = q.quiz_id
         INNER JOIN Notes n ON q.note_id = n.note_id
         WHERE qa.attempt_id = ? AND qa.user_id = ?`, [attemptId, userId]
    );
    if (attempts.length === 0) return null;
    const attempt = attempts[0];
    attempt.answers = JSON.parse(attempt.answers);
    return attempt;
};

const submitQuizAttempt = async (userId, quizId, answers) => {
    const [questions] = await pool.execute('SELECT question_id, correct_answer, type FROM Quiz_Questions WHERE quiz_id = ?', [quizId]);
    if (questions.length === 0) throw new Error('채점할 문제가 없는 퀴즈입니다.');

    let correctCount = 0;
    const results = [];
    questions.forEach(q => {
        const userAnswer = answers[q.question_id] || "";
        const isCorrect = q.type === 'short_answer'
            ? userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            : userAnswer === q.correct_answer;
        if (isCorrect) correctCount++;
        results.push({ question_id: q.question_id, user_answer: userAnswer, is_correct: isCorrect });
    });
    
    const score = (correctCount / questions.length) * 100;
    const [result] = await pool.execute(
        'INSERT INTO Quiz_Attempts (quiz_id, user_id, score, answers) VALUES (?, ?, ?, ?)',
        [quizId, userId, score, JSON.stringify(answers)]
    );
    
    return { attempt_id: result.insertId, score, correct_count: correctCount, total_questions: questions.length, results };
};

const deleteQuizAttemptById = async (userId, attemptId) => {
    const [result] = await pool.execute('DELETE FROM Quiz_Attempts WHERE attempt_id = ? AND user_id = ?', [attemptId, userId]);
    return result.affectedRows > 0;
};

// (getQuizStats 서비스 로직도 여기에 유사하게 구현...)

module.exports = {
    getQuizAttemptsFromDB,
    getQuizAttemptById,
    submitQuizAttempt,
    deleteQuizAttemptById
};