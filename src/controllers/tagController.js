const { pool } = require('../config/database');

// 모든 태그 조회
const getTags = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { search, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT 
        t.tag_id,
        t.name,
        COUNT(ntl.note_id) as note_count,
        t.created_at
      FROM tags t
      LEFT JOIN note_tag_link ntl ON t.tag_id = ntl.tag_id
      LEFT JOIN notes n ON ntl.note_id = n.note_id AND n.user_id = ?
      WHERE 1=1
    `;
    
    const queryParams = [userId];

    if (search) {
      query += ' AND t.name LIKE ?';
      queryParams.push(`%${search}%`);
    }

    query += ' GROUP BY t.tag_id ORDER BY note_count DESC, t.name ASC';

    // 페이지네이션
    const offset = (page - 1) * limit;
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), offset);

    const [tags] = await pool.execute(query, queryParams);

    // 총 개수 조회
    let countQuery = 'SELECT COUNT(DISTINCT t.tag_id) as total FROM tags t';
    const countParams = [];

    if (search) {
      countQuery += ' WHERE t.name LIKE ?';
      countParams.push(`%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        tags,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      success: false,
      message: '태그 목록을 가져오는데 실패했습니다.'
    });
  }
};

// 태그 상세 조회 (해당 태그가 붙은 노트들)
const getTag = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { tagId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // 태그 정보 조회
    const [tags] = await pool.execute(
      'SELECT tag_id, name, created_at FROM tags WHERE tag_id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: '태그를 찾을 수 없습니다.'
      });
    }

    // 해당 태그가 붙은 노트들 조회
    const offset = (page - 1) * limit;
    const [notes] = await pool.execute(
      `SELECT 
        n.note_id,
        n.title,
        n.content,
        n.summary,
        n.file_type,
        n.file_url,
        n.created_at,
        f.name as folder_name
      FROM notes n
      LEFT JOIN folders f ON n.folder_id = f.folder_id
      INNER JOIN note_tag_link ntl ON n.note_id = ntl.note_id
      WHERE ntl.tag_id = ? AND n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?`,
      [tagId, userId, parseInt(limit), offset]
    );

    // 총 노트 개수 조회
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM notes n INNER JOIN note_tag_link ntl ON n.note_id = ntl.note_id WHERE ntl.tag_id = ? AND n.user_id = ?',
      [tagId, userId]
    );
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        tag: tags[0],
        notes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get tag error:', error);
    res.status(500).json({
      success: false,
      message: '태그 정보를 가져오는데 실패했습니다.'
    });
  }
};

// 태그 생성
const createTag = async (req, res) => {
  try {
    const { name } = req.body;

    // 태그명 중복 확인
    const [existingTags] = await pool.execute(
      'SELECT tag_id FROM tags WHERE name = ?',
      [name]
    );

    if (existingTags.length > 0) {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 태그입니다.'
      });
    }

    const [result] = await pool.execute(
      'INSERT INTO tags (name) VALUES (?)',
      [name]
    );

    res.status(201).json({
      success: true,
      message: '태그가 생성되었습니다.',
      data: {
        tag: {
          tag_id: result.insertId,
          name,
          created_at: new Date()
        }
      }
    });

  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({
      success: false,
      message: '태그 생성에 실패했습니다.'
    });
  }
};

// 태그 수정
const updateTag = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { name } = req.body;

    // 태그 존재 확인
    const [tags] = await pool.execute(
      'SELECT tag_id FROM tags WHERE tag_id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: '태그를 찾을 수 없습니다.'
      });
    }

    // 태그명 중복 확인 (자신 제외)
    const [existingTags] = await pool.execute(
      'SELECT tag_id FROM tags WHERE name = ? AND tag_id != ?',
      [name, tagId]
    );

    if (existingTags.length > 0) {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 태그명입니다.'
      });
    }

    await pool.execute(
      'UPDATE tags SET name = ? WHERE tag_id = ?',
      [name, tagId]
    );

    res.json({
      success: true,
      message: '태그가 수정되었습니다.'
    });

  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({
      success: false,
      message: '태그 수정에 실패했습니다.'
    });
  }
};

