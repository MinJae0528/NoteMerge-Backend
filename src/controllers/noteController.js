const noteService = require('../services/noteService');
const fileService = require('../services/fileService');
const aiService = require('../services/aiService');
const folderService = require('../services/folderService');
const { deleteFile, getFileUrl } = require('../middleware/upload');
const path = require('path');

const OCR_SUPPORTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf'];

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

const createNote = async (req, res) => {
    console.log('=== 노트 생성 요청 시작 ===');
    console.log('요청 사용자:', req.user?.user_id);
    console.log('요청 body:', req.body);
    console.log('업로드된 파일들:', req.files?.length || 0, '개');
    
    const uploadedFiles = [];
    try {
        const { title, content, folder_id } = req.body;
        let finalContent = content || '';
        let tagsData = req.body.tags || [];

        // 다중 파일 처리
        const files = req.files || (req.file ? [req.file] : []);
        console.log('업로드된 파일 수:', files.length);
        
        let fileIds = [];

        // 파일들을 DB에 저장
        for (const file of files) {
            const fileData = { 
                userId: req.user.user_id, 
                fileName: file.originalname, 
                fileUrl: getFileUrl(req, file.path),
                filePath: file.path,
                fileSize: file.size, 
                fileType: path.extname(file.originalname).substring(1) 
            };
            const fileId = await fileService.createFile(fileData);
            fileIds.push(fileId);
            uploadedFiles.push(file.path); // 에러 시 삭제용
        }

        // 📝 텍스트와 파일을 동시에 AI 분석
        const userText = `${title || ''} ${finalContent}`.trim();
        let aiData = { summary: null, embedding: null };
        let keywordsData = [];
        let extractedTextFromFiles = '';

        console.log('통합 AI 분석 시작 - 텍스트 길이:', userText.length, '파일 수:', files.length);
        
        try {
            // 텍스트와 파일을 한 번에 분석
            const [embeddingResult, integratedAnalysisResult] = await Promise.all([
                aiService.getEmbedding(userText),
                aiService.analyzeTextAndFiles(userText, files)
            ]);

            if (embeddingResult) {
                aiData.embedding = JSON.stringify(embeddingResult);
            }

            if (integratedAnalysisResult && integratedAnalysisResult.success) {
                // 파일에서 추출된 텍스트가 있으면 최종 콘텐츠에 추가
                if (integratedAnalysisResult.extractedText) {
                    extractedTextFromFiles = integratedAnalysisResult.extractedText;
                    finalContent += `\n\n[첨부 파일에서 추출된 내용]\n${extractedTextFromFiles}`;
                }
                
                // AI 분석 결과 적용
                aiData.summary = integratedAnalysisResult.summary;
                keywordsData = integratedAnalysisResult.keywords || [];
                
                // AI가 생성한 태그와 사용자가 입력한 태그를 합침 (중복 제거)
                if (integratedAnalysisResult.tags) {
                    tagsData = [...new Set([...tagsData, ...integratedAnalysisResult.tags])];
                }
                
                console.log('통합 AI 분석 완료 - 추출된 텍스트 길이:', extractedTextFromFiles.length, '키워드 수:', keywordsData.length, '태그 수:', tagsData.length);
            } else {
                console.log('통합 AI 분석 실패:', integratedAnalysisResult?.error || '원인 불명');
            }
        } catch (analysisError) {
            console.error('AI 분석 중 에러 발생:');
            console.error('에러 타입:', analysisError.constructor.name);
            console.error('에러 메시지:', analysisError.message);
            console.error('에러 스택:', analysisError.stack);
            // AI 분석 실패해도 노트 생성은 계속 진행
        }

        // fileId를 첫 번째 파일의 ID로 설정 (기존 스키마 호환성)
        const primaryFileId = fileIds.length > 0 ? fileIds[0] : null;
        const noteData = { userId: req.user.user_id, folder_id, fileId: primaryFileId, title, content: finalContent, tags: tagsData };
        
        console.log('노트 생성 직전 키워드 확인:', {
            keywordsData: keywordsData,
            keywordsLength: keywordsData ? keywordsData.length : 0,
            aiDataSummary: aiData.summary ? aiData.summary.substring(0, 50) + '...' : 'null'
        });
        
        const newNote = await noteService.createNoteInDB(noteData, aiData, keywordsData);
        
        if (keywordsData.length > 0) {
            folderService.autoOrganizeNoteByKeywords(newNote.note_id, keywordsData, req.user.user_id);
        }

        res.status(201).json({ 
            success: true, 
            message: '노트가 생성되었습니다.', 
            data: { 
                ...newNote, 
                uploaded_files_count: files.length,
                extracted_text_length: extractedTextFromFiles.length 
            } 
        });
    } catch (error) {
        console.error('Create note error:', error);
        // 에러 발생 시 업로드된 파일들 삭제
        uploadedFiles.forEach(filePath => deleteFile(filePath));
        res.status(500).json({ success: false, message: '노트 생성에 실패했습니다.' });
    }
};

