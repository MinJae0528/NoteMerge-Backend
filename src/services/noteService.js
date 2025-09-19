// src/services/noteService.js
const { pool } = require('../config/database');

// (비공개 헬퍼 함수) 노트에 대한 태그 처리
const _handleNoteTags = async (connection, noteId, tagNames) => {
    // 기존 태그 연결 삭제
    await connection.execute('DELETE FROM Note_Tag_Link WHERE note_id = ?', [noteId]);
    
    // 새 태그가 없으면 여기서 종료
    if (!tagNames || tagNames.length === 0) {
        return;
    }
    
    // 새 태그들을 순회하며 연결
    for (const tagName of tagNames) {
        const trimmedName = tagName.trim();
        if (!trimmedName) continue; // 빈 태그는 무시

        // 태그가 이미 존재하는지 확인
        let [tagRows] = await connection.execute('SELECT tag_id FROM Tag WHERE name = ?', [trimmedName]);
        let tagId;

        if (tagRows.length === 0) {
            // 존재하지 않으면 새로 생성
            const [insertResult] = await connection.execute('INSERT INTO Tag (name) VALUES (?)', [trimmedName]);
            tagId = insertResult.insertId;
        } else {
            // 존재하면 기존 ID 사용
            tagId = tagRows[0].tag_id;
        }
        
        // 노트와 태그 연결
        await connection.execute('INSERT INTO Note_Tag_Link (note_id, tag_id) VALUES (?, ?)', [noteId, tagId]);
    }
};

// 노트 목록 조회
const getNotesFromDB = async (userId, { folder_id, search, page = 1, limit = 20 }) => {
    let query = `
      SELECT n.note_id, n.title, n.summary, n.created_at, n.updated_at, n.folder_id,
             f.name as folder_name, fi.file_id, fi.file_name, fi.file_type, fi.file_url,
             GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC SEPARATOR ',') as tags
      FROM Note n
      LEFT JOIN Folder f ON n.folder_id = f.folder_id
      LEFT JOIN File fi ON n.file_id = fi.file_id
      LEFT JOIN Note_Tag_Link ntl ON n.note_id = ntl.note_id
      LEFT JOIN Tag t ON ntl.tag_id = t.tag_id
      WHERE n.user_id = ?`;
    const queryParams = [userId];

    if (folder_id) { query += ' AND n.folder_id = ?'; queryParams.push(folder_id); }
    if (search) {
        query += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.summary LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' GROUP BY n.note_id ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    queryParams.push(parseInt(limit), offset);
    
    const [notes] = await pool.execute(query, queryParams);
    
    let countQuery = `SELECT COUNT(DISTINCT n.note_id) as total FROM Note n WHERE n.user_id = ?`;
    const countParams = [userId];
    if (folder_id) { countQuery += ' AND n.folder_id = ?'; countParams.push(folder_id); }
    if (search) {
        countQuery += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.summary LIKE ?)';
        const searchTerm = `%${search}%`;
        countParams.push(searchTerm, searchTerm, searchTerm);
    }
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    return { notes, total };
};

// 노트 상세 조회
const getNoteById = async (noteId, userId) => {
    const [notes] = await pool.execute(
        `SELECT n.*, f.name as folder_name, fi.file_id, fi.file_name, fi.file_type, fi.file_url, fi.file_size, fi.uploaded_at,
                GROUP_CONCAT(DISTINCT t.tag_id, ':', t.name ORDER BY t.name ASC SEPARATOR ',') as tags
         FROM Note n
         LEFT JOIN Folder f ON n.folder_id = f.folder_id
         LEFT JOIN File fi ON n.file_id = fi.file_id
         LEFT JOIN Note_Tag_Link ntl ON n.note_id = ntl.note_id
         LEFT JOIN Tag t ON ntl.tag_id = t.tag_id
         WHERE n.note_id = ? AND n.user_id = ?
         GROUP BY n.note_id`, [noteId, userId]
    );
    if (notes.length === 0) return null;
    
    const [keywords] = await pool.execute('SELECT word, score FROM Keyword WHERE note_id = ? ORDER BY score DESC', [noteId]);
    return { ...notes[0], keywords };
};

// 노트 생성 (트랜잭션)
const createNoteInDB = async (noteData, aiData, keywordsData) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { userId, folder_id, fileId, title, content, tags } = noteData;
        const { summary, embedding } = aiData;
        
        const [result] = await connection.execute(
            'INSERT INTO Note (user_id, folder_id, file_id, title, content, summary, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, folder_id || null, fileId, title || null, content, summary, embedding]
        );
        const noteId = result.insertId;

        await _handleNoteTags(connection, noteId, tags);

        if (keywordsData && keywordsData.length > 0) {
            const keywordValues = keywordsData.map(kw => [noteId, kw.word, kw.score]);
            await connection.query('INSERT INTO Keyword (note_id, word, score) VALUES ?', [keywordValues]);
        }
        
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
    const [notes] = await pool.execute('SELECT file_id, title, content, summary, embedding FROM Note WHERE note_id = ? AND user_id = ?', [noteId, userId]);
    return notes[0];
};

// 노트 업데이트 (트랜잭션)
const updateNoteInDB = async (noteId, userId, noteData, aiData, keywordsData) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const { title, content, folder_id, fileId, tags } = noteData;
        const { summary, embedding } = aiData;

        const sql = `
            UPDATE Note SET
                title = ?, content = ?, folder_id = ?, file_id = ?,
                summary = ?, embedding = ?, updated_at = CURRENT_TIMESTAMP
            WHERE note_id = ? AND user_id = ?`;
        
        await connection.execute(sql, [title, content, folder_id, fileId, summary, embedding, noteId, userId]);
        
        await _handleNoteTags(connection, noteId, tags);
        
        await connection.execute('DELETE FROM Keyword WHERE note_id = ?', [noteId]);
        if (keywordsData && keywordsData.length > 0) {
            const keywordValues = keywordsData.map(kw => [noteId, kw.word, kw.score]);
            await connection.query('INSERT INTO Keyword (note_id, word, score) VALUES ?', [keywordValues]);
        }

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

        const [notes] = await connection.execute('SELECT file_id FROM Note WHERE note_id = ? AND user_id = ?', [noteId, userId]);
        if (notes.length === 0) throw new Error('삭제할 노트를 찾을 수 없습니다.');
        
        const fileIdToDelete = notes[0].file_id;
        
        await connection.execute('DELETE FROM Note WHERE note_id = ?', [noteId]);

        let fileToDelete = null;
        if (fileIdToDelete) {
            const [fileRecord] = await connection.execute('SELECT * FROM File WHERE file_id = ?', [fileIdToDelete]);
            if (fileRecord.length > 0) {
                fileToDelete = fileRecord[0];
                await connection.execute('DELETE FROM File WHERE file_id = ?', [fileIdToDelete]);
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

module.exports = {
    getNotesFromDB,
    getNoteById,
    createNoteInDB,
    findNoteForUpdate,
    updateNoteInDB,
    deleteNoteFromDB
};