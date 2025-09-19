// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userService = require('../services/userService');

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
        }
        const newUser = await userService.createUser(username, email, password);
        const token = jwt.sign({ userId: newUser.user_id, username: newUser.username, email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ success: true, message: '회원가입이 완료되었습니다.', data: { user: newUser, token } });
    } catch (error) {
        console.error('Register Controller Error:', error);
        if (error.message.includes('사용 중인')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

const login = async (req, res) => {
    try {
        // ✨ 이 부분을 수정했습니다.
        // 이제 email 또는 username을 직접 받아서 처리합니다.
        const { email, username, password } = req.body;
        const identifier = email || username; // 둘 중 들어온 값을 identifier로 사용

        if (!identifier || !password) {
            return res.status(400).json({ success: false, message: '사용자 정보와 비밀번호를 모두 입력해주세요.' });
        }

        const user = await userService.findUserForLogin(identifier);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: '사용자 정보 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        const token = jwt.sign({ userId: user.user_id, username: user.username, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ 
            success: true, 
            message: '로그인에 성공했습니다.', 
            data: { 
                user: { user_id: user.user_id, username: user.username, email: user.email }, 
                token 
            } 
        });
    } catch (error) {
        console.error('Login Controller Error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await userService.findUserForProfile(req.user.user_id);
        if (!user) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
        res.json({ success: true, data: { user } });
    } catch (error) {
        console.error('Get Profile Controller Error:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { username, email } = req.body;
        await userService.updateUserProfile(req.user.user_id, username, email);
        res.json({ success: true, message: '프로필이 수정되었습니다.' });
    } catch (error) {
        console.error('Update Profile Controller Error:', error);
        if (error.message.includes('사용 중인')) return res.status(409).json({ success: false, message: error.message });
        if (error.message.includes('수정할 정보가 없습니다')) return res.status(400).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' });
        }
        await userService.changeUserPassword(req.user.user_id, currentPassword, newPassword);
        res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
    } catch (error) {
        console.error('Change Password Controller Error:', error);
        if (error.message.includes('현재 비밀번호가')) return res.status(401).json({ success: false, message: error.message });
        if (error.message.includes('사용자를 찾을')) return res.status(404).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword
};