const updateNote = async (req, res) => {
    const uploadedFiles = [];
    try {
        const { noteId } = req.params;
        const userId = req.user.user_id;
        const { title, content, folder_id, delete_file } = req.body;
        let tagsData = req.body.tags || [];

        const existingNote = await noteService.findNoteForUpdate(noteId, userId);
        if (!existingNote) {
            const files = req.files || (req.file ? [req.file] : []);
            files.forEach(file => deleteFile(file.path));
            return res.status(404).json({ success: false, message: '노트를 찾을 수 없습니다.' });
        }
        
        // 다중 파일 처리
        const files = req.files || (req.file ? [req.file] : []);
        let fileIds = [];
        let extractedTextFromFiles = '';

        // 새로 업로드된 파일들을 DB에 저장
        for (const file of files) {
            const fileData = { 
                userId: req.user.user_id, 
                fileName: file.originalname, 
                fileUrl: getFileUrl(req, file.path),
                filePath: file.path,
                fileSize: file.size, 
                fileType: path.extname(file.originalname).substring(1) 
            };
            const fileId = await fileService.createFile(fileData);
            fileIds.push(fileId);
            uploadedFiles.push(file.path); // 에러 시 삭제용
        }
        
        let finalContent = content ?? existingNote.content;
        const isFileChanged = files.length > 0 || (delete_file === 'true' && existingNote.file_id);
        const isContentChanged = title !== existingNote.title || content !== existingNote.content || isFileChanged;
        
        let aiData = { 
            summary: existingNote.summary, 
            embedding: existingNote.embedding 
        };
        let keywordsData = [];

        if (isContentChanged) {
            const userText = `${title || ''} ${finalContent}`.trim();
            
            console.log('노트 수정 - 통합 AI 분석 시작, 텍스트 길이:', userText.length, '파일 수:', files.length);
            
            // 텍스트와 파일을 한 번에 분석
            const [embeddingResult, integratedAnalysisResult] = await Promise.all([
                aiService.getEmbedding(userText),
                aiService.analyzeTextAndFiles(userText, files)
            ]);

            if (embeddingResult) {
                aiData.embedding = JSON.stringify(embeddingResult);
            }

            if (integratedAnalysisResult && integratedAnalysisResult.success) {
                // 파일에서 추출된 텍스트가 있으면 최종 콘텐츠에 추가
                if (integratedAnalysisResult.extractedText) {
                    extractedTextFromFiles = integratedAnalysisResult.extractedText;
                    finalContent += `\n\n[첨부 파일에서 추출된 내용]\n${extractedTextFromFiles}`;
                }
                
                aiData.summary = integratedAnalysisResult.summary;
                keywordsData = integratedAnalysisResult.keywords || [];
                
                if (integratedAnalysisResult.tags) {
                    tagsData = [...new Set([...tagsData, ...integratedAnalysisResult.tags])];
                }
                
                console.log('노트 수정 - 통합 AI 분석 완료');
            }
        }

        // 새 파일이 있으면 첫 번째 파일의 ID를 사용, 없으면 기존 파일 유지
        const primaryFileId = fileIds.length > 0 ? fileIds[0] : existingNote.file_id;
        const noteData = { title, content: finalContent, folder_id, fileId: primaryFileId, tags: tagsData };
        await noteService.updateNoteInDB(noteId, userId, noteData, aiData, keywordsData);

        res.json({ 
            success: true, 
            message: '노트가 성공적으로 수정되었습니다.',
            data: {
                uploaded_files_count: files.length,
                extracted_text_length: extractedTextFromFiles.length
            }
        });
    } catch (error) {
        // 에러 발생 시 업로드된 파일들 삭제
        uploadedFiles.forEach(filePath => deleteFile(filePath));
        console.error("Update note error:", error);
        res.status(500).json({ success: false, message: '노트 수정에 실패했습니다.' });
    }
};


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

