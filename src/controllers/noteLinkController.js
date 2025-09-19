// src/controllers/noteLinkController.js

const { pool } = require('../config/database');
const noteService = require('../services/noteService'); // 노트 존재 여부 확인을 위해 계속 필요
const noteLinkService = require('../services/noteLinkService'); // ✨ noteLinkService 임포트

const noteLinkController = {
  // 노트 링크 생성
  createNoteLink: async (req, res) => {
    let connection;
    try {
      const userId = req.user.user_id;
      const { source_note_id, target_note_id, description } = req.body;

      if (source_note_id === target_note_id) {
        return res.status(400).json({ success: false, message: '자기 자신에게 링크할 수 없습니다.' });
      }

      // 1. 두 노트 모두 사용자 소유이고 존재하는지 확인
      // noteService를 사용하여 노트의 존재 여부 및 사용자 소유 여부 확인
      const notesValid = await noteService.checkNoteExists(source_note_id, userId) &&
                         await noteService.checkNoteExists(target_note_id, userId);

      if (!notesValid) {
        return res.status(404).json({ success: false, message: '원본 또는 대상 노트를 찾을 수 없습니다.' });
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();

      // 2. 중복 링크 확인
      const linkExists = await noteLinkService.checkLinkExists(source_note_id, target_note_id);
      if (linkExists) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: '이미 존재하는 노트 링크입니다.' });
      }

      // 3. 링크 생성
      const linkId = await noteLinkService.createLink(connection, source_note_id, target_note_id, description);

      await connection.commit();
      res.status(201).json({ success: true, message: '노트 링크가 생성되었습니다.', data: { link_id: linkId } });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Create note link error:', error);
      res.status(500).json({ success: false, message: '노트 링크 생성에 실패했습니다.' });
    } finally {
      if (connection) connection.release();
    }
  },

  // 특정 노트의 연결된 링크 조회
  getNoteLinks: async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { noteId } = req.params;

      // noteId가 사용자 소유인지 확인 (보안상 권장)
      const noteExists = await noteService.checkNoteExists(noteId, userId);
      if (!noteExists) {
          return res.status(404).json({ success: false, message: '노트를 찾을 수 없습니다.' });
      }

      const links = await noteLinkService.getLinksByNoteId(noteId, userId);

      res.json({ success: true, data: { links } });
    } catch (error) {
      console.error('Get note links error:', error);
      res.status(500).json({ success: false, message: '노트 링크를 가져오는데 실패했습니다.' });
    }
  },

  // 노트 링크 삭제
  deleteNoteLink: async (req, res) => {
    let connection;
    try {
      const userId = req.user.user_id;
      const { linkId } = req.params;

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const deleted = await noteLinkService.deleteLink(connection, linkId, userId);

      if (!deleted) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: '링크를 찾을 수 없거나 삭제 권한이 없습니다.' });
      }

      await connection.commit();
      res.json({ success: true, message: '노트 링크가 삭제되었습니다.' });

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Delete note link error:', error);
      res.status(500).json({ success: false, message: '노트 링크 삭제에 실패했습니다.' });
    } finally {
      if (connection) connection.release();
    }
  }
};

module.exports = noteLinkController;