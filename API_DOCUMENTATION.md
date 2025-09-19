# NoteMerge Backend API 문서

## 개요

NoteMerge Backend API는 AI 기반의 학습 자료 통합 관리 시스템을 위한 RESTful API입니다.

**Base URL**: `http://localhost:3000/api`

## 인증

대부분의 API 엔드포인트는 JWT 토큰을 통한 인증이 필요합니다.

```http
Authorization: Bearer <your_jwt_token>
```

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "message": "성공 메시지",
  "data": {
    // 응답 데이터
  }
}
```

### 에러 응답
```json
{
  "success": false,
  "message": "에러 메시지",
  "errors": ["상세 에러 메시지들"] // 선택적
}
```

## API 엔드포인트

### 1. 인증 (Authentication)

#### POST /auth/register
회원가입

**Request Body:**
```json
{
  "username": "string (3-30자, 영문자+숫자)",
  "email": "string (이메일 형식)",
  "password": "string (최소 6자)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "user": {
      "user_id": 1,
      "username": "user123",
      "email": "user@example.com"
    },
    "token": "jwt_token_string"
  }
}
```

#### POST /auth/login
로그인

**Request Body:**
```json
{
  "username": "string (사용자명 또는 이메일)",
  "password": "string"
}
```

#### GET /auth/profile
프로필 조회 (인증 필요)

#### PUT /auth/profile
프로필 수정 (인증 필요)

#### PUT /auth/password
비밀번호 변경 (인증 필요)

### 2. 폴더 관리 (Folders)

#### GET /folders
폴더 목록 조회

**Query Parameters:**
- `parent_folder_id`: 상위 폴더 ID (선택적)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)

#### GET /folders/tree
폴더 트리 구조 조회

#### GET /folders/:folderId
폴더 상세 조회

#### POST /folders
폴더 생성

**Request Body:**
```json
{
  "name": "string (1-100자)",
  "parent_folder_id": "number (선택적)"
}
```

#### PUT /folders/:folderId
폴더 수정

#### DELETE /folders/:folderId
폴더 삭제

### 3. 노트 관리 (Notes)

#### GET /notes
노트 목록 조회

**Query Parameters:**
- `folder_id`: 폴더 ID (선택적)
- `search`: 검색어 (선택적)
- `page`: 페이지 번호
- `limit`: 페이지당 항목 수

#### GET /notes/search
노트 검색

**Query Parameters:**
- `q`: 검색어 (필수)
- `folder_id`: 폴더 ID (선택적)
- `page`: 페이지 번호
- `limit`: 페이지당 항목 수

#### GET /notes/:noteId
노트 상세 조회

#### POST /notes
노트 생성 (파일 업로드 지원)

**Request Body (multipart/form-data):**
- `title`: 노트 제목 (필수)
- `content`: 노트 내용 (선택적)
- `folder_id`: 폴더 ID (필수)
- `file`: 업로드할 파일 (선택적)

**지원 파일 형식:**
- 이미지: JPEG, PNG, GIF, WebP
- 문서: PDF

#### PUT /notes/:noteId
노트 수정

#### DELETE /notes/:noteId
노트 삭제

### 4. 태그 관리 (Tags)

#### GET /tags
태그 목록 조회

**Query Parameters:**
- `search`: 검색어 (선택적)
- `page`: 페이지 번호
- `limit`: 페이지당 항목 수

#### GET /tags/popular
인기 태그 조회

#### GET /tags/:tagId
태그 상세 조회

#### POST /tags
태그 생성

#### PUT /tags/:tagId
태그 수정

#### DELETE /tags/:tagId
태그 삭제

#### POST /tags/:noteId/notes
노트에 태그 추가

#### DELETE /tags/:tagId/notes/:noteId
노트에서 태그 제거

### 5. 키워드 관리 (Keywords)

#### GET /keywords
키워드 목록 조회

#### GET /keywords/popular
인기 키워드 조회

#### GET /keywords/search
키워드 검색

#### GET /keywords/stats
키워드 통계 조회

#### GET /keywords/:keywordId
키워드 상세 조회

#### DELETE /keywords/:keywordId
키워드 삭제

### 6. 퀴즈 관리 (Quizzes)

#### GET /quizzes
퀴즈 목록 조회

#### GET /quizzes/:quizId
퀴즈 상세 조회

**Query Parameters:**
- `include_questions`: 문제 포함 여부 (true/false)

#### POST /quizzes
퀴즈 생성

**Request Body:**
```json
{
  "note_id": "number (필수)",
  "title": "string (1-200자)",
  "question_count": "number (기본값: 5)"
}
```

#### PUT /quizzes/:quizId
퀴즈 수정

#### DELETE /quizzes/:quizId
퀴즈 삭제

#### POST /quizzes/:quizId/regenerate
퀴즈 재생성

#### POST /quizzes/:quizId/questions
퀴즈 문제 추가

#### PUT /quizzes/:quizId/questions/:questionId
퀴즈 문제 수정

#### DELETE /quizzes/:quizId/questions/:questionId
퀴즈 문제 삭제

#### POST /quizzes/:quizId/submit
퀴즈 제출

**Request Body:**
```json
{
  "answers": {
    "question_id": "answer_string"
  }
}
```

#### GET /quizzes/attempts/history
퀴즈 시도 기록 조회

#### GET /quizzes/attempts/:attemptId
퀴즈 시도 상세 조회

#### GET /quizzes/stats/overview
퀴즈 통계 조회

#### DELETE /quizzes/attempts/:attemptId
퀴즈 시도 삭제

### 7. 검색 (Search)

#### GET /search
통합 검색

**Query Parameters:**
- `q`: 검색어 (필수)
- `type`: 검색 타입 (tfidf/keyword/hybrid, 기본값: hybrid)
- `folder_id`: 폴더 ID (선택적)
- `page`: 페이지 번호
- `limit`: 페이지당 항목 수
- `include_content`: 내용 포함 여부 (true/false)

#### GET /search/suggestions
검색어 자동완성

**Query Parameters:**
- `q`: 검색어 (최소 2자)
- `limit`: 제안 개수 (기본값: 10)

#### GET /search/stats
검색 통계 조회

#### GET /search/advanced
고급 검색

**Query Parameters:**
- `q`: 검색어
- `folder_id`: 폴더 ID
- `tags`: 태그 목록 (쉼표로 구분)
- `file_types`: 파일 타입 목록 (쉼표로 구분)
- `date_from`: 시작 날짜 (YYYY-MM-DD)
- `date_to`: 종료 날짜 (YYYY-MM-DD)
- `sort_by`: 정렬 기준 (relevance/date/title)
- `sort_order`: 정렬 순서 (asc/desc)

### 8. 캘린더 (Calendar)

#### GET /calendar/progress
학습 현황 조회 (캘린더)

**Query Parameters:**
- `year`: 년도 (필수)
- `month`: 월 (필수)

#### GET /calendar/stats
학습 통계 조회

**Query Parameters:**
- `period`: 기간 (일수, 기본값: 30)

#### GET /calendar/today-quiz
오늘의 퀴즈 조회

#### POST /calendar/attendance
출석체크

#### POST /calendar/study-time
학습 시간 기록

**Request Body:**
```json
{
  "minutes": "number (양수)",
  "date": "string (YYYY-MM-DD, 선택적)"
}
```

#### POST /calendar/note-creation
노트 생성 기록

#### POST /calendar/quiz-completion
퀴즈 완료 기록

#### POST /calendar/today-quiz
오늘의 퀴즈 설정

**Request Body:**
```json
{
  "quiz_id": "number (필수)",
  "date": "string (YYYY-MM-DD, 선택적)"
}
```

## 에러 코드

| HTTP 상태 코드 | 설명 |
|---------------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 등) |
| 500 | 서버 내부 오류 |

## Rate Limiting

API는 15분당 100회 요청으로 제한됩니다. 제한을 초과하면 429 상태 코드와 함께 에러 메시지가 반환됩니다.

## 파일 업로드

- 최대 파일 크기: 10MB
- 지원 형식: JPEG, PNG, GIF, WebP, PDF
- 업로드된 파일은 `/uploads` 디렉토리에 저장됩니다.

## 검색 기능

### 검색 타입

1. **TF-IDF**: 의미론적 검색, 키워드의 중요도 기반
2. **Keyword**: 키워드 매칭 검색, 정확한 단어 매칭
3. **Hybrid**: TF-IDF와 Keyword의 조합 (기본값)

### 검색 제안

검색어 입력 시 다음 항목들에서 제안을 제공합니다:
- 노트 제목
- 태그명
- 키워드

## AI 기능

### OCR (광학 문자 인식)
- Tesseract.js 기반
- 한국어 + 영어 지원
- 이미지 전처리를 통한 정확도 향상

### AI 요약
- Google Gemini API 사용
- 5-6문장 길이의 간결한 요약
- 자동 키워드 추출 및 태그 생성

### 퀴즈 생성
- AI 기반 자동 문제 생성
- 객관식, 단답형, 서술형 지원
- 노트 내용 기반 문제 생성

## 데이터베이스 스키마

주요 테이블:
- `users`: 사용자 정보
- `folders`: 폴더 구조
- `notes`: 노트 데이터
- `tags`: 태그 정보
- `keywords`: 키워드 데이터
- `quizzes`: 퀴즈 정보
- `quiz_questions`: 퀴즈 문제
- `quiz_attempts`: 퀴즈 시도 기록
- `learning_progress`: 학습 현황
- `daily_quizzes`: 오늘의 퀴즈

자세한 스키마는 `src/database/schema.sql` 파일을 참조하세요.
