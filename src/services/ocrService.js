const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');

class OCRService {
  constructor() {
    this.worker = null;
  }

  // Tesseract 워커 초기화
  async initWorker() {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('kor+eng', 1, {
        logger: m => console.log(m)
      });
      await this.worker.load();
      await this.worker.loadLanguage('kor+eng');
      await this.worker.initialize('kor+eng');
    }
    return this.worker;
  }

  // 이미지 전처리 (OCR 정확도 향상)
  async preprocessImage(imagePath) {
    try {
      const processedPath = imagePath.replace(/\.[^/.]+$/, '_processed.png');
      
      await sharp(imagePath)
        .resize(2000, 2000, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(processedPath);

      return processedPath;
    } catch (error) {
      console.error('Image preprocessing error:', error);
      return imagePath; // 전처리 실패 시 원본 사용
    }
  }

  // 이미지에서 텍스트 추출
  async extractTextFromImage(imagePath) {
    try {
      console.log('OCR 시작:', imagePath);
      
      // 이미지 전처리
      const processedPath = await this.preprocessImage(imagePath);
      
      // OCR 실행
      const worker = await this.initWorker();
      const { data: { text, confidence } } = await worker.recognize(processedPath);
      
      // 전처리된 이미지 삭제
      if (processedPath !== imagePath) {
        const fs = require('fs');
        try {
          fs.unlinkSync(processedPath);
        } catch (err) {
          console.warn('전처리된 이미지 삭제 실패:', err.message);
        }
      }

      console.log('OCR 완료. 신뢰도:', confidence);

      return {
        text: text.trim(),
        confidence: confidence,
        success: confidence > 30 // 신뢰도 30% 이상일 때만 성공으로 간주
      };

    } catch (error) {
      console.error('OCR error:', error);
      return {
        text: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  // PDF에서 텍스트 추출 (PDF 파싱 라이브러리 사용)
  async extractTextFromPDF(pdfPath) {
    try {
      const pdfParse = require('pdf-parse');
      const fs = require('fs');
      
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      return {
        text: data.text.trim(),
        pages: data.numpages,
        success: data.text.length > 0
      };

    } catch (error) {
      console.error('PDF parsing error:', error);
      return {
        text: '',
        pages: 0,
        success: false,
        error: error.message
      };
    }
  }

  // 워드 문서에서 텍스트 추출
  async extractTextFromWord(docxPath) {
    try {
      const mammoth = require('mammoth');
      const fs = require('fs');
      
      const buffer = fs.readFileSync(docxPath);
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        text: result.value.trim(),
        success: result.value.length > 0,
        messages: result.messages
      };

    } catch (error) {
      console.error('Word parsing error:', error);
      return {
        text: '',
        success: false,
        error: error.message
      };
    }
  }

  // 파일 타입에 따른 텍스트 추출
  async extractText(filePath, fileType) {
    try {
      switch (fileType) {
        case 'image':
          return await this.extractTextFromImage(filePath);
        
        case 'pdf':
          return await this.extractTextFromPDF(filePath);
        
        case 'word':
          return await this.extractTextFromWord(filePath);
        
        default:
          return {
            text: '',
            success: false,
            error: '지원하지 않는 파일 형식입니다.'
          };
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      return {
        text: '',
        success: false,
        error: error.message
      };
    }
  }

  // 워커 종료
  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

module.exports = new OCRService();
