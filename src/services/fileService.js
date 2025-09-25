// src/services/folderService.js
const { pool } = require('../config/database');

const createFolder = async (userId, name, parentFolderId = null) => {
    const sql = 'INSERT INTO Folders (user_id, name, parent_folder_id) VALUES (?, ?, ?)';
    const [result] = await pool.execute(sql, [userId, name, parentFolderId]);
    return { folder_id: result.insertId, name, parent_folder_id: parentFolderId };
};

const getFoldersByUserId = async (userId) => {
    const sql = 'SELECT folder_id, name, parent_folder_id FROM Folders WHERE user_id = ? ORDER BY name ASC';
    const [folders] = await pool.execute(sql, [userId]);
    return folders;
};

const updateFolder = async (userId, folderId, newName) => {
    const sql = 'UPDATE Folders SET name = ? WHERE folder_id = ? AND user_id = ?';
    const [result] = await pool.execute(sql, [newName, folderId, userId]);
    return result.affectedRows > 0;
};

const deleteFolder = async (userId, folderId) => {
    const sql = 'DELETE FROM Folders WHERE folder_id = ? AND user_id = ?';
    const [result] = await pool.execute(sql, [folderId, userId]);
    return result.affectedRows > 0;
};

/**
 * AI가 추출한 키워드를 기반으로 노트를 자동으로 폴더에 정리합니다.
 * @param {number} noteId 정리할 노트 ID
 * @param {Array<object>} keywords AI가 추출한 키워드 객체 배열
 * @param {number} userId 사용자 ID
 */
const autoOrganizeNoteByKeywords = async (noteId, keywords, userId) => {
    if (!keywords || keywords.length === 0) return;

    // 가장 관련성 높은 키워드를 폴더 이름으로 사용
    const primaryKeyword = keywords.sort((a, b) => b.score - a.score)[0].word;
    
    let connection;
    try {
        connection = await pool.getConnection();
        
        let [folders] = await connection.execute('SELECT folder_id FROM Folders WHERE name = ? AND user_id = ?', [primaryKeyword, userId]);
        let folderId;

        if (folders.length > 0) {
            folderId = folders[0].folder_id;
        } else {
            const [result] = await connection.execute('INSERT INTO Folders (user_id, name) VALUES (?, ?)', [userId, primaryKeyword]);
            folderId = result.insertId;
        }
        
        await connection.execute('UPDATE Notes SET folder_id = ? WHERE note_id = ? AND user_id = ?', [folderId, noteId, userId]);
        console.log(`[Auto Folder] Note ID ${noteId} has been moved to folder '${primaryKeyword}' (ID: ${folderId}).`);
    } catch (error) {
        console.error("자동 폴더 정리 중 에러 발생:", error);
    } finally {
        if (connection) connection.release();
    }
};


module.exports = {
    createFolder,
    getFoldersByUserId,
    updateFolder,
    deleteFolder,
    autoOrganizeNoteByKeywords // 👈 이 함수를 추가했습니다.
};