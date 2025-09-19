// src/middleware/upload.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { URL } = require('url'); // URL 파싱을 위해 추가

// 업로드 디렉토리 생성
// process.cwd()는 현재 작업 디렉토리 (프로젝트 루트)를 반환합니다.
// __dirname은 현재 파일(upload.js)이 있는 디렉토리입니다.
// 따라서 프로젝트 루트의 'uploads' 폴더를 기준으로 경로를 설정하는 것이 좋습니다.
const projectRoot = path.resolve(__dirname, '..', '..'); // src 폴더에서 두 단계 위로 이동
const uploadDir = process.env.UPLOAD_PATH ? path.join(projectRoot, process.env.UPLOAD_PATH) : path.join(projectRoot, 'uploads');
const imageDir = path.join(uploadDir, 'images');
const pdfDir = path.join(uploadDir, 'pdfs');

[uploadDir, imageDir, pdfDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created upload directory: ${dir}`);
  }
});

// 파일 타입별 저장소 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, imageDir);
    } else if (file.mimetype === 'application/pdf') {
      cb(null, pdfDir);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'), false);
    }
  },
  filename: (req, file, cb) => {
    // 고유한 파일명 생성: timestamp_userId_originalName
    // req.user는 authMiddleware를 거쳐야 있으므로, 미들웨어 순서가 중요합니다.
    // 현재 notes.js 라우트에서 authMiddleware가 먼저 실행되므로 req.user는 존재할 것입니다.
    const userId = req.user && req.user.user_id ? req.user.user_id : 'anonymous'; // 안전하게 userId 확인
    const uniqueSuffix = Date.now() + '_' + userId;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${uniqueSuffix}_${name}${ext}`);
  }
});

// 파일 필터링
const fileFilter = (req, file, cb) => {
  // 이미지 파일
  if (file.mimetype.startsWith('image/')) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('지원하는 이미지 형식은 JPEG, PNG, GIF, WebP 입니다.'), false);
    }
  }
  // PDF 파일
  else if (file.mimetype === 'application/pdf') {
    cb(null, true);
  }
  // 기타 파일
  else {
    cb(new Error('이미지 또는 PDF 파일만 업로드 가능합니다.'), false);
  }
};

// Multer 설정
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 1 // 한 번에 하나의 파일만
  }
});

// 단일 파일 업로드 미들웨어 (라우터에서 사용될 실제 함수)
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    // authMiddleware 다음으로 이 미들웨어가 실행되도록 라우터에서 순서를 잘 지켜야 합니다.
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: '파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: '한 번에 하나의 파일만 업로드 가능합니다.'
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message
        });
      } else if (err) {
        // fileFilter에서 발생한 에러 등
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next(); // 파일 업로드 성공 또는 파일 없음 (Multer 에러 아님)
    });
  };
};

/**
 * 서버 물리 경로에 있는 파일을 삭제합니다.
 * noteController에서 fileRecord.file_path (DB에 저장된 실제 경로)를 전달하는 것이 가장 이상적입니다.
 * 현재는 getFileUrl에서 생성된 HTTP URL로부터 물리 경로를 추론하여 삭제하는 로직으로 구현합니다.
 * DB에 file_path 컬럼을 추가하는 것을 강력히 권장합니다.
 * @param {string} fileUrlOrPath 파일의 HTTP URL 또는 서버 물리 경로
 * @returns {boolean} 삭제 성공 여부
 */
const deleteFile = (fileUrlOrPath) => {
  try {
    if (!fileUrlOrPath) return false;

    let actualFilePath = fileUrlOrPath;

    // fileUrlOrPath가 HTTP URL인 경우 물리 경로로 변환 시도
    if (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://')) {
      const url = new URL(fileUrlOrPath);
      // '/uploads/images/filename.jpg'와 같은 경로 부분만 추출
      const relativePathFromUrl = url.pathname; // 예: /uploads/images/filename.jpg

      // projectRoot + relativePathFromUrl (단, uploads 부분은 중복될 수 있으므로 주의)
      // '/uploads'로 시작하는 부분을 제거하고 직접 경로를 구성
      if (relativePathFromUrl.startsWith('/uploads/')) {
        actualFilePath = path.join(projectRoot, relativePathFromUrl);
      } else {
        console.error(`[deleteFile] 알 수 없는 URL 경로 형식: ${fileUrlOrPath}`);
        return false;
      }
    }
    // fileUrlOrPath가 이미 물리 경로일 경우 그대로 사용 (예: req.file.path)

    if (fs.existsSync(actualFilePath)) {
      fs.unlinkSync(actualFilePath);
      console.log(`[deleteFile] 파일 삭제 완료: ${actualFilePath}`);
      return true;
    }
    console.warn(`[deleteFile] 삭제할 파일이 존재하지 않음: ${actualFilePath}`);
    return false;
  } catch (error) {
    console.error('[deleteFile] 파일 삭제 오류:', error);
    return false;
  }
};

/**
 * 서버 물리 경로를 클라이언트가 접근할 수 있는 HTTP URL로 변환합니다.
 * @param {object} req Express Request 객체
 * @param {string} filePath Multer가 반환하는 파일의 서버 물리 경로 (예: /path/to/project/uploads/images/filename.jpg)
 * @returns {string|null} 파일의 HTTP URL
 */
const getFileUrl = (req, filePath) => {
  if (!filePath) return null;

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  // filePath는 서버 내부 경로이므로, 이를 HTTP 경로로 변환해야 합니다.
  // 예를 들어, filePath가 'C:\NoteMerge-Backend\uploads\images\file.jpg' 라면,
  // URL은 'http://localhost:3000/uploads/images/file.jpg'가 되어야 합니다.

  // 1. filePath를 상대 경로로 변환
  // C:\NoteMerge-Backend\uploads 로 시작하는 부분을 찾아 그 이후부터 URL 경로로 사용
  const relativeToUploads = path.relative(uploadDir, filePath);
  // 상대 경로의 역슬래시를 슬래시로 변환 (URL 형식)
  const urlPath = relativeToUploads.replace(/\\/g, '/');

  // 최종 URL 구성
  return `${baseUrl}/uploads/${urlPath}`;
};


module.exports = {
  uploadSingle,
  deleteFile,
  getFileUrl,
  uploadDir,
  imageDir,
  pdfDir,
  // Multer 인스턴스 자체도 필요하다면 내보낼 수 있지만, 현재는 uploadSingle로 감싸 사용
  // upload: upload
};