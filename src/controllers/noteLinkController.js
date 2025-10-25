// src/controllers/noteLinkController.js
const noteService = require('../services/noteService');
const noteLinkService = require('../services/noteLinkService');

// 특정 노트에 연결된 링크 목록 조회
const getNoteLinks = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { noteId } = req.params;

        // 1. 링크를 조회하기 전에, 대상 노트가 실제로 존재하는지 먼저 확인 (보안 강화)
        const noteExists = await noteService.checkNoteExists(noteId, userId);
        if (!noteExists) {
            return res.status(404).json({ success: false, message: '노트를 찾을 수 없습니다.' });
        }

        // 2. 노트가 존재하면, 해당 노트의 백링크 목록을 조회
        const links = await noteLinkService.getLinksByNoteId(userId, noteId);
        res.json({ success: true, data: { links } });

    } catch (error) {
        console.error('Get note links error:', error);
        res.status(500).json({ success: false, message: '노트 링크 조회에 실패했습니다.' });
    }
};

// 사용자가 수동으로 노트 링크 생성
const createNoteLink = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { source_note_id, target_note_id } = req.body;

        if (source_note_id === target_note_id) {
            return res.status(400).json({ success: false, message: '자기 자신에게 링크할 수 없습니다.' });
        }

        // 두 노트 모두 사용자 소유인지 확인
        const notesValid = await noteService.checkNoteExists(source_note_id, userId) &&
                           await noteService.checkNoteExists(target_note_id, userId);

        if (!notesValid) {
            return res.status(404).json({ success: false, message: '원본 또는 대상 노트를 찾을 수 없습니다.' });
        }

        const newLink = await noteLinkService.createManualLink(source_note_id, target_note_id);
        res.status(201).json({ success: true, message: '노트 링크가 생성되었습니다.', data: newLink });

    } catch (error) {
        console.error('Create note link error:', error);
        if (error.message.includes('이미 존재')) {
            return res.status(409).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: '노트 링크 생성에 실패했습니다.' });
    }
};

// 사용자가 수동으로 노트 링크 삭제
const deleteNoteLink = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { linkId } = req.params;

        const deleted = await noteLinkService.deleteManualLink(linkId, userId);

        if (!deleted) {
            return res.status(404).json({ success: false, message: '링크를 찾을 수 없거나 삭제 권한이 없습니다.' });
        }

        res.json({ success: true, message: '노트 링크가 삭제되었습니다.' });
    } catch (error) {
        console.error('Delete note link error:', error);
        res.status(500).json({ success: false, message: '노트 링크 삭제에 실패했습니다.' });
    }
};

module.exports = {
    getNoteLinks,
    createNoteLink,
    deleteNoteLink
};

