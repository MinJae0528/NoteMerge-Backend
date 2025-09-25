const { pool } = require('../config/database');

/**
 * 퀴즈 시도 기록 목록을 조회합니다.
 * @param {number} userId 사용자 ID
 * @param {object} options 쿼리 옵션 (quiz_id, page, limit)
 * @returns {Promise<object>} 시도 기록 목록과 전체 개수
 */
const getQuizAttemptsFromDB = async (userId, { quiz_id, page = 1, limit = 20 }) => {
    let query = `
      SELECT qa.attempt_id, qa.quiz_id, qa.score, qa.attempted_at, q.title as quiz_title, n.title as note_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.quiz_id
      JOIN notes n ON q.note_id = n.note_id
      WHERE qa.user_id = ?`;
    const params = [userId];
    if (quiz_id) { query += ' AND qa.quiz_id = ?'; params.push(quiz_id); }
    query += ' ORDER BY qa.attempted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (page - 1) * limit);
    const [attempts] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM quiz_attempts qa WHERE qa.user_id = ?';
    const countParams = [userId];
    if (quiz_id) { countQuery += ' AND qa.quiz_id = ?'; countParams.push(quiz_id); }
    const [countResult] = await pool.execute(countQuery, countParams);

    return { attempts, total: countResult[0].total };
};

/**
 * 특정 퀴즈 시도 기록의 상세 정보를 조회합니다.
 * @param {number} userId 사용자 ID
 * @param {number} attemptId 시도 ID
 * @returns {Promise<object|null>} 시도 기록 상세 정보 또는 null
 */
const getQuizAttemptById = async (userId, attemptId) => {
    const [attempts] = await pool.execute(
        `SELECT qa.*, q.title as quiz_title, n.title as note_title
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.quiz_id
         JOIN notes n ON q.note_id = n.note_id
         WHERE qa.attempt_id = ? AND qa.user_id = ?`, [attemptId, userId]
    );
    if (attempts.length === 0) return null;
    const attempt = attempts[0];
    attempt.answers = JSON.parse(attempt.answers); // JSON 문자열을 객체로 변환
    return attempt;
};

/**
 * 사용자가 제출한 답안을 채점하고 결과를 DB에 저장합니다.
 * @param {number} userId 사용자 ID
 * @param {number} quizId 퀴즈 ID
 * @param {object} answers 사용자가 제출한 답안 객체
 * @returns {Promise<object>} 채점 결과
 */
const submitQuizAttempt = async (userId, quizId, answers) => {
    const [questions] = await pool.execute('SELECT question_id, correct_answer, type, question_text FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    if (questions.length === 0) throw new Error('채점할 문제가 없는 퀴즈입니다.');

    let correctCount = 0;
    const results = [];
    questions.forEach(q => {
        const userAnswer = answers[q.question_id] || "";
        const isCorrect = q.type === 'short_answer'
            ? userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            : userAnswer === q.correct_answer;
        if (isCorrect) correctCount++;
        results.push({ 
            question_id: q.question_id, 
            question_text: q.question_text,
            user_answer: userAnswer,
            correct_answer: q.correct_answer,
            is_correct: isCorrect 
        });
    });
    
    const score = (correctCount / questions.length) * 100;
    const [result] = await pool.execute(
        'INSERT INTO quiz_attempts (quiz_id, user_id, score, answers) VALUES (?, ?, ?, ?)',
        [quizId, userId, score, JSON.stringify(answers)]
    );
    
    return { attempt_id: result.insertId, score: parseFloat(score.toFixed(2)), correct_count: correctCount, total_questions: questions.length, results };
};

/**
 * 특정 퀴즈 시도 기록을 삭제합니다.
 * @param {number} userId 사용자 ID
 * @param {number} attemptId 시도 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
const deleteQuizAttemptById = async (userId, attemptId) => {
    const [result] = await pool.execute('DELETE FROM quiz_attempts WHERE attempt_id = ? AND user_id = ?', [attemptId, userId]);
    return result.affectedRows > 0;
};

/**
 * 사용자의 퀴즈 통계를 조회합니다.
 * @param {number} userId 사용자 ID
 * @returns {Promise<object>} 전체 통계, 최근 기록, 점수 분포 등
 */
const getQuizStatsFromDB = async (userId) => {
    const statsQuery = `
        SELECT 
            COUNT(*) as total_attempts,
            AVG(score) as avg_score,
            MAX(score) as best_score
        FROM quiz_attempts 
        WHERE user_id = ?`;
    const [statsResult] = await pool.execute(statsQuery, [userId]);

    const distributionQuery = `
        SELECT 
            CASE 
                WHEN score >= 90 THEN 'A'
                WHEN score >= 80 THEN 'B'
                WHEN score >= 70 THEN 'C'
                ELSE 'D'
            END as grade,
            COUNT(*) as count
        FROM quiz_attempts 
        WHERE user_id = ? 
        GROUP BY grade`;
    const [distribution] = await pool.execute(distributionQuery, [userId]);

    return {
        overall_stats: {
            total_attempts: parseInt(statsResult[0].total_attempts) || 0,
            avg_score: parseFloat(statsResult[0].avg_score || 0).toFixed(2),
            best_score: parseFloat(statsResult[0].best_score || 0).toFixed(2)
        },
        score_distribution: distribution
    };
};

module.exports = {
    getQuizAttemptsFromDB,
    getQuizAttemptById,
    submitQuizAttempt,
    deleteQuizAttemptById,
    getQuizStatsFromDB
};

