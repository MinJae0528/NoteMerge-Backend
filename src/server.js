// src/server.js

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { uploadDir } = require('./middleware/upload'); // uploadDir 임포트

// 라우트 임포트
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');
const folderRoutes = require('./routes/folders');
const keywordRoutes = require('./routes/keywords');
const noteRoutes = require('./routes/notes');
const quizRoutes = require('./routes/quizzes');
const searchRoutes = require('./routes/search');
const tagRoutes = require('./routes/tags');
const noteLinkRoutes = require('./routes/noteLinks');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true
}));

// ▼▼▼ Body parsing 미들웨어를 이 위치로 옮겼습니다 ▼▼▼
// (가장 중요한 수정사항입니다)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 보안 미들웨어
app.use(helmet());

// 압축 미들웨어
app.use(compression());

// 로깅 미들웨어
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
});
app.use('/api/', limiter);

// 정적 파일 서빙: upload.js에서 정의한 uploadDir 사용
app.use('/uploads', express.static(uploadDir));

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'NoteMerge Backend API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/keywords', keywordRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/links', noteLinkRoutes);

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 엔드포인트를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: '토큰이 만료되었습니다.' });
  }
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? '서버 내부 오류가 발생했습니다.' : error.message
  });
});

const startServer = async () => {
  try {
    await testConnection();
    app.listen(PORT, () => {
      console.log(`🚀 NoteMerge Backend API 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📚 환경: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
      console.log(`📁 Files served from: ${uploadDir}`); // 업로드 디렉토리 로그 추가
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;