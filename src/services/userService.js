// src/services/userService.js
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const createUser = async (username, email, password) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [existing] = await connection.execute('SELECT username, email FROM Users WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            if (existing.some(u => u.username === username)) throw new Error('이미 사용 중인 사용자명입니다.');
            if (existing.some(u => u.email === email)) throw new Error('이미 사용 중인 이메일입니다.');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await connection.execute('INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);
        const userId = result.insertId;

        await connection.execute('INSERT INTO Folders (user_id, name) VALUES (?, ?)', [userId, '기본 폴더']);
        
        await connection.commit();
        return { user_id: userId, username, email };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

const findUserForLogin = async (identifier) => {
    const [users] = await pool.execute('SELECT user_id, username, email, password_hash FROM Users WHERE username = ? OR email = ?', [identifier, identifier]);
    return users[0];
};

const findUserForProfile = async (userId) => {
    const [users] = await pool.execute('SELECT user_id, username, email, created_at FROM Users WHERE user_id = ?', [userId]);
    return users[0];
};

const updateUserProfile = async (userId, username, email) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (username) {
            const [existing] = await connection.execute('SELECT user_id FROM Users WHERE username = ? AND user_id != ?', [username, userId]);
            if (existing.length > 0) throw new Error('이미 사용 중인 사용자명입니다.');
        }
        if (email) {
            const [existing] = await connection.execute('SELECT user_id FROM Users WHERE email = ? AND user_id != ?', [email, userId]);
            if (existing.length > 0) throw new Error('이미 사용 중인 이메일입니다.');
        }
        
        const updateFields = [];
        const updateValues = [];
        if (username) { updateFields.push('username = ?'); updateValues.push(username); }
        if (email) { updateFields.push('email = ?'); updateValues.push(email); }
        
        if (updateFields.length === 0) throw new Error('수정할 정보가 없습니다.');
        
        updateValues.push(userId);
        await connection.execute(`UPDATE Users SET ${updateFields.join(', ')} WHERE user_id = ?`, updateValues);
        
        await connection.commit();
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

const changeUserPassword = async (userId, currentPassword, newPassword) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [users] = await connection.execute('SELECT password_hash FROM Users WHERE user_id = ?', [userId]);
        if (users.length === 0) throw new Error('사용자를 찾을 수 없습니다.');
        
        const isPasswordValid = await bcrypt.compare(currentPassword, users[0].password_hash);
        if (!isPasswordValid) throw new Error('현재 비밀번호가 올바르지 않습니다.');
        
        const newPasswordHash = await bcrypt.hash(newPassword, 12);
        await connection.execute('UPDATE Users SET password_hash = ? WHERE user_id = ?', [newPasswordHash, userId]);
        
        await connection.commit();
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = {
    createUser,
    findUserForLogin,
    findUserForProfile,
    updateUserProfile,
    changeUserPassword
};