// 태그 삭제
const deleteTag = async (req, res) => {
  try {
    const { tagId } = req.params;

    // 태그 존재 확인
    const [tags] = await pool.execute(
      'SELECT tag_id FROM tags WHERE tag_id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: '태그를 찾을 수 없습니다.'
      });
    }

    // 태그 삭제 (CASCADE로 연결된 데이터도 함께 삭제됨)
    await pool.execute('DELETE FROM tags WHERE tag_id = ?', [tagId]);

    res.json({
      success: true,
      message: '태그가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({
      success: false,
      message: '태그 삭제에 실패했습니다.'
    });
  }
};

// 노트에 태그 추가
const addTagToNote = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { noteId } = req.params;
    const { tag_id } = req.body;

    // 노트 소유권 확인
    const [notes] = await pool.execute(
      'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
      [noteId, userId]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '노트를 찾을 수 없습니다.'
      });
    }

    // 태그 존재 확인
    const [tags] = await pool.execute(
      'SELECT tag_id FROM tags WHERE tag_id = ?',
      [tag_id]
    );

    if (tags.length === 0) {
      return res.status(404).json({
        success: false,
        message: '태그를 찾을 수 없습니다.'
      });
    }

    // 이미 연결되어 있는지 확인
    const [existingLinks] = await pool.execute(
      'SELECT note_id FROM note_tag_link WHERE note_id = ? AND tag_id = ?',
      [noteId, tag_id]
    );

    if (existingLinks.length > 0) {
      return res.status(409).json({
        success: false,
        message: '이미 해당 태그가 추가되어 있습니다.'
      });
    }

    // 노트-태그 연결 생성
    await pool.execute(
      'INSERT INTO note_tag_link (note_id, tag_id) VALUES (?, ?)',
      [noteId, tag_id]
    );

    res.json({
      success: true,
      message: '태그가 추가되었습니다.'
    });

  } catch (error) {
    console.error('Add tag to note error:', error);
    res.status(500).json({
      success: false,
      message: '태그 추가에 실패했습니다.'
    });
  }
};

// 노트에서 태그 제거
const removeTagFromNote = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { noteId, tagId } = req.params;

    // 노트 소유권 확인
    const [notes] = await pool.execute(
      'SELECT note_id FROM notes WHERE note_id = ? AND user_id = ?',
      [noteId, userId]
    );

    if (notes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '노트를 찾을 수 없습니다.'
      });
    }

    // 연결 삭제
    const [result] = await pool.execute(
      'DELETE FROM note_tag_link WHERE note_id = ? AND tag_id = ?',
      [noteId, tagId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '해당 태그가 노트에 연결되어 있지 않습니다.'
      });
    }

    res.json({
      success: true,
      message: '태그가 제거되었습니다.'
    });

  } catch (error) {
    console.error('Remove tag from note error:', error);
    res.status(500).json({
      success: false,
      message: '태그 제거에 실패했습니다.'
    });
  }
};

// 인기 태그 조회
const getPopularTags = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 20 } = req.query;

    const [tags] = await pool.execute(
      `SELECT 
        t.tag_id,
        t.name,
        COUNT(ntl.note_id) as note_count
      FROM tags t
      INNER JOIN note_tag_link ntl ON t.tag_id = ntl.tag_id
      INNER JOIN notes n ON ntl.note_id = n.note_id
      WHERE n.user_id = ?
      GROUP BY t.tag_id
      ORDER BY note_count DESC, t.name ASC
      LIMIT ?`,
      [userId, parseInt(limit)]
    );

    res.json({
      success: true,
      data: {
        tags
      }
    });

  } catch (error) {
    console.error('Get popular tags error:', error);
    res.status(500).json({
      success: false,
      message: '인기 태그를 가져오는데 실패했습니다.'
    });
  }
};

module.exports = {
  getTags,
  getTag,
  createTag,
  updateTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
  getPopularTags
};
