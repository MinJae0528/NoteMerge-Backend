const { pool } = require('../config/database');

/**
 * [AI 자동 링크] 특정 노트와 유사한 다른 노트들을 찾아 링크를 생성합니다.
 * @param {number} sourceNoteId 기준 노트 ID
 * @param {number[]} embedding 기준 노트의 임베딩 벡터
 * @param {number} userId 사용자 ID
 */
const findAndCreateAutoLinks = async (sourceNoteId, embedding, userId) => {
    if (!embedding || embedding.length === 0) {
        console.log(`[Backlink] Note ID ${sourceNoteId}: 임베딩 값이 없어 자동 링크 생성을 건너뜁니다.`);
        return;
    }
    try {
        const [allNotes] = await pool.execute(
            'SELECT note_id, embedding FROM Notes WHERE user_id = ? AND note_id != ? AND embedding IS NOT NULL',
            [userId, sourceNoteId]
        );

        const calculateCosineSimilarity = (vecA, vecB) => {
            let dotProduct = 0, normA = 0, normB = 0;
            for (let i = 0; i < vecA.length; i++) {
                dotProduct += vecA[i] * vecA[i];
                normB += vecB[i] * vecB[i];
                dotProduct += vecA[i] * vecB[i];
            }
            if (normA === 0 || normB === 0) return 0;
            return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        };

        const similarNotes = [];
        const SIMILARITY_THRESHOLD = 0.8; // 유사도 80% 이상일 때 연결

        for (const note of allNotes) {
            const targetEmbedding = JSON.parse(note.embedding);
            if(targetEmbedding && targetEmbedding.length === embedding.length) {
                const similarity = calculateCosineSimilarity(embedding, targetEmbedding);
                if (similarity >= SIMILARITY_THRESHOLD) {
                    similarNotes.push(note.note_id);
                }
            }
        }

        if (similarNotes.length > 0) {
            const linkValues = [];
            similarNotes.forEach(targetId => {
                linkValues.push([sourceNoteId, targetId, 'auto']); // 양방향 자동 링크 생성
                linkValues.push([targetId, sourceNoteId, 'auto']);
            });
            await pool.query('INSERT IGNORE INTO Note_Links (source_note_id, target_note_id, link_type) VALUES ?', [linkValues]);
            console.log(`[Backlink] Note ID ${sourceNoteId}: ${similarNotes.length}개의 자동 링크를 생성했습니다.`);
        }
    } catch (error) {
        console.error('자동 백링크 생성 중 오류 발생:', error);
    }
};

/**
 * [수동 링크] 사용자가 직접 노트 링크를 생성합니다.
 * @param {number} userId 사용자 ID
 * @param {number} sourceNoteId 원본 노트 ID
 * @param {number} targetNoteId 대상 노트 ID
 * @returns {number} 생성된 링크의 ID
 */
const createManualLink = async (userId, sourceNoteId, targetNoteId) => {
    const [notes] = await pool.execute(
        'SELECT COUNT(*) as count FROM Notes WHERE note_id IN (?, ?) AND user_id = ?',
        [sourceNoteId, targetNoteId, userId]
    );
    if (notes[0].count !== 2) throw new Error('원본 또는 대상 노트를 찾을 수 없습니다.');
    
    const [existing] = await pool.execute('SELECT link_id FROM Note_Links WHERE source_note_id = ? AND target_note_id = ?', [sourceNoteId, targetNoteId]);
    if (existing.length > 0) throw new Error('이미 존재하는 링크입니다.');

    const [result] = await pool.execute(
        'INSERT INTO Note_Links (source_note_id, target_note_id, link_type) VALUES (?, ?, ?)',
        [sourceNoteId, targetNoteId, 'manual']
    );
    return result.insertId;
};

/**
 * 특정 노트에 연결된 모든 링크(자동+수동) 목록을 조회합니다.
 * @param {number} userId 사용자 ID
 * @param {number} noteId 조회할 노트의 ID
 * @returns {Promise<Array>} 연결된 노트 목록
 */
const getLinksByNoteId = async (userId, noteId) => {
    const sql = `
        SELECT nl.link_id, n.note_id, n.title, nl.link_type 
        FROM Note_Links nl
        INNER JOIN Notes n ON nl.target_note_id = n.note_id
        WHERE nl.source_note_id = ? AND n.user_id = ?
    `;
    const [links] = await pool.execute(sql, [noteId, userId]);
    return links;
};

/**
 * [수동 링크] 사용자가 직접 생성한 링크를 삭제합니다.
 * @param {number} userId 사용자 ID
 * @param {number} linkId 삭제할 링크의 ID
 * @returns {boolean} 삭제 성공 여부
 */
const deleteManualLink = async (userId, linkId) => {
    const sql = `
        DELETE nl FROM Note_Links nl
        INNER JOIN Notes n ON nl.source_note_id = n.note_id
        WHERE nl.link_id = ? AND n.user_id = ? AND nl.link_type = 'manual'
    `;
    const [result] = await pool.execute(sql, [linkId, userId]);
    return result.affectedRows > 0;
};

module.exports = { 
    findAndCreateAutoLinks,
    createManualLink,
    getLinksByNoteId,
    deleteManualLink
};

