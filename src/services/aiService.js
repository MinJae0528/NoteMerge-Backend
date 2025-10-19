const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AIService {
  constructor() {
    if (process.env.ENABLE_AI !== 'true') {
      console.warn("🟡 AI Service is DISABLED. To enable, set ENABLE_AI=true in .env file.");
      this.genAI = null;
    } else if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === '여기에_실제_API_키를_입력하세요') {
      console.warn("경고: GEMINI_API_KEY가 .env 파일에 설정되지 않았습니다. AI 기능이 제한됩니다.");
      this.genAI = null;
    } else {
      console.log("✅ AI Service is ENABLED.");
      console.log("🔑 API Key:", process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT FOUND');
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.testConnection();
    }
  }

  /**
   * AI 모델 연결 테스트
   */
  async testConnection() {
    const modelsToTry = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    for (const model of modelsToTry) {
      try {
        console.log(`🧪 Testing model: ${model}`);
        const genModel = this.genAI.getGenerativeModel({ model });
        const result = await genModel.generateContent("Hello, test connection");
        const response = await result.response;
        console.log(`✅ AI 모델 연결 성공: ${model}`);
        this.workingModel = model; // 성공한 모델 저장
        this.textGenModel = genModel; // 성공한 모델 객체 저장
        return;
      } catch (error) {
        console.log(`❌ ${model} 실패:`, error.message);
        continue;
      }
    }
    
    console.error("❌ 모든 AI 모델 연결 실패");
    console.warn("🔧 다음 사항을 확인해주세요:");
    console.warn("   1. GEMINI_API_KEY가 올바른지 확인");
    console.warn("   2. API 키에 충분한 권한이 있는지 확인");
    console.warn("   3. 네트워크 연결 상태 확인");
  }

  /**
   * 텍스트를 분석하여 요약, 키워드, 태그를 한 번에 생성합니다.
   */
  async analyzeText(text) {
    // AI 스위치가 꺼져있으면 즉시 빈 데이터를 반환합니다.
    if (!this.genAI || !this.textGenModel) {
      return { summary: null, keywords: [], tags: [], success: true };
    }
    if (!text || text.trim().length === 0) {
      return { summary: null, keywords: [], tags: [], success: false, error: '분석할 텍스트가 없습니다.' };
    }

    try {
      const prompt = `
        Analyze the following text and extract a summary, main keywords, and relevant tags.
        Respond ONLY in the following JSON format:
        {
          "summary": "A concise summary of the text.",
          "keywords": [{"word": "keyword1", "score": 0.9}],
          "tags": ["tag1", "tag2"]
        }
        Text to analyze:
        ---
        ${text}
        ---
      `;

      const result = await this.textGenModel.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      
      // Gemini API가 응답에 ```json ... ``` 마크다운을 포함하는 경우가 있으므로 파싱
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
   */
  async getEmbedding(text) {
    if (!this.ai) return null;
    if (!text || text.trim() === '') return null;
    
    try {
      // 새 API에서는 임베딩 기능이 다를 수 있으므로 일단 null 반환
      console.warn("임베딩 기능은 새 API에서 아직 구현되지 않았습니다.");
      return null;
    } catch (error) {
      console.error("AI 임베딩 생성 중 오류 발생:", error);
      return null;
    }
  }

  /**
   * 텍스트를 기반으로 JSON 형식의 퀴즈 문제를 생성합니다.
   */
  async generateQuizQuestions(text, questionCount = 5) {
    // AI 스위치가 꺼져있으면 실패 응답을 반환합니다.
    if (!this.genAI || !this.textGenModel) {
      return { success: false, questions: [], error: "AI 기능이 비활성화되어 있습니다." };
    }

    // 텍스트가 너무 짧으면 더미 퀴즈 반환
    if (!text || text.trim().length < 50) {
      console.warn(`텍스트가 너무 짧아 더미 퀴즈를 생성합니다. (길이: ${text?.trim().length || 0})`);
      return {
        success: true,
        questions: [
          {
            type: "multiple_choice",
            question: "이 노트를 어떻게 복습하시겠습니까?",
            options: ["다시 읽어보기", "요약 작성하기", "키워드 정리하기", "연관 노트 찾기"],
            correct_answer: "다시 읽어보기"
          },
          {
            type: "short_answer",
            question: "이 노트의 핵심 내용을 한 줄로 요약해보세요.",
            options: [],
            correct_answer: "복습 필요"
          }
        ]
      };
    }

    try {
      const prompt = `다음 텍스트를 바탕으로 ${questionCount}개의 퀴즈 문제를 생성하고, 반드시 아래의 JSON 형식으로만 응답해줘.\n\nJSON 형식:\n{\n  "questions": [\n    {\n      "type": "multiple_choice",\n      "question": "문제 내용",\n      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],\n      "correct_answer": "정답"\n    }\n  ]\n}\n\n텍스트:\n${text}`;
      
      const result = await this.textGenModel.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText;
      
      const quizData = JSON.parse(jsonString);
      return { questions: quizData.questions || [], success: true };
    } catch (error) {
      console.error('Quiz generation error:', error);
      
      // API 오류 시 더미 퀴즈 반환 (fallback)
      console.warn('AI 퀴즈 생성 실패, 더미 퀴즈를 반환합니다.');
      return {
        success: true,
        questions: [
          {
            type: "multiple_choice", 
            question: "이 노트의 내용을 복습해보세요.",
            options: ["내용을 다시 읽어보기", "키워드 정리하기", "요약 작성하기", "모든 것"],
            correct_answer: "모든 것"
          }
        ]
      };
    }
  }
}

module.exports = new AIService();

