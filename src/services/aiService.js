const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AIService {
  constructor() {
    if (process.env.ENABLE_AI !== 'true') {
      console.warn("🟡 AI Service is DISABLED. Using mock data. To enable, set ENABLE_AI=true in .env file.");
      this.genAI = null;
    } else if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '여기에_실제_API_키를_입력하세요') {
      console.warn("경고: GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다. AI 기능이 제한됩니다.");
      this.genAI = null;
    } else {
      console.log("✅ AI Service is ENABLED.");
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.textGenModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
      this.embeddingModel = this.genAI.getGenerativeModel({ model: "embedding-001" });
    }
  }

  /**
   * 텍스트를 분석하여 요약, 키워드, 태그를 한 번에 생성합니다.
   * @param {string} text - 분석할 원본 텍스트
   * @returns {Promise<object>} 분석 결과 객체 { summary, keywords, tags, success, error? }
   */
  async analyzeText(text) {
    if (!this.genAI) {
      return {
        summary: "AI 기능이 비활성화되어 있습니다.",
        keywords: [{ word: "테스트", score: 1 }, { word: "키워드", score: 0.5 }],
        tags: ["테스트 태그"],
        success: true
      };
    }
    if (!text || text.trim().length === 0) {
      return { summary: null, keywords: [], tags: [], success: false, error: '분석할 텍스트가 없습니다.' };
    }

    try {
      const prompt = `
        다음 텍스트를 분석하여 요약, 핵심 키워드, 그리고 관련 태그를 추출해줘.
        반드시 아래의 JSON 형식으로만 응답해줘.

        JSON 형식:
        {
          "summary": "텍스트를 5문장 이내로 요약한 내용.",
          "keywords": [
            {"word": "핵심키워드1", "score": 0.9},
            {"word": "핵심키워드2", "score": 0.8}
          ],
          "tags": ["태그1", "태그2", "태그3"]
        }

        텍스트:
        ---
        ${text}
        ---
      `;

      const result = await this.textGenModel.generateContent(prompt);
      const responseText = result.response.text().trim();
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText;
      
      const analysisData = JSON.parse(jsonString);
      return { ...analysisData, success: true };
    } catch (error) {
      console.error('Text analysis error:', error);
      return { summary: null, keywords: [], tags: [], success: false, error: error.message };
    }
  }

  /**
   * 텍스트를 숫자 벡터(Vector)로 변환합니다.
   * @param {string} text - 임베딩을 생성할 텍스트
   * @returns {Promise<number[]|null>} 임베딩 벡터 배열 또는 null
   */
  async getEmbedding(text) {
    if (!this.genAI) return null;
    if (!text || text.trim() === '') return null;
    
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error("AI 임베딩 생성 중 오류 발생:", error);
      return null;
    }
  }

  /**
   * 텍스트를 기반으로 JSON 형식의 퀴즈 문제를 생성합니다.
   * @param {string} text - 퀴즈를 생성할 원본 텍스트
   * @param {number} [questionCount=5] - 생성할 문제 수
   * @returns {Promise<object>} 퀴즈 생성 결과 객체 { questions, success, error? }
   */
  async generateQuizQuestions(text, questionCount = 5) {
    if (!this.genAI) {
      return {
        success: true,
        questions: [{ type: "short_answer", question: `테스트 질문: ${text.substring(0, 20)}...`, options: null, correct_answer: "테스트 정답" }]
      };
    }
    try {
      const prompt = `다음 텍스트를 바탕으로 ${questionCount}개의 퀴즈 문제를 생성하고, 반드시 아래의 JSON 형식으로만 응답해줘.\n\n형식:\n{\n  "questions": [\n    {\n      "type": "multiple_choice",\n      "question": "문제 내용",\n      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],\n      "correct_answer": "정답"\n    }\n  ]\n}\n\n텍스트:\n${text}`;
      
      const result = await this.textGenModel.generateContent(prompt);
      const responseText = result.response.text().trim();
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText;
      
      const quizData = JSON.parse(jsonString);
      return { questions: quizData.questions || [], success: true };
    } catch (error) {
      console.error('Quiz generation error:', error);
      return { questions: [], success: false, error: error.message };
    }
  }
}

module.exports = new AIService();

