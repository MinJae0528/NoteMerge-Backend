const { pool } = require('../config/database');

const getQuizzesFromDB = async (userId, { note_id, page = 1, limit = 20 }) => {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;
    
    console.log('getQuizzesFromDB 파라미터:', { userId, note_id, pageNum, limitNum, offset });
    
    let query = `
      SELECT q.quiz_id, q.title, q.created_at, n.note_id, n.title as note_title,
             (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.quiz_id) as question_count
      FROM quizzes q
      INNER JOIN notes n ON q.note_id = n.note_id
      WHERE n.user_id = ?`;
    const params = [userId];
    if (note_id) { query += ' AND q.note_id = ?'; params.push(note_id); }
    query += ` ORDER BY q.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    // params.push(limitNum, offset); // LIMIT/OFFSET을 직접 삽입으로 변경
    
    console.log('SQL 쿼리 파라미터:', params);
    console.log('실행할 쿼리:', query);
    const [quizzes] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM quizzes q INNER JOIN notes n ON q.note_id = n.note_id WHERE n.user_id = ?';
    const countParams = [userId];
    if (note_id) { countQuery += ' AND q.note_id = ?'; countParams.push(note_id); }
    const [countResult] = await pool.execute(countQuery, countParams);
    
    return { quizzes, total: countResult[0].total };
};

const getQuizDetailsById = async (userId, quizId) => {
    const [quizzes] = await pool.execute(
        `SELECT q.*, n.note_id, n.title as note_title FROM quizzes q 
         INNER JOIN notes n ON q.note_id = n.note_id WHERE q.quiz_id = ? AND n.user_id = ?`,
        [quizId, userId]
    );
    if (quizzes.length === 0) return null;
    
    const [questions] = await pool.execute('SELECT * FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    return { 
        ...quizzes[0], 
        questions: questions.map(q => {
            let options = null;
            if (q.options) {
                try {
                    options = JSON.parse(q.options);
                } catch (error) {
                    console.error('JSON parse error for options:', q.options, error);
                    options = null;
                }
            }
            return { ...q, options };
        })
    };
};

const createQuizInDB = async (userId, noteId, title, questions) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // quizzes 테이블에 user_id가 있으므로 포함
        const [quizResult] = await connection.execute('INSERT INTO quizzes (note_id, user_id, title) VALUES (?, ?, ?)', [noteId, userId, title]);
        const quizId = quizResult.insertId;

        if (questions && questions.length > 0) {
            console.log('퀴즈 문제 저장 중:', questions);
            const questionValues = questions.map(q => [
                quizId, 
                q.question || q.question_text, 
                q.type || q.question_type, 
                JSON.stringify(q.options || []), 
                q.correct_answer
            ]);
            console.log('변환된 question values:', questionValues);
            await connection.query('INSERT INTO quiz_questions (quiz_id, question_text, question_type, options, correct_answer) VALUES ?', [questionValues]);
        }
        
        await connection.commit();
        return { quiz_id: quizId, title, note_id: noteId, question_count: questions.length };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

const deleteQuizFromDB = async (userId, quizId) => {
    const [quizzes] = await pool.execute(
        `SELECT q.quiz_id FROM quizzes q INNER JOIN notes n ON q.note_id = n.note_id WHERE q.quiz_id = ? AND n.user_id = ?`, 
        [quizId, userId]
    );
    if (quizzes.length === 0) throw new Error('퀴즈를 찾을 수 없거나 삭제 권한이 없습니다.');
    
    const [result] = await pool.execute('DELETE FROM quizzes WHERE quiz_id = ?', [quizId]);
    return result.affectedRows > 0;
};

module.exports = {
    getQuizzesFromDB,
    getQuizDetailsById,
    createQuizInDB,
    deleteQuizFromDB,
};

