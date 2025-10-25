const { pool } = require('../config/database');

/**
 * 퀴즈 시도 기록 목록을 조회합니다.
 */
const getQuizAttemptsFromDB = async (userId, { quiz_id, page, limit }) => {
    let pageNum = parseInt(page, 10);
    let limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) pageNum = 1;
    if (isNaN(limitNum) || limitNum < 1) limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT qa.attempt_id, qa.quiz_id, qa.score, qa.attempted_at, q.title as quiz_title, n.title as note_title,
             (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id) as total_questions
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.quiz_id
      JOIN notes n ON q.note_id = n.note_id
      WHERE qa.user_id = ?`;
    const params = [userId];
    if (quiz_id !== undefined && quiz_id !== null && quiz_id !== '') {
        query += ' AND qa.quiz_id = ?';
        params.push(quiz_id);
    }
    // LIMIT/OFFSET을 쿼리문에 직접 삽입
    query += ` ORDER BY qa.attempted_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

    console.log('쿼리 파라미터:', params);

    const [attempts] = await pool.execute(query, params);
    
    // 각 시도에 대해 정답 수와 정답률 정보 추가
    const enhancedAttempts = attempts.map(attempt => {
        const correctCount = Math.round((attempt.score / 100) * attempt.total_questions);
        return {
            ...attempt,
            correct_count: correctCount,
            accuracy: attempt.score, // score가 이미 정답률(%)
            accuracy_display: `${correctCount}/${attempt.total_questions}`
        };
    });

    let countQuery = 'SELECT COUNT(*) as total FROM quiz_attempts qa WHERE qa.user_id = ?';
    const countParams = [userId];
    if (quiz_id !== undefined && quiz_id !== null && quiz_id !== '') {
        countQuery += ' AND qa.quiz_id = ?';
        countParams.push(quiz_id);
    }
    const [countResult] = await pool.execute(countQuery, countParams);

    return { attempts: enhancedAttempts, total: countResult[0].total };
};

/**
 * 특정 퀴즈 시도 기록의 상세 정보를 조회합니다.
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
    attempt.answers = JSON.parse(attempt.answers);
    
    // 해당 퀴즈의 문제 수를 가져와서 정답률 계산
    const [questions] = await pool.execute('SELECT COUNT(*) as total_questions FROM quiz_questions WHERE quiz_id = ?', [attempt.quiz_id]);
    const totalQuestions = questions[0].total_questions;
    
    // score는 이미 백분율로 저장되어 있음 (0-100)
    const correctCount = Math.round((attempt.score / 100) * totalQuestions);
    
    // 추가 정보 계산
    attempt.total_questions = totalQuestions;
    attempt.correct_count = correctCount;
    attempt.accuracy = attempt.score; // score가 이미 정답률(%)
    attempt.accuracy_display = `${correctCount}/${totalQuestions}`;
    
    return attempt;
};

/**
 * 사용자가 제출한 답안을 채점하고 결과를 DB에 저장합니다.
 */
const submitQuizAttempt = async (userId, quizId, answers) => {
    console.log('=== 퀴즈 채점 시작 ===');
    console.log('사용자 ID:', userId);
    console.log('퀴즈 ID:', quizId);
    console.log('제출된 답안:', answers);
    
    const [questions] = await pool.execute('SELECT question_id, correct_answer, question_type, question_text FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    console.log('퀴즈 문제 수:', questions.length);
    
    if (questions.length === 0) throw new Error('채점할 문제가 없는 퀴즈입니다.');

    let correctCount = 0;
    const results = [];
    questions.forEach(q => {
        const userAnswer = answers[q.question_id] || "";
        const isCorrect = q.question_type === 'short_answer'
            ? userAnswer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            : userAnswer === q.correct_answer;
        if (isCorrect) correctCount++;
        
        console.log(`문제 ${q.question_id}: 사용자답안="${userAnswer}", 정답="${q.correct_answer}", 맞음=${isCorrect}`);
        
        results.push({ 
            question_id: q.question_id, 
            question_text: q.question_text,
            user_answer: userAnswer,
            correct_answer: q.correct_answer,
            is_correct: isCorrect 
        });
    });
    
    const score = (questions.length > 0) ? (correctCount / questions.length) * 100 : 0;
    const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    
    console.log('=== 채점 결과 ===');
    console.log('정답 수:', correctCount);
    console.log('총 문제 수:', questions.length);
    console.log('정답률 계산:', `(${correctCount} / ${questions.length}) * 100 = ${accuracy.toFixed(1)}%`);
    console.log('점수 (DB 저장용):', parseFloat(score.toFixed(2)));
    
    const [result] = await pool.execute(
        'INSERT INTO quiz_attempts (quiz_id, user_id, score, answers) VALUES (?, ?, ?, ?)',
        [quizId, userId, score, JSON.stringify(answers)]
    );
    
    const finalResult = { 
        attempt_id: result.insertId, 
        score: parseFloat(score.toFixed(2)), // DB 호환성을 위해 유지
        correct_count: correctCount, 
        total_questions: questions.length,
        accuracy: parseFloat(accuracy.toFixed(1)), // 정답률 (%)
        accuracy_display: `${correctCount}/${questions.length}`, // 시각적 표시용
        results 
    };
    
    console.log('반환할 결과:', finalResult);
    console.log('=== 퀴즈 채점 완료 ===');
    
    return finalResult;
};

/**
 * 특정 퀴즈 시도 기록을 삭제합니다.
 */
const deleteQuizAttemptById = async (userId, attemptId) => {
    const [result] = await pool.execute('DELETE FROM quiz_attempts WHERE attempt_id = ? AND user_id = ?', [attemptId, userId]);
    return result.affectedRows > 0;
};

/**
 * 사용자의 퀴즈 통계를 조회합니다.
 */
const getQuizStatsFromDB = async (userId) => {
    console.log('=== 퀴즈 통계 조회 시작 ===');
    console.log('사용자 ID:', userId);
    
    const statsQuery = `
        SELECT 
            COUNT(*) as total_attempts,
            AVG(score) as avg_score,
            MAX(score) as best_score
        FROM quiz_attempts 
        WHERE user_id = ?`;
    const [statsResult] = await pool.execute(statsQuery, [userId]);
    
    console.log('통계 쿼리 결과:', statsResult[0]);

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
    
    console.log('점수 분포 결과:', distribution);

    const result = {
        overall_stats: {
            total_attempts: parseInt(statsResult[0].total_attempts) || 0,
            avg_score: parseFloat(statsResult[0].avg_score || 0).toFixed(2),
            best_score: parseFloat(statsResult[0].best_score || 0).toFixed(2)
        },
        score_distribution: distribution
    };
    
    console.log('최종 통계 결과:', result);
    console.log('=== 퀴즈 통계 조회 완료 ===');
    
    return result;
};

module.exports = {
    getQuizAttemptsFromDB,
    getQuizAttemptById,
    submitQuizAttempt,
    deleteQuizAttemptById,
    getQuizStatsFromDB
};