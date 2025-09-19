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
    // TODO: 폴더 삭제 시 내부 노트들의 처리 정책 결정 필요
    const sql = 'DELETE FROM Folders WHERE folder_id = ? AND user_id = ?';
    const [result] = await pool.execute(sql, [folderId, userId]);
    return result.affectedRows > 0;
};

module.exports = {
    createFolder,
    getFoldersByUserId,
    updateFolder,
    deleteFolder
};