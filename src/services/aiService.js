const { GoogleGenerativeAI } = require('@google/generative-ai');
const natural = require('natural');
require('dotenv').config();

class AIService {
  constructor() {
    // .env 파일의 ENABLE_AI 값이 'true'일 때만 AI 클라이언트를 초기화합니다.
    if (process.env.ENABLE_AI === 'true' && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== '여기에_실제_API_키를_입력하세요') {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.textGenModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
      this.embeddingModel = this.genAI.getGenerativeModel({ model: "embedding-001" });
      console.log("✅ AI Service is ENABLED.");
    } else {
      this.genAI = null;
      console.warn("🟡 AI Service is DISABLED. Using mock data. To enable, set ENABLE_AI=true in .env file.");
    }
  }

  /**
   * 주어진 텍스트를 요약합니다.
   * @param {string} text - 요약할 원본 텍스트
   * @returns {Promise<object>} 요약 결과 객체 { summary, success, error? }
   */
  async generateSummary(text) {
    // AI 스위치가 꺼져있으면 즉시 가짜 데이터를 반환하고 종료합니다.
    if (!this.genAI) {
      return { summary: "AI 기능이 비활성화되어 있습니다.", success: true };
    }
    if (!text || text.trim().length === 0) return { summary: '', success: false, error: '요약할 텍스트가 없습니다.' };

    try {
      const prompt = `다음 텍스트를 핵심 내용 중심으로 간결하게 요약해주세요: ${text}`;
      const result = await this.textGenModel.generateContent(prompt);
      return { summary: result.response.text().trim(), success: true };
    } catch (error) {
      console.error('Summary generation error:', error);
      return { summary: null, success: false, error: error.message };
    }
  }

  /**
   * 텍스트에서 키워드를 추출합니다. (natural 라이브러리 사용)
   * @param {string} text - 키워드를 추출할 원본 텍스트
   * @returns {Promise<object>} 키워드 추출 결과 객체 { keywords, success, error? }
   */
  async extractKeywords(text, maxKeywords = 10) {
     // 이 함수는 외부 API를 사용하지 않으므로 항상 동작합니다.
     try {
        if (!text || text.trim().length === 0) {
            return { keywords: [], success: false, error: '키워드를 추출할 텍스트가 없습니다.' };
        }
        const tokenizer = new natural.WordTokenizer();
        const tokens = tokenizer.tokenize(text.toLowerCase());
        const stopWords = new Set(['이', '가', '을', '를', '에', '의', '로', '은', '는', '도', 'the', 'a', 'is', 'in', 'on']);
        const filteredTokens = tokens.filter(token => token.length > 1 && !stopWords.has(token));
        const wordFreq = {};
        filteredTokens.forEach(word => { wordFreq[word] = (wordFreq[word] || 0) + 1; });
        const keywords = Object.entries(wordFreq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, maxKeywords)
            .map(([word, freq]) => ({ word, score: freq / filteredTokens.length }));
        return { keywords, success: true };
    } catch (error) {
        console.error('Keyword extraction error:', error);
        return { keywords: [], success: false, error: error.message };
    }
  }

  /**
   * 텍스트를 숫자 벡터(Vector)로 변환합니다.
   * @param {string} text - 임베딩을 생성할 텍스트
   * @returns {Promise<number[]|null>} 임베딩 벡터 배열 또는 null
   */
  async getEmbedding(text) {
    if (!this.genAI) return null; // AI가 꺼져있으면 null 반환
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
   * @returns {Promise<object>} 퀴즈 생성 결과 객체 { questions, success, error? }
   */
  async generateQuizQuestions(text, questionCount = 5) {
    if (!this.genAI) {
      return {
        questions: [{ type: "short_answer", question: "AI 기능이 꺼져있어 테스트용으로 생성된 문제입니다.", options: null, correct_answer: "확인" }],
        success: true
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

