// src/services/folderService.js
const { pool } = require('../config/database');

const getFoldersByUserId = async (userId, parentFolderId) => {
    let query = `
      SELECT f.folder_id, f.name, f.parent_folder_id, f.created_at, f.updated_at, COUNT(n.note_id) as note_count
      FROM Folders f
      LEFT JOIN Notes n ON f.folder_id = n.folder_id
      WHERE f.user_id = ?`;
    const queryParams = [userId];

    if (parentFolderId !== undefined) {
        query += (parentFolderId === null || parentFolderId === 'null')
            ? ' AND f.parent_folder_id IS NULL'
            : ' AND f.parent_folder_id = ?';
        if (parentFolderId !== null && parentFolderId !== 'null') queryParams.push(parentFolderId);
    }

    query += ' GROUP BY f.folder_id ORDER BY f.created_at DESC';
    const [folders] = await pool.execute(query, queryParams);
    return folders;
};

const getFolderDetailsById = async (userId, folderId) => {
    const [folders] = await pool.execute('SELECT folder_id, name, parent_folder_id, created_at FROM Folders WHERE folder_id = ? AND user_id = ?', [folderId, userId]);
    if (folders.length === 0) return null;

    const [subFolders] = await pool.execute('SELECT folder_id, name, created_at FROM Folders WHERE parent_folder_id = ? AND user_id = ? ORDER BY name ASC', [folderId, userId]);
    const [notes] = await pool.execute('SELECT note_id, title, created_at FROM Notes WHERE folder_id = ? AND user_id = ? ORDER BY created_at DESC', [folderId, userId]);
    
    return { ...folders[0], sub_folders: subFolders, notes };
};

const createFolder = async (userId, name, parentFolderId) => {
    if (parentFolderId) {
        const [parent] = await pool.execute('SELECT folder_id FROM Folders WHERE folder_id = ? AND user_id = ?', [parentFolderId, userId]);
        if (parent.length === 0) throw new Error('상위 폴더를 찾을 수 없습니다.');
    }
    
    const [existing] = await pool.execute('SELECT folder_id FROM Folders WHERE name = ? AND parent_folder_id <=> ? AND user_id = ?', [name, parentFolderId || null, userId]);
    if (existing.length > 0) throw new Error('같은 이름의 폴더가 이미 존재합니다.');
    
    const [result] = await pool.execute('INSERT INTO Folders (user_id, name, parent_folder_id) VALUES (?, ?, ?)', [userId, name, parentFolderId || null]);
    return { folder_id: result.insertId, name, parent_folder_id: parentFolderId || null, created_at: new Date() };
};

const updateFolder = async (userId, folderId, name, parentFolderId) => {
    const [targetFolder] = await pool.execute('SELECT folder_id FROM Folders WHERE folder_id = ? AND user_id = ?', [folderId, userId]);
    if (targetFolder.length === 0) throw new Error('수정할 폴더를 찾을 수 없습니다.');

    if (parentFolderId) {
        if (parseInt(parentFolderId) === parseInt(folderId)) throw new Error('자기 자신을 상위 폴더로 설정할 수 없습니다.');
        const [parent] = await pool.execute('SELECT folder_id FROM Folders WHERE folder_id = ? AND user_id = ?', [parentFolderId, userId]);
        if (parent.length === 0) throw new Error('상위 폴더를 찾을 수 없습니다.');
    }

    const [existing] = await pool.execute('SELECT folder_id FROM Folders WHERE name = ? AND parent_folder_id <=> ? AND user_id = ? AND folder_id != ?', [name, parentFolderId || null, userId, folderId]);
    if (existing.length > 0) throw new Error('같은 이름의 폴더가 이미 존재합니다.');

    const [result] = await pool.execute('UPDATE Folders SET name = ?, parent_folder_id = ? WHERE folder_id = ? AND user_id = ?', [name, parentFolderId || null, folderId, userId]);
    return result.affectedRows > 0;
};

const deleteFolder = async (userId, folderId) => {
    const [targetFolder] = await pool.execute('SELECT folder_id FROM Folders WHERE folder_id = ? AND user_id = ?', [folderId, userId]);
    if (targetFolder.length === 0) throw new Error('삭제할 폴더를 찾을 수 없습니다.');

    const [subFolders] = await pool.execute('SELECT folder_id FROM Folders WHERE parent_folder_id = ?', [folderId]);
    if (subFolders.length > 0) throw new Error('하위 폴더가 있는 폴더는 삭제할 수 없습니다.');

    const [notes] = await pool.execute('SELECT note_id FROM Notes WHERE folder_id = ?', [folderId]);
    if (notes.length > 0) throw new Error('노트가 있는 폴더는 삭제할 수 없습니다.');
    
    const [result] = await pool.execute('DELETE FROM Folders WHERE folder_id = ? AND user_id = ?', [folderId, userId]);
    return result.affectedRows > 0;
};

const getFolderTreeByUserId = async (userId) => {
    const [allFolders] = await pool.execute('SELECT folder_id, name, parent_folder_id FROM Folders WHERE user_id = ? ORDER BY name ASC', [userId]);
    
    const buildTree = (parentId = null) => {
        return allFolders
            .filter(folder => folder.parent_folder_id === parentId)
            .map(folder => ({
                ...folder,
                children: buildTree(folder.folder_id)
            }));
    };
    return buildTree();
};

module.exports = {
    createFolder,
    getFoldersByUserId,
    getFolderDetailsById,
    updateFolder,
    deleteFolder,
    getFolderTreeByUserId
};