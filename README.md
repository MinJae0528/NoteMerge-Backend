# NoteMerge Backend API

AI 기반의 학습 자료 통합 관리 시스템 NoteMerge의 백엔드 API입니다.

## 🚀 주요 기능

- **OCR & AI 요약**: 이미지/PDF에서 텍스트 추출 및 AI 요약 생성
- **자동 분류**: AI 기반 태그 및 키워드 자동 생성
- **고급 검색**: TF-IDF와 임베딩 기술을 활용한 지능형 검색
- **자동 퀴즈 생성**: AI가 객관식, 단답형, 서술형 퀴즈 자동 생성
- **학습 현황 관리**: 캘린더 기반 학습 기록 및 출석체크
- **폴더 관리**: 계층적 노트 조직화

## 🛠 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **AI/ML**: Google Gemini API, Tesseract.js
- **Authentication**: JWT
- **File Processing**: Multer, Sharp, PDF-parse
- **Search**: Natural.js (TF-IDF), Custom keyword matching

## 📋 사전 요구사항

- Node.js 18.0.0 이상
- MySQL 8.0 이상
- Google Gemini API 키

## 🔧 설치 및 설정

### 1. 저장소 클론
```bash
git clone <repository-url>
cd NoteMerge-Backend
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
```bash
cp env.example .env
```

`.env` 파일을 편집하여 다음 값들을 설정하세요:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=notemerge
DB_USER=root
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# AI API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

### 4. 데이터베이스 설정
```bash
# 데이터베이스 생성 및 스키마 적용
npm run migrate
```

### 5. 서버 시작
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📚 API 문서

### 인증 (Authentication)

#### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "user123",
  "email": "user@example.com",
  "password": "password123"
}
```

#### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

### 노트 관리 (Notes)

#### 노트 목록 조회
```http
GET /api/notes?folder_id=1&page=1&limit=20
Authorization: Bearer <token>
```

#### 노트 생성 (파일 업로드 포함)
```http
POST /api/notes
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "title": "노트 제목",
  "content": "노트 내용",
  "folder_id": 1,
  "file": <file>
}
```

#### 노트 검색
```http
GET /api/notes/search?q=검색어&type=hybrid
Authorization: Bearer <token>
```

### 폴더 관리 (Folders)

#### 폴더 목록 조회
```http
GET /api/folders?parent_folder_id=null
Authorization: Bearer <token>
```

#### 폴더 생성
```http
POST /api/folders
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "새 폴더",
  "parent_folder_id": null
}
```

### 퀴즈 관리 (Quizzes)

#### 퀴즈 생성
```http
POST /api/quizzes
Authorization: Bearer <token>
Content-Type: application/json

{
  "note_id": 1,
  "title": "퀴즈 제목",
  "question_count": 5
}
```

#### 퀴즈 제출
```http
POST /api/quizzes/1/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "answers": {
    "1": "답안1",
    "2": "답안2"
  }
}
```

### 검색 (Search)

#### 통합 검색
```http
GET /api/search?q=검색어&type=hybrid&folder_id=1
Authorization: Bearer <token>
```

#### 검색 제안
```http
GET /api/search/suggestions?q=검색어
Authorization: Bearer <token>
```

### 캘린더 (Calendar)

#### 학습 현황 조회
```http
GET /api/calendar/progress?year=2024&month=1
Authorization: Bearer <token>
```

#### 출석체크
```http
POST /api/calendar/attendance
Authorization: Bearer <token>
```

## 🔍 주요 기능 상세

### OCR 기능
- Tesseract.js를 사용한 이미지 내 텍스트 추출
- Sharp를 통한 이미지 전처리로 정확도 향상
- PDF, 이미지 파일 지원

### AI 요약
- Google Gemini API를 활용한 자동 요약 생성
- 5-6문장 길이의 간결한 요약
- 키워드 자동 추출 및 태그 생성

### 고급 검색
- TF-IDF 기반 의미론적 검색
- 키워드 매칭 검색
- 하이브리드 검색 (TF-IDF + 키워드)
- 검색어 자동완성

### 퀴즈 생성
- AI 기반 자동 문제 생성
- 객관식, 단답형, 서술형 지원
- 자동 채점 및 통계 제공

## 📁 프로젝트 구조

```
src/
├── config/
│   └── database.js          # 데이터베이스 설정
├── controllers/
│   ├── authController.js    # 인증 컨트롤러
│   ├── folderController.js  # 폴더 관리 컨트롤러
│   ├── noteController.js    # 노트 관리 컨트롤러
│   ├── tagController.js     # 태그 관리 컨트롤러
│   ├── keywordController.js # 키워드 관리 컨트롤러
│   ├── quizController.js    # 퀴즈 관리 컨트롤러
│   ├── quizAttemptController.js # 퀴즈 시도 컨트롤러
│   ├── searchController.js  # 검색 컨트롤러
│   └── calendarController.js # 캘린더 컨트롤러
├── middleware/
│   ├── auth.js              # JWT 인증 미들웨어
│   ├── validation.js        # 입력 검증 미들웨어
│   └── upload.js            # 파일 업로드 미들웨어
├── routes/
│   ├── auth.js              # 인증 라우트
│   ├── folders.js           # 폴더 라우트
│   ├── notes.js             # 노트 라우트
│   ├── tags.js              # 태그 라우트
│   ├── keywords.js          # 키워드 라우트
│   ├── quizzes.js           # 퀴즈 라우트
│   ├── search.js            # 검색 라우트
│   └── calendar.js          # 캘린더 라우트
├── services/
│   ├── ocrService.js        # OCR 서비스
│   ├── aiService.js         # AI 서비스
│   └── searchService.js     # 검색 서비스
├── database/
│   ├── schema.sql           # 데이터베이스 스키마
│   └── migrate.js           # 마이그레이션 스크립트
└── server.js                # 메인 서버 파일
```

## 🚀 배포

### Docker를 사용한 배포

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 환경 변수 설정
프로덕션 환경에서는 다음 환경 변수들을 설정해야 합니다:
- `NODE_ENV=production`
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `GEMINI_API_KEY`

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해 주세요.

---

**NoteMerge Backend API v1.0.0** - AI 기반 학습 자료 통합 관리 시스템
