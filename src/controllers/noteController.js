// src/controllers/noteController.js
const noteService = require('../services/noteService');
const fileService = require('../services/fileService');
const aiService = require('../services/aiService');
const { deleteFile, getFileUrl } = require('../middleware/upload');
const path = require('path');

const OCR_SUPPORTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf'];

// 노트 목록 조회
const getNotes = async (req, res) => {
    try {
        const { notes, total } = await noteService.getNotesFromDB(req.user.user_id, req.query);
        const { page = 1, limit = 20 } = req.query;
        res.json({
            success: true,
            data: {
                notes: notes.map(note => ({ ...note, tags: note.tags ? note.tags.split(',') : [] })),
                pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
            }
        });
    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ success: false, message: '노트 목록을 가져오는데 실패했습니다.' });
    }
};

// 노트 상세 조회
const getNote = async (req, res) => {
    try {
        const note = await noteService.getNoteById(req.params.noteId, req.user.user_id);
        if (!note) {
            return res.status(404).json({ success: false, message: '노트를 찾을 수 없습니다.' });
        }
        const tags = note.tags ? note.tags.split(',').map(tag => {
            const [id, name] = tag.split(':');
            return { tag_id: parseInt(id), name };
        }) : [];
        res.json({
            success: true,
            data: {
                note: {
                    ...note,
                    highlights: note.highlights ? JSON.parse(note.highlights) : null,
                    embedding: note.embedding ? JSON.parse(note.embedding) : null,
                    tags,
                }
            }
        });
    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({ success: false, message: '노트 정보를 가져오는데 실패했습니다.' });
    }
};

// 노트 생성
const createNote = async (req, res) => {
    let fileId = null;
    try {
        const { title, content, folder_id, tags } = req.body;
        let finalContent = content || '';

        if (req.file) {
            const fileData = { 
                userId: req.user.user_id, 
                fileName: req.file.originalname, 
                fileUrl: getFileUrl(req, req.file.path),
                filePath: req.file.path,
                fileSize: req.file.size, 
                fileType: path.extname(req.file.originalname).substring(1) 
            };
            fileId = await fileService.createFile(fileData);
            const fileExtension = fileData.fileType.toLowerCase();
            if (OCR_SUPPORTED_EXTENSIONS.includes(fileExtension)) {
                const ocrResult = await ocrService.extractText(req.file.path, fileExtension);
                if (ocrResult.success) finalContent += `\n\n[OCR 추출 텍스트]\n${ocrResult.text}`;
            }
        }
        
        const textForAI = `${title || ''} ${finalContent}`.trim();
        let aiData = { summary: null, embedding: null };
        let keywordsData = [];

        if (textForAI) {
            const [embeddingResult, summaryResult, keywordsResult] = await Promise.all([
                aiService.getEmbedding(textForAI),
                aiService.generateSummary(textForAI),
                aiService.extractKeywords(textForAI)
            ]);
            if (embeddingResult) aiData.embedding = JSON.stringify(embeddingResult);
            if (summaryResult && summaryResult.success) aiData.summary = summaryResult.summary;
            if (keywordsResult && keywordsResult.success) keywordsData = keywordsResult.keywords;
        }

        const noteData = { userId: req.user.user_id, folder_id: folder_id || null, fileId, title, content: finalContent, tags };
        const newNote = await noteService.createNoteInDB(noteData, aiData, keywordsData);
        res.status(201).json({ success: true, message: '노트가 생성되었습니다.', data: newNote });
    } catch (error) {
        console.error('Create note error:', error);
        if (req.file) deleteFile(req.file.path);
        res.status(500).json({ success: false, message: '노트 생성에 실패했습니다.' });
    }
};

// 노트 수정
const updateNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const userId = req.user.user_id;
        const { title, content, folder_id, tags, delete_file } = req.body;

        const existingNote = await noteService.findNoteForUpdate(noteId, userId);
        if (!existingNote) {
            if (req.file) deleteFile(req.file.path);
            return res.status(404).json({ success: false, message: '노트를 찾을 수 없습니다.' });
        }
        
        let fileId = existingNote.file_id;
        let finalContent = content ?? existingNote.content;
        const isFileChanged = !!req.file || (delete_file === 'true' && existingNote.file_id);
        
        if (req.file) {
            if (existingNote.file_id) {
                const oldFile = await fileService.getFileById(existingNote.file_id);
                if (oldFile) {
                    await fileService.deleteFileRecord(existingNote.file_id);
                    deleteFile(oldFile.file_path);
                }
            }
            const fileData = { userId, fileName: req.file.originalname, fileUrl: getFileUrl(req, req.file.path), filePath: req.file.path, fileSize: req.file.size, fileType: path.extname(req.file.originalname).substring(1) };
            fileId = await fileService.createFile(fileData);
        } else if (delete_file === 'true' && existingNote.file_id) {
            const oldFile = await fileService.getFileById(existingNote.file_id);
            if (oldFile) {
                await fileService.deleteFileRecord(existingNote.file_id);
                deleteFile(oldFile.file_path);
            }
            fileId = null;
        }

        const isContentChanged = title !== existingNote.title || content !== existingNote.content || isFileChanged;
        let aiData = { 
            summary: existingNote.summary, 
            embedding: existingNote.embedding 
        };
        let keywordsData = [];

        // ✨ AI 호출 기능 활성화
        if (isContentChanged) {
            const textForAI = `${title || ''} ${finalContent}`.trim();
            if (textForAI) {
                const [embeddingResult, summaryResult, keywordsResult] = await Promise.all([
                    aiService.getEmbedding(textForAI),
                    aiService.generateSummary(textForAI),
                    aiService.extractKeywords(textForAI)
                ]);
                if (embeddingResult) aiData.embedding = JSON.stringify(embeddingResult);
                if (summaryResult && summaryResult.success) aiData.summary = summaryResult.summary;
                if (keywordsResult && keywordsResult.success) keywordsData = keywordsResult.keywords;
            }
        }
        
        const noteData = {
            title: title,
            content: finalContent,
            folder_id: folder_id || null,
            fileId: fileId,
            tags: tags || null
        };
        
        aiData.summary = aiData.summary === undefined ? null : aiData.summary;
        aiData.embedding = aiData.embedding === undefined ? null : aiData.embedding;

        await noteService.updateNoteInDB(noteId, userId, noteData, aiData, keywordsData);

        res.json({ success: true, message: '노트가 성공적으로 수정되었습니다.' });
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        console.error("Update note error:", error);
        res.status(500).json({ success: false, message: '노트 수정에 실패했습니다.' });
    }
};

// 노트 삭제
const deleteNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        const deletedFile = await noteService.deleteNoteFromDB(noteId, req.user.user_id);
        
        if (deletedFile && deletedFile.file_path) {
            deleteFile(deletedFile.file_path);
        }
        res.json({ success: true, message: '노트가 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error("Delete note error:", error);
        res.status(500).json({ success: false, message: '노트 삭제에 실패했습니다.' });
    }
};

module.exports = {
    getNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote
};