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
      // API 연결 테스트를 비동기로 실행하지만 서버 시작을 차단하지 않음
      this.testConnection().catch(err => console.log('AI 모델 테스트 실패, 서비스는 계속 진행됩니다.'));
    }
  }

  /**
   * AI 모델 연결 테스트
   */
  async testConnection() {
    // 먼저 사용 가능한 모델 목록을 확인해보기
    try {
      console.log('🔍 사용 가능한 모델 목록 확인 중...');
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY);
      if (response.ok) {
        const data = await response.json();
        const availableModels = data.models?.map(m => m.name) || [];
        console.log('📋 사용 가능한 모델들:', availableModels.slice(0, 5)); // 처음 5개만 표시
      }
    } catch (error) {
      console.log('⚠️ 모델 목록 조회 실패, 기본 모델로 시도');
    }

    const modelsToTry = [
      'models/gemini-2.5-flash',
      'models/gemini-2.5-pro-preview-03-25',
      'models/gemini-2.5-flash-preview-05-20',
      'models/gemini-2.5-flash-lite-preview-06-17'
    ];

    for (const model of modelsToTry) {
      try {
        console.log(`🧪 Testing model: ${model}`);
        const genModel = this.genAI.getGenerativeModel({ model });
        const result = await genModel.generateContent("안녕하세요");
        const response = await result.response;
        const text = response.text();
        if (text && text.length > 0) {
          console.log(`✅ AI 모델 연결 성공: ${model}`);
          this.workingModel = model; // 성공한 모델 저장
          this.textGenModel = genModel; // 성공한 모델 객체 저장
          return;
        }
      } catch (error) {
        console.log(`❌ ${model} 실패:`, error.message.substring(0, 100) + '...');
        continue;
      }
    }
    
    // 모든 모델 실패 시에도 기본 모델로 설정 (기능 제한적으로라도 동작)
    console.error("❌ 모든 AI 모델 연결 실패, 기본 모델로 설정");
    try {
      this.workingModel = 'models/gemini-2.5-flash';
      this.textGenModel = this.genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
      console.log("🔄 기본 모델(models/gemini-2.5-flash)로 설정 완료");
    } catch (fallbackError) {
      console.error("❌ 기본 모델 설정도 실패:", fallbackError.message);
      this.textGenModel = null;
    }
    
    console.warn("🔧 다음 사항을 확인해주세요:");
    console.warn("   1. GEMINI_API_KEY가 올바른지 확인");
    console.warn("   2. API 키에 충분한 권한이 있는지 확인");
    console.warn("   3. 네트워크 연결 상태 확인");
    console.warn("   4. Google AI Studio에서 API 사용 설정 확인");
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
        다음 텍스트를 분석하고 핵심 요약, 주요 키워드, 관련 태그를 추출해줘.
        **응답은 반드시 한국어로 작성**해야 하며, 오직 아래의 JSON 형식으로만 응답해줘.
        
        JSON 형식:
        {
          "summary": "텍스트의 내용을 간결하게 요약한 한국어 문장.",
          "keywords": [{"word": "핵심키워드1", "score": 0.9}],
          "tags": ["태그1", "태그2", "태그3"]
        }
        
        분석할 텍스트:
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
   * 파일들을 분석하여 텍스트, 요약, 키워드, 태그를 추출합니다.
   */
  async analyzeFiles(files) {
    if (!this.genAI || !this.textGenModel) {
      return { extractedText: '', summary: null, keywords: [], tags: [], success: true };
    }

    if (!files || files.length === 0) {
      return { extractedText: '', summary: null, keywords: [], tags: [], success: true };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      
      let allExtractedText = '';
      const fileContents = [];

      for (const file of files) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension)) {
          // 이미지 파일 처리
          console.log(`이미지 파일 분석 중: ${file.originalname}`);
          
          const imageData = fs.readFileSync(file.path);
          const base64Image = imageData.toString('base64');
          
          fileContents.push({
            inlineData: {
              data: base64Image,
              mimeType: file.mimetype
            }
          });
          
        } else if (fileExtension === '.pdf') {
          // PDF 파일 처리 - Gemini는 PDF를 직접 읽을 수 있음
          console.log(`PDF 파일 분석 중: ${file.originalname}, 크기: ${file.size} bytes`);
          
          try {
            const pdfData = fs.readFileSync(file.path);
            const base64Pdf = pdfData.toString('base64');
            
            console.log(`PDF 파일 인코딩 완료: ${file.originalname}, Base64 길이: ${base64Pdf.length}`);
            
            fileContents.push({
              inlineData: {
                data: base64Pdf,
                mimeType: 'application/pdf'
              }
            });
          } catch (pdfError) {
            console.error(`PDF 파일 처리 실패: ${file.originalname}`, pdfError);
            throw pdfError;
          }
        }
      }

      if (fileContents.length > 0) {
        const prompt = `
          첨부된 파일들을 분석하고 다음을 추출해주세요:
          1. 파일에서 읽을 수 있는 모든 텍스트 내용
          2. 내용의 핵심 요약
          3. 주요 키워드
          4. 관련 태그
          
          **응답은 반드시 한국어로 작성**하고, 아래 JSON 형식으로만 응답해주세요:
          
          {
            "extractedText": "파일에서 추출한 모든 텍스트 내용",
            "summary": "내용의 핵심 요약",
            "keywords": [{"word": "핵심키워드1", "score": 0.9}],
            "tags": ["태그1", "태그2", "태그3"]
          }
        `;

        const result = await this.textGenModel.generateContent([prompt, ...fileContents]);
        const response = await result.response;
        const responseText = response.text().trim();
        
        console.log('파일 분석 결과:', responseText.substring(0, 500) + '...');
        
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;
        
        const analysisData = JSON.parse(jsonString);
        return { ...analysisData, success: true };
      }

      return { extractedText: '', summary: null, keywords: [], tags: [], success: true };
      
    } catch (error) {
      console.error('File analysis error:', error);
      return { extractedText: '', summary: null, keywords: [], tags: [], success: false, error: error.message };
    }
  }

  /**
   * 텍스트와 파일들을 동시에 분석하여 통합된 결과를 반환합니다.
   */
  async analyzeTextAndFiles(text = '', files = []) {
    if (!this.genAI || !this.textGenModel) {
      return { extractedText: '', summary: null, keywords: [], tags: [], success: true };
    }

    // 텍스트도 없고 파일도 없으면 빈 결과 반환
    if ((!text || text.trim().length === 0) && (!files || files.length === 0)) {
      return { extractedText: '', summary: null, keywords: [], tags: [], success: true };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      
      const fileContents = [];
      const contentParts = [];

      // 텍스트가 있으면 추가
      if (text && text.trim().length > 0) {
        contentParts.push(`사용자가 작성한 텍스트:\n${text}\n`);
      }

      // 파일들을 처리
      for (const file of files) {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(fileExtension)) {
          console.log(`이미지 파일 분석 중: ${file.originalname}`);
          
          const imageData = fs.readFileSync(file.path);
          const base64Image = imageData.toString('base64');
          
          fileContents.push({
            inlineData: {
              data: base64Image,
              mimeType: file.mimetype
            }
          });
          
        } else if (fileExtension === '.pdf') {
          console.log(`PDF 파일 분석 중: ${file.originalname}`);
          
          const pdfData = fs.readFileSync(file.path);
          const base64Pdf = pdfData.toString('base64');
          
          fileContents.push({
            inlineData: {
              data: base64Pdf,
              mimeType: 'application/pdf'
            }
          });
        }
      }

      // 프롬프트 구성
      let prompt = `
        다음 내용들을 종합적으로 분석해주세요:
        ${contentParts.join('\n')}
        ${fileContents.length > 0 ? '\n그리고 첨부된 파일들의 내용도 함께 분석해주세요.' : ''}
        
        분석 결과로 다음을 추출해주세요:
        1. 파일에서 추출한 텍스트 내용 (있는 경우)
        2. 전체 내용의 핵심 요약 (텍스트와 파일 내용을 모두 고려)
        3. 주요 키워드 (텍스트와 파일에서 추출)
        4. 관련 태그 (전체 내용을 바탕으로)
        
        **응답은 반드시 한국어로 작성**하고, 아래 JSON 형식으로만 응답해주세요:
        
        {
          "extractedText": "파일에서 추출한 텍스트 내용 (파일이 없으면 빈 문자열)",
          "summary": "텍스트와 파일 내용을 종합한 핵심 요약",
          "keywords": [{"word": "핵심키워드1", "score": 0.9}, {"word": "핵심키워드2", "score": 0.8}],
          "tags": ["태그1", "태그2", "태그3"]
        }
      `;

      // API 호출 준비
      const apiContent = [prompt, ...fileContents];
      
      console.log('통합 분석 시작 - 텍스트 길이:', text.length, '파일 수:', files.length);
      
      try {
        const result = await this.textGenModel.generateContent(apiContent);
        const response = await result.response;
        const responseText = response.text().trim();
        
        console.log('통합 분석 API 응답 받음, 응답 길이:', responseText.length);
        console.log('응답 내용 (처음 500자):', responseText.substring(0, 500));
        
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;
        
        console.log('JSON 파싱 시도, JSON 길이:', jsonString.length);
        const analysisData = JSON.parse(jsonString);
        
        console.log('통합 분석 완료 - 요약 길이:', analysisData.summary?.length || 0, '키워드 수:', analysisData.keywords?.length || 0);
        
        return { ...analysisData, success: true };
      } catch (apiError) {
        console.error('AI API 호출 또는 파싱 실패:');
        console.error('에러 타입:', apiError.constructor.name);
        console.error('에러 메시지:', apiError.message);
        console.error('에러 스택:', apiError.stack);
        throw apiError;
      }
      
    } catch (error) {
      console.error('Text and files analysis error:', error);
      return { extractedText: '', summary: null, keywords: [], tags: [], success: false, error: error.message };
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

