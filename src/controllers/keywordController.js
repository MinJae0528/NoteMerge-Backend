const { pool } = require('../config/database');

// 키워드 생성
const createKeyword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { note_id, word } = req.body;

    if (!note_id || !word) {
      return res.status(400).json({
        success: false,
        message: 'note_id와 word는 필수 항목입니다.'
      });
    }

    // 노트 소유권 확인
    const [notes] = await pool.execute(
      'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
      [note_id, userId]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '노트를 찾을 수 없습니다.'
      });
    }

    // 키워드가 이미 존재하는지 확인
    let [existingKeywords] = await pool.execute(
      'SELECT keyword_id FROM keywords WHERE name = ?',
      [word.trim()]
    );

    let keywordId;
    if (existingKeywords.length === 0) {
      const [keywordResult] = await pool.execute(
        'INSERT INTO keywords (name) VALUES (?)',
        [word.trim()]
      );
      keywordId = keywordResult.insertId;
    } else {
      keywordId = existingKeywords[0].keyword_id;
    }

    // 이미 연결되어 있는지 확인
    const [existingLink] = await pool.execute(
      'SELECT * FROM note_keywords WHERE keyword_id = ? AND note_id = ?',
      [keywordId, note_id]
    );

    if (existingLink.length > 0) {
      return res.status(409).json({
        success: false,
        message: '이미 연결된 키워드입니다.'
      });
    }

    // 키워드-노트 연결 생성
    await pool.execute(
      'INSERT INTO note_keywords (keyword_id, note_id) VALUES (?, ?)',
      [keywordId, note_id]
    );

    res.status(201).json({
      success: true,
      data: {
        keyword_id: keywordId,
        word: word.trim()
      }
    });

  } catch (error) {
    console.error('Create keyword error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 생성에 실패했습니다.'
    });
  }
};

// 특정 노트의 키워드 목록 조회
const getKeywords = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { note_id } = req.query;

    console.log('=== 키워드 조회 요청 ===');
    console.log('사용자 ID:', userId);
    console.log('노트 ID:', note_id);

    if (!note_id) {
      return res.status(400).json({
        success: false,
        message: 'note_id가 필요합니다.'
      });
    }

    // 노트 소유권 확인
    const [notes] = await pool.execute(
      'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
      [note_id, userId]
    );

    console.log('노트 소유권 확인 결과:', notes.length > 0 ? '성공' : '실패');

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '노트를 찾을 수 없습니다.'
      });
    }

    // 해당 노트의 키워드들 조회
    const [keywords] = await pool.execute(
      `SELECT k.keyword_id, k.name as word
       FROM keywords k
       INNER JOIN note_keywords nk ON k.keyword_id = nk.keyword_id
       WHERE nk.note_id = ?
       ORDER BY k.name ASC`,
      [note_id]
    );

    console.log('조회된 키워드 수:', keywords.length);
    console.log('키워드 목록:', keywords);

    res.json({
      success: true,
      data: keywords
    });

  } catch (error) {
    console.error('Get keywords error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 목록을 가져오는데 실패했습니다.'
    });
  }
};

// 키워드 삭제
const deleteKeyword = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { keywordId } = req.params;
    const { note_id } = req.query;

    if (!note_id) {
      return res.status(400).json({
        success: false,
        message: 'note_id가 필요합니다.'
      });
    }

    // 노트 소유권 확인
    const [notes] = await pool.execute(
      'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
      [note_id, userId]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '노트를 찾을 수 없습니다.'
      });
    }

    // 키워드-노트 연결 삭제
    const [result] = await pool.execute(
      'DELETE FROM note_keywords WHERE keyword_id = ? AND note_id = ?',
      [keywordId, note_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '키워드를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error('Delete keyword error:', error);
    res.status(500).json({
      success: false,
      message: '키워드 삭제에 실패했습니다.'
    });
  }
};

module.exports = {
  createKeyword,
  getKeywords,
  deleteKeyword
};