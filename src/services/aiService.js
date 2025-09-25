const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AIService {
  constructor() {
    if (process.env.ENABLE_AI !== 'true') {
      console.warn("🟡 AI Service is DISABLED. Using mock data.");
      this.genAI = null;
    } else if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '여기에_실제_API_키를_입력하세요') {
      console.warn("경고: GEMINI_API_KEY가 없습니다. AI 기능이 제한됩니다.");
      this.genAI = null;
    } else {
      console.log("✅ AI Service is ENABLED.");
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.textGenModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
      this.embeddingModel = this.genAI.getGenerativeModel({ model: "embedding-001" });
    }
  }

  /**
   * 텍스트를 한 번에 분석하여 요약, 키워드, 태그를 모두 생성합니다.
   * @param {string} text - 분석할 원본 텍스트
   * @returns {Promise<object>} 분석 결과 객체 { summary, keywords, tags, success }
   */
  async analyzeText(text) {
    if (!this.genAI) return { success: true, summary: "AI 비활성화됨", keywords: [], tags: [] };
    if (!text || text.trim().length === 0) return { success: false, error: '분석할 텍스트가 없습니다.' };

    try {
      const prompt = `
        다음 텍스트를 분석하여 아래의 JSON 형식에 맞춰 요약, 핵심 키워드, 관련 태그를 생성해줘.
        - summary: 텍스트의 핵심 내용을 3-5 문장으로 요약.
        - keywords: 가장 중요한 명사 위주의 키워드 5개.
        - tags: 내용을 대표하는 카테고리 태그 3개.

        텍스트:
        "${text}"

        JSON 응답:
      `;
      
      const result = await this.textGenModel.generateContent(prompt);
      const responseText = result.response.text().trim();
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI가 올바른 JSON 형식으로 응답하지 않았습니다.');
      
      const analysisData = JSON.parse(jsonMatch[0]);

      const keywordsWithScore = (analysisData.keywords || []).map(kw => ({ word: kw, score: 1 }));

      return {
        summary: analysisData.summary || "",
        keywords: keywordsWithScore,
        tags: analysisData.tags || [],
        success: true
      };
    } catch (error) {
      console.error('AI text analysis error:', error);
      return { success: false, error: error.message };
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
}

module.exports = new AIService();

