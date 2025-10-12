// src/services/fileService.js
const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * 파일 정보를 데이터베이스에 저장합니다.
 */
const createFile = async (fileData) => {
    const { userId, fileName, fileUrl, filePath, fileSize, fileType, folderId = null } = fileData;
    
    const sql = `
        INSERT INTO files (user_id, folder_id, original_name, storage_url, file_path, file_type, file_size, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const [result] = await pool.execute(sql, [
        userId, 
        folderId, 
        fileName, 
        fileUrl, 
        filePath, 
        fileType, 
        fileSize
    ]);
    
    return result.insertId;
};

/**
 * 파일 ID로 파일 정보를 조회합니다.
 */
const getFileById = async (fileId) => {
    const sql = 'SELECT * FROM files WHERE file_id = ?';
    const [rows] = await pool.execute(sql, [fileId]);
    return rows.length > 0 ? rows[0] : null;
};

/**
 * 사용자의 파일 목록을 조회합니다.
 */
const getFilesByUserId = async (userId, folderId = null) => {
    let sql = 'SELECT * FROM files WHERE user_id = ?';
    const params = [userId];
    
    if (folderId !== null) {
        sql += ' AND folder_id = ?';
        params.push(folderId);
    }
    
    sql += ' ORDER BY uploaded_at DESC';
    
    const [files] = await pool.execute(sql, params);
    return files;
};

/**
 * 파일을 삭제합니다.
 */
const deleteFile = async (fileId, userId) => {
    let connection;
    try {
        const fileInfo = await getFileById(fileId);
        if (!fileInfo) {
            throw new Error('파일을 찾을 수 없습니다.');
        }
        
        if (fileInfo.user_id !== userId) {
            throw new Error('파일 삭제 권한이 없습니다.');
        }
        
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const [result] = await connection.execute(
            'DELETE FROM files WHERE file_id = ? AND user_id = ?',
            [fileId, userId]
        );
        
        if (result.affectedRows === 0) {
            throw new Error('파일 삭제에 실패했습니다.');
        }
        
        try {
            await fs.unlink(fileInfo.file_path);
            console.log(`[deleteFile] 파일 삭제 완료: ${fileInfo.file_path}`);
        } catch (fsError) {
            console.warn(`[deleteFile] 물리적 파일 삭제 실패: ${fileInfo.file_path}`, fsError.message);
        }
        
        await connection.commit();
        return true;
        
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createFile,
    getFileById,
    getFilesByUserId,
    deleteFile
};