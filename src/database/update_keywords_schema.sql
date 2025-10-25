-- 키워드 테이블 구조 간소화 스크립트
-- 점수(score)와 출처(source) 컬럼 제거

USE notemerge;

-- 기존 note_keywords 테이블에서 score, source 컬럼이 있다면 제거
-- (에러가 발생해도 무시하도록 처리)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'notemerge' 
     AND TABLE_NAME = 'note_keywords' 
     AND COLUMN_NAME = 'score') > 0,
    'ALTER TABLE note_keywords DROP COLUMN score',
    'SELECT "score column does not exist" as result'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'notemerge' 
     AND TABLE_NAME = 'note_keywords' 
     AND COLUMN_NAME = 'source') > 0,
    'ALTER TABLE note_keywords DROP COLUMN source',
    'SELECT "source column does not exist" as result'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 현재 테이블 구조 확인
DESCRIBE keywords;
DESCRIBE note_keywords;

-- 간소화된 구조가 잘 적용되었는지 확인
SELECT 'Keywords 테이블과 note_keywords 테이블이 간소화되었습니다.' as message;