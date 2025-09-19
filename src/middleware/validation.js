const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required().messages({
    'string.alphanum': '사용자명은 영문자와 숫자만 사용할 수 있습니다.',
    'string.min': '사용자명은 최소 3자 이상이어야 합니다.',
    'string.max': '사용자명은 최대 30자까지 가능합니다.',
    'any.required': '사용자명은 필수입니다.'
  }),
  email: Joi.string().email().required().messages({
    'string.email': '올바른 이메일 형식이 아닙니다.',
    'any.required': '이메일은 필수입니다.'
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.min': '비밀번호는 최소 6자 이상이어야 합니다.',
    'string.max': '비밀번호는 최대 100자까지 가능합니다.',
    'any.required': '비밀번호는 필수입니다.'
  })
});

const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': '사용자명 또는 이메일은 필수입니다.'
  }),
  password: Joi.string().required().messages({
    'any.required': '비밀번호는 필수입니다.'
  })
});

const noteSchema = Joi.object({
  title: Joi.string().min(1).max(200).required().messages({
    'string.min': '제목은 최소 1자 이상이어야 합니다.',
    'string.max': '제목은 최대 200자까지 가능합니다.',
    'any.required': '제목은 필수입니다.'
  }),
  content: Joi.string().allow('').messages({
    'string.base': '내용은 문자열이어야 합니다.'
  }),
  folder_id: Joi.number().integer().positive().required().messages({
    'number.base': '폴더 ID는 숫자여야 합니다.',
    'number.integer': '폴더 ID는 정수여야 합니다.',
    'number.positive': '폴더 ID는 양수여야 합니다.',
    'any.required': '폴더 ID는 필수입니다.'
  }),
  file_type: Joi.string().valid('text', 'image', 'pdf').default('text').messages({
    'any.only': '파일 타입은 text, image, pdf 중 하나여야 합니다.'
  })
});

const folderSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.min': '폴더명은 최소 1자 이상이어야 합니다.',
    'string.max': '폴더명은 최대 100자까지 가능합니다.',
    'any.required': '폴더명은 필수입니다.'
  }),
  parent_folder_id: Joi.number().integer().positive().allow(null).messages({
    'number.base': '상위 폴더 ID는 숫자여야 합니다.',
    'number.integer': '상위 폴더 ID는 정수여야 합니다.',
    'number.positive': '상위 폴더 ID는 양수여야 합니다.'
  })
});

const quizSchema = Joi.object({
  note_id: Joi.number().integer().positive().required().messages({
    'number.base': '노트 ID는 숫자여야 합니다.',
    'number.integer': '노트 ID는 정수여야 합니다.',
    'number.positive': '노트 ID는 양수여야 합니다.',
    'any.required': '노트 ID는 필수입니다.'
  }),
  title: Joi.string().min(1).max(200).required().messages({
    'string.min': '퀴즈 제목은 최소 1자 이상이어야 합니다.',
    'string.max': '퀴즈 제목은 최대 200자까지 가능합니다.',
    'any.required': '퀴즈 제목은 필수입니다.'
  })
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: '입력 데이터가 올바르지 않습니다.',
        errors: errorMessages
      });
    }
    req.body = value;
    next();
  };
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  noteSchema,
  folderSchema,
  quizSchema
};