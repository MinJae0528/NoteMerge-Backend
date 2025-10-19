// src/services/noteService.js
const { pool } = require('../config/database');

// (비공개 헬퍼 함수) 노트에 대한 키워드 처리
const _handleNoteKeywords = async (connection, noteId, keywordNames) => {
    await connection.execute('DELETE FROM note_keywords WHERE note_id = ?', [noteId]);
    if (!keywordNames || keywordNames.length === 0) {
        return;
    }
    for (const keywordName of keywordNames) {
        const trimmedName = keywordName.trim();
        if (!trimmedName) continue;
        let [keywordRows] = await connection.execute('SELECT keyword_id FROM keywords WHERE name = ?', [trimmedName]);
        let keywordId;
        if (keywordRows.length === 0) {
            const [insertResult] = await connection.execute('INSERT INTO keywords (name) VALUES (?)', [trimmedName]);
            keywordId = insertResult.insertId;
        } else {
            keywordId = keywordRows[0].keyword_id;
        }
        await connection.execute('INSERT INTO note_keywords (note_id, keyword_id) VALUES (?, ?)', [noteId, keywordId]);
    }
};

// 노트 목록 조회
const getNotesFromDB = async (userId, { folder_id, search, page = 1, limit = 20 }) => {
    try {
        let query = `
          SELECT n.note_id, n.title, n.summary, n.created_at, n.updated_at, n.folder_id,
                 f.name as folder_name
          FROM notes n
          LEFT JOIN folders f ON n.folder_id = f.folder_id
          WHERE n.user_id = ?`;
        const queryParams = [userId];
        
        if (folder_id) { 
            query += ' AND n.folder_id = ?'; 
            queryParams.push(folder_id); 
        }
        
        if (search) {
            query += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.summary LIKE ?)';
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        query += ' ORDER BY n.created_at DESC LIMIT 20 OFFSET 0';
        
        const [notes] = await pool.execute(query, queryParams);
        
        let countQuery = `SELECT COUNT(*) as total FROM notes n WHERE n.user_id = ?`;
        const countParams = [userId];
        if (folder_id) { 
            countQuery += ' AND n.folder_id = ?'; 
            countParams.push(folder_id); 
        }
        if (search) {
            countQuery += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.summary LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;
        return { notes, total };
        
    } catch (error) {
        throw error;
    }
};

// 노트 상세 조회
const getNoteById = async (noteId, userId) => {
    try {
        const [notes] = await pool.execute(
            `SELECT n.note_id, n.user_id, n.file_id, n.folder_id, n.title, n.content, 
                    n.summary, n.created_at, n.updated_at
             FROM notes n
             WHERE n.note_id = ? AND n.user_id = ?`, 
            [noteId, userId]
        );
        
        if (notes.length === 0) return null;
        
        // 키워드 정보 별도로 조회
        const [keywords] = await pool.execute(
            `SELECT k.keyword_id, k.name 
             FROM keywords k
             JOIN note_keywords nk ON k.keyword_id = nk.keyword_id
             WHERE nk.note_id = ?`,
            [noteId]
        );
        
        const note = notes[0];
        note.keywords = keywords;
        
        return note;
    } catch (error) {
        console.error('getNoteById error:', error);
        throw error;
    }
};

// 노트 생성 (트랜잭션)
const createNoteInDB = async (noteData, aiData, keywordsData) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const { userId, folder_id, fileId, title, content, keywords } = noteData;
        const { summary, embedding } = aiData;
        let sql, params;
        if (fileId) {
            sql = 'INSERT INTO notes (user_id, file_id, folder_id, title, content, summary, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)';
            params = [userId, fileId, folder_id || null, title || null, content, summary, embedding];
        } else {
            sql = 'INSERT INTO notes (user_id, folder_id, title, content, summary, embedding) VALUES (?, ?, ?, ?, ?, ?)';
            params = [userId, folder_id || null, title || null, content, summary, embedding];
        }
        const [result] = await connection.execute(sql, params);
        const noteId = result.insertId;
        await _handleNoteKeywords(connection, noteId, keywords);
        await connection.commit();
        return { note_id: noteId };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

// 노트 수정을 위한 기존 노트 정보 조회
const findNoteForUpdate = async (noteId, userId) => {
    const [rows] = await pool.execute(
        'SELECT file_id, title, content, summary, embedding FROM notes WHERE note_id = ? AND user_id = ?',
        [noteId, userId]
    );
    return rows[0];
};

// 노트 업데이트 (트랜잭션)
const updateNoteInDB = async (noteId, userId, noteData, aiData, keywordsData) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const { title, content, folder_id, fileId, keywords } = noteData;
        const { summary, embedding } = aiData;
        const params = [
            title !== undefined ? title : null,
            content !== undefined ? content : null,
            summary !== undefined ? summary : null,
            embedding !== undefined ? embedding : null,
            noteId,
            userId
        ];
        await pool.execute(
            'UPDATE notes SET title = ?, content = ?, summary = ?, embedding = ? WHERE note_id = ? AND user_id = ?',
            params
        );
        await _handleNoteKeywords(connection, noteId, keywords);
        await connection.commit();
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

// 노트 삭제 (트랜잭션)
const deleteNoteFromDB = async (noteId, userId) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [notes] = await connection.execute('SELECT file_id FROM notes WHERE note_id = ? AND user_id = ?', [noteId, userId]);
        if (notes.length === 0) throw new Error('삭제할 노트를 찾을 수 없습니다.');
        const fileIdToDelete = notes[0].file_id;
        await connection.execute('DELETE FROM notes WHERE note_id = ?', [noteId]);
        let fileToDelete = null;
        if (fileIdToDelete) {
            const [fileRecord] = await connection.execute('SELECT * FROM files WHERE file_id = ?', [fileIdToDelete]);
            if (fileRecord.length > 0) {
                fileToDelete = fileRecord[0];
                await connection.execute('DELETE FROM files WHERE file_id = ?', [fileIdToDelete]);
            }
        }
        await connection.commit();
        return fileToDelete;
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

/**
 * 특정 노트가 존재하는지, 그리고 해당 사용자의 소유인지 확인합니다.
 * @param {number} noteId - 확인할 노트의 ID
 * @param {number} userId - 사용자의 ID
 * @returns {Promise<boolean>} 노트가 존재하고 소유자가 맞으면 true, 아니면 false
 */
const checkNoteExists = async (noteId, userId) => {
    const [rows] = await pool.execute(
        'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
        [noteId, userId]
    );
    return rows.length > 0;
};

// module.exports에 모든 함수를 포함하도록 수정
module.exports = {
    getNotesFromDB,
    getNoteById,
    createNoteInDB,
    findNoteForUpdate,
    updateNoteInDB,
    deleteNoteFromDB,
    checkNoteExists // 👈 새로 추가된 함수
};

