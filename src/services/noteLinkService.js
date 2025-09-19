// src/services/noteLinkService.js

const { pool } = require('../config/database');
const noteService = require('./noteService'); // 노트 존재 여부 확인을 위해 noteService 임포트

const noteLinkService = {
  /**
   * 주어진 두 노트 ID가 모두 사용자 소유이고 존재하는지 확인합니다.
   * @param {number} sourceNoteId 원본 노트 ID
   * @param {number} targetNoteId 대상 노트 ID
   * @param {number} userId 사용자 ID
   * @returns {boolean} 두 노트 모두 존재하고 사용자 소유이면 true, 아니면 false
   */
  checkNotesForLinking: async (sourceNoteId, targetNoteId, userId) => {
    const sourceExists = await noteService.checkNoteExists(sourceNoteId, userId);
    const targetExists = await noteService.checkNoteExists(targetNoteId, userId);
    return sourceExists && targetExists;
  },

  /**
   * 두 노트 사이에 이미 링크가 존재하는지 확인합니다.
   * @param {number} sourceNoteId 원본 노트 ID
   * @param {number} targetNoteId 대상 노트 ID
   * @returns {boolean} 링크가 존재하면 true, 아니면 false
   */
  checkLinkExists: async (sourceNoteId, targetNoteId) => {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM Note_Links WHERE source_note_id = ? AND target_note_id = ?',
      [sourceNoteId, targetNoteId]
    );
    return rows[0].count > 0;
  },

  /**
   * 노트 링크를 생성합니다.
   * @param {object} connection DB 커넥션 (트랜잭션용)
   * @param {number} sourceNoteId 원본 노트 ID
   * @param {number} targetNoteId 대상 노트 ID
   * @param {string} description 링크 설명
   * @returns {number} 생성된 링크의 ID
   */
  createLink: async (connection, sourceNoteId, targetNoteId, description) => {
    const [result] = await connection.execute(
      'INSERT INTO Note_Links (source_note_id, target_note_id, description) VALUES (?, ?, ?)',
      [sourceNoteId, targetNoteId, description]
    );
    return result.insertId;
  },

  /**
   * 특정 노트와 관련된 모든 링크를 조회합니다.
   * @param {number} noteId 조회할 노트 ID
   * @param {number} userId 사용자 ID
   * @returns {Array<object>} 링크 목록
   */
  getLinksByNoteId: async (noteId, userId) => {
    const [links] = await pool.execute(
      `SELECT
          nl.link_id,
          nl.source_note_id,
          ns.title AS source_note_title,
          nl.target_note_id,
          nt.title AS target_note_title,
          nl.description,
          nl.created_at
       FROM Note_Links nl
       JOIN Note ns ON nl.source_note_id = ns.note_id
       JOIN Note nt ON nl.target_note_id = nt.note_id
       WHERE (nl.source_note_id = ? AND ns.user_id = ?) OR (nl.target_note_id = ? AND nt.user_id = ?)`,
      [noteId, userId, noteId, userId]
    );
    return links;
  },

  /**
   * 노트 링크를 삭제합니다.
   * @param {object} connection DB 커넥션 (트랜잭션용)
   * @param {number} linkId 삭제할 링크 ID
   * @param {number} userId 사용자 ID (권한 확인용)
   * @returns {boolean} 삭제 성공 여부
   */
  deleteLink: async (connection, linkId, userId) => {
    // 링크의 소유권 확인 (원본 또는 대상 노트가 사용자 소유인지)
    const [linkCheck] = await connection.execute(
      `SELECT nl.link_id
       FROM Note_Links nl
       JOIN Note ns ON nl.source_note_id = ns.note_id
       JOIN Note nt ON nl.target_note_id = nt.note_id
       WHERE nl.link_id = ? AND (ns.user_id = ? OR nt.user_id = ?)`,
      [linkId, userId, userId]
    );

    if (linkCheck.length === 0) {
      return false; // 링크를 찾을 수 없거나 권한 없음
    }

    const [result] = await connection.execute('DELETE FROM Note_Links WHERE link_id = ?', [linkId]);
    return result.affectedRows > 0;
  }
};

module.exports = noteLinkService;