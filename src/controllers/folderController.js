// src/controllers/folderController.js
const folderService = require('../services/folderService');

const createFolder = async (req, res) => {
    try {
        const { name, parent_folder_id } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '폴더 이름을 입력해주세요.' });
        
        const newFolder = await folderService.createFolder(req.user.user_id, name, parent_folder_id);
        res.status(201).json({ success: true, message: '폴더가 생성되었습니다.', data: { folder: newFolder } });
    } catch (error) {
        console.error('Create folder error:', error);
        if (error.message.includes('찾을 수 없')) return res.status(404).json({ success: false, message: error.message });
        if (error.message.includes('이미 존재')) return res.status(409).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: '폴더 생성에 실패했습니다.' });
    }
};

const getFolders = async (req, res) => {
    try {
        const { parent_folder_id } = req.query;
        const folders = await folderService.getFoldersByUserId(req.user.user_id, parent_folder_id);
        res.json({ success: true, data: { folders } });
    } catch (error) {
        console.error('Get folders error:', error);
        res.status(500).json({ success: false, message: '폴더 목록을 가져오는데 실패했습니다.' });
    }
};

const getFolder = async (req, res) => {
    try {
        const folderDetails = await folderService.getFolderDetailsById(req.user.user_id, req.params.folderId);
        if (!folderDetails) return res.status(404).json({ success: false, message: '폴더를 찾을 수 없습니다.' });
        res.json({ success: true, data: { folder: folderDetails } });
    } catch (error) {
        console.error('Get folder error:', error);
        res.status(500).json({ success: false, message: '폴더 정보를 가져오는데 실패했습니다.' });
    }
};

const updateFolder = async (req, res) => {
    try {
        const { name, parent_folder_id } = req.body;
        if (!name) return res.status(400).json({ success: false, message: '새 폴더 이름을 입력해주세요.' });

        await folderService.updateFolder(req.user.user_id, req.params.folderId, name, parent_folder_id);
        res.json({ success: true, message: '폴더가 수정되었습니다.' });
    } catch (error) {
        console.error('Update folder error:', error);
        if (error.message.includes('찾을 수 없')) return res.status(404).json({ success: false, message: error.message });
        if (error.message.includes('자기 자신')) return res.status(400).json({ success: false, message: error.message });
        if (error.message.includes('이미 존재')) return res.status(409).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: '폴더 수정에 실패했습니다.' });
    }
};

const deleteFolder = async (req, res) => {
    try {
        await folderService.deleteFolder(req.user.user_id, req.params.folderId);
        res.json({ success: true, message: '폴더가 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete folder error:', error);
        if (error.message.includes('찾을 수 없')) return res.status(404).json({ success: false, message: error.message });
        if (error.message.includes('삭제할 수 없습니다')) return res.status(400).json({ success: false, message: error.message });
        res.status(500).json({ success: false, message: '폴더 삭제에 실패했습니다.' });
    }
};

const getFolderTree = async (req, res) => {
    try {
        const folderTree = await folderService.getFolderTreeByUserId(req.user.user_id);
        res.json({ success: true, data: { folder_tree: folderTree } });
    } catch (error) {
        console.error('Get folder tree error:', error);
        res.status(500).json({ success: false, message: '폴더 트리를 가져오는데 실패했습니다.' });
    }
};


module.exports = {
    createFolder,
    getFolders,
    getFolder,
    updateFolder,
    deleteFolder,
    getFolderTree
};