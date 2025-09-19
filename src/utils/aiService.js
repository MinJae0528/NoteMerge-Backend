// src/utils/aiService.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // 환경 변수 로드

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // .env 파일에 GEMINI_API_KEY 추가
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function getEmbeddingFromAI(text) {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY가 설정되지 않았습니다. 임베딩을 생성할 수 없습니다.");
    return null;
  }
  if (!text || text.trim() === '') {
    return null; // 빈 텍스트는 임베딩 생성하지 않음
  }

  try {
    // Gemini Embedding 모델 사용
    const model = genAI.getGenerativeModel({ model: "embedding-001" }); // 또는 다른 임베딩 모델
    const result = await model.embedContent(text);
    const embedding = result.embedding.values; // 벡터 값 추출
    return embedding; // [0.1, 0.2, 0.3, ...] 형태의 숫자 배열 반환
  } catch (error) {
    console.error("AI 임베딩 생성 중 오류 발생:", error);
    return null;
  }
}

module.exports = { getEmbeddingFromAI };