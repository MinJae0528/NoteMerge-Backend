// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token이 필요합니다.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // 디코딩된 userId를 사용하여 사용자 정보 조회 (토큰이 유효한 사용자인지 DB에서 확인)
        const [users] = await pool.execute('SELECT user_id, username, email FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
        }

        req.user = users[0]; // req.user에 사용자 정보 할당
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: '토큰이 만료되었습니다.' });
        }
        return res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
};

const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null; // 토큰이 없으면 req.user를 null로 설정
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [users] = await pool.execute('SELECT user_id, username, email FROM users WHERE user_id = ?', [decoded.userId]);

        if (users.length > 0) {
            req.user = users[0];
        } else {
            req.user = null; // 사용자를 찾을 수 없으면 null
        }
    } catch (error) {
        req.user = null; // 토큰 검증 실패 시 null
    }

    next();
};

module.exports = {
    authenticateToken,
    optionalAuth
};