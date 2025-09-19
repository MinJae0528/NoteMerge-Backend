const { pool } = require('../config/database');

// 학습 현황 조회 (캘린더)
const getLearningProgress = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: '년도와 월을 입력해주세요.'
      });
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날

    // 학습 현황 조회
    const [progress] = await pool.execute(
      `SELECT 
        date,
        study_time_minutes,
        notes_created,
        quizzes_completed,
        attendance_checked
      FROM learning_progress 
      WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date`,
      [userId, startDate, endDate]
    );

    // 해당 월의 모든 날짜에 대한 데이터 생성
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${month.padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayProgress = progress.find(p => p.date === date);
      
      calendarData.push({
        date,
        study_time_minutes: dayProgress?.study_time_minutes || 0,
        notes_created: dayProgress?.notes_created || 0,
        quizzes_completed: dayProgress?.quizzes_completed || 0,
        attendance_checked: dayProgress?.attendance_checked || false
      });
    }

    // 월별 통계
    const totalStudyTime = progress.reduce((sum, p) => sum + p.study_time_minutes, 0);
    const totalNotes = progress.reduce((sum, p) => sum + p.notes_created, 0);
    const totalQuizzes = progress.reduce((sum, p) => sum + p.quizzes_completed, 0);
    const attendanceDays = progress.filter(p => p.attendance_checked).length;

    res.json({
      success: true,
      data: {
        calendar: calendarData,
        monthly_stats: {
          total_study_time_minutes: totalStudyTime,
          total_notes_created: totalNotes,
          total_quizzes_completed: totalQuizzes,
          attendance_days: attendanceDays,
          total_days: daysInMonth
        }
      }
    });

  } catch (error) {
    console.error('Get learning progress error:', error);
    res.status(500).json({
      success: false,
      message: '학습 현황을 가져오는데 실패했습니다.'
    });
  }
};

// 출석체크
const checkAttendance = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];

    // 오늘 이미 출석체크했는지 확인
    const [existing] = await pool.execute(
      'SELECT progress_id FROM learning_progress WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (existing.length > 0) {
      // 이미 출석체크한 경우 업데이트
      await pool.execute(
        'UPDATE learning_progress SET attendance_checked = TRUE WHERE user_id = ? AND date = ?',
        [userId, today]
      );
    } else {
      // 새로운 출석체크 기록 생성
      await pool.execute(
        'INSERT INTO learning_progress (user_id, date, attendance_checked) VALUES (?, ?, TRUE)',
        [userId, today]
      );
    }

    res.json({
      success: true,
      message: '출석체크가 완료되었습니다.',
      data: {
        date: today,
        attendance_checked: true
      }
    });

  } catch (error) {
    console.error('Check attendance error:', error);
    res.status(500).json({
      success: false,
      message: '출석체크에 실패했습니다.'
    });
  }
};

// 학습 시간 기록
const recordStudyTime = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { minutes, date } = req.body;

    if (!minutes || minutes <= 0) {
      return res.status(400).json({
        success: false,
        message: '유효한 학습 시간을 입력해주세요.'
      });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 해당 날짜의 기록이 있는지 확인
    const [existing] = await pool.execute(
      'SELECT progress_id, study_time_minutes FROM learning_progress WHERE user_id = ? AND date = ?',
      [userId, targetDate]
    );

    if (existing.length > 0) {
      // 기존 기록 업데이트
      const newTime = existing[0].study_time_minutes + minutes;
      await pool.execute(
        'UPDATE learning_progress SET study_time_minutes = ? WHERE user_id = ? AND date = ?',
        [newTime, userId, targetDate]
      );
    } else {
      // 새로운 기록 생성
      await pool.execute(
        'INSERT INTO learning_progress (user_id, date, study_time_minutes) VALUES (?, ?, ?)',
        [userId, targetDate, minutes]
      );
    }

    res.json({
      success: true,
      message: '학습 시간이 기록되었습니다.',
      data: {
        date: targetDate,
        study_time_minutes: existing.length > 0 ? 
          existing[0].study_time_minutes + minutes : minutes
      }
    });

  } catch (error) {
    console.error('Record study time error:', error);
    res.status(500).json({
      success: false,
      message: '학습 시간 기록에 실패했습니다.'
    });
  }
};

// 노트 생성 기록
const recordNoteCreation = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 해당 날짜의 기록이 있는지 확인
    const [existing] = await pool.execute(
      'SELECT progress_id, notes_created FROM learning_progress WHERE user_id = ? AND date = ?',
      [userId, targetDate]
    );

    if (existing.length > 0) {
      // 기존 기록 업데이트
      const newCount = existing[0].notes_created + 1;
      await pool.execute(
        'UPDATE learning_progress SET notes_created = ? WHERE user_id = ? AND date = ?',
        [newCount, userId, targetDate]
      );
    } else {
      // 새로운 기록 생성
      await pool.execute(
        'INSERT INTO learning_progress (user_id, date, notes_created) VALUES (?, ?, 1)',
        [userId, targetDate]
      );
    }

    res.json({
      success: true,
      message: '노트 생성이 기록되었습니다.'
    });

  } catch (error) {
    console.error('Record note creation error:', error);
    res.status(500).json({
      success: false,
      message: '노트 생성 기록에 실패했습니다.'
    });
  }
};

// 퀴즈 완료 기록
const recordQuizCompletion = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 해당 날짜의 기록이 있는지 확인
    const [existing] = await pool.execute(
      'SELECT progress_id, quizzes_completed FROM learning_progress WHERE user_id = ? AND date = ?',
      [userId, targetDate]
    );

    if (existing.length > 0) {
      // 기존 기록 업데이트
      const newCount = existing[0].quizzes_completed + 1;
      await pool.execute(
        'UPDATE learning_progress SET quizzes_completed = ? WHERE user_id = ? AND date = ?',
        [newCount, userId, targetDate]
      );
    } else {
      // 새로운 기록 생성
      await pool.execute(
        'INSERT INTO learning_progress (user_id, date, quizzes_completed) VALUES (?, ?, 1)',
        [userId, targetDate]
      );
    }

    res.json({
      success: true,
      message: '퀴즈 완료가 기록되었습니다.'
    });

  } catch (error) {
    console.error('Record quiz completion error:', error);
    res.status(500).json({
      success: false,
      message: '퀴즈 완료 기록에 실패했습니다.'
    });
  }
};

// 학습 통계 조회
const getLearningStats = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { period = '30' } = req.query;

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // 전체 통계
    const [totalStats] = await pool.execute(
      `SELECT 
        SUM(study_time_minutes) as total_study_time,
        SUM(notes_created) as total_notes,
        SUM(quizzes_completed) as total_quizzes,
        COUNT(CASE WHEN attendance_checked = TRUE THEN 1 END) as attendance_days
      FROM learning_progress 
      WHERE user_id = ? AND date >= ?`,
      [userId, startDateStr]
    );

    // 일별 학습 시간 (최근 7일)
    const [dailyStudyTime] = await pool.execute(
      `SELECT 
        date,
        study_time_minutes
      FROM learning_progress 
      WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ORDER BY date DESC`,
      [userId]
    );

    // 주별 통계
    const [weeklyStats] = await pool.execute(
      `SELECT 
        YEARWEEK(date) as week,
        SUM(study_time_minutes) as study_time,
        SUM(notes_created) as notes_created,
        SUM(quizzes_completed) as quizzes_completed
      FROM learning_progress 
      WHERE user_id = ? AND date >= ?
      GROUP BY YEARWEEK(date)
      ORDER BY week DESC
      LIMIT 12`,
      [userId, startDateStr]
    );

    // 학습 패턴 분석 (요일별)
    const [weeklyPattern] = await pool.execute(
      `SELECT 
        DAYOFWEEK(date) as day_of_week,
        AVG(study_time_minutes) as avg_study_time,
        AVG(notes_created) as avg_notes,
        AVG(quizzes_completed) as avg_quizzes
      FROM learning_progress 
      WHERE user_id = ? AND date >= ?
      GROUP BY DAYOFWEEK(date)
      ORDER BY day_of_week`,
      [userId, startDateStr]
    );

    // 목표 달성률 (예시: 일일 30분 학습 목표)
    const dailyGoal = 30; // 분
    const [goalAchievement] = await pool.execute(
      `SELECT 
        COUNT(CASE WHEN study_time_minutes >= ? THEN 1 END) as achieved_days,
        COUNT(*) as total_days
      FROM learning_progress 
      WHERE user_id = ? AND date >= ? AND study_time_minutes > 0`,
      [dailyGoal, userId, startDateStr]
    );

    const achievementRate = goalAchievement[0].total_days > 0 ? 
      (goalAchievement[0].achieved_days / goalAchievement[0].total_days) * 100 : 0;

    res.json({
      success: true,
      data: {
        period: days,
        total_stats: {
          total_study_time_minutes: totalStats[0].total_study_time || 0,
          total_notes_created: totalStats[0].total_notes || 0,
          total_quizzes_completed: totalStats[0].total_quizzes || 0,
          attendance_days: totalStats[0].attendance_days || 0
        },
        daily_study_time: dailyStudyTime,
        weekly_stats: weeklyStats,
        weekly_pattern: weeklyPattern,
        goal_achievement: {
          daily_goal_minutes: dailyGoal,
          achieved_days: goalAchievement[0].achieved_days || 0,
          total_days: goalAchievement[0].total_days || 0,
          achievement_rate: Math.round(achievementRate * 100) / 100
        }
      }
    });

  } catch (error) {
    console.error('Get learning stats error:', error);
    res.status(500).json({
      success: false,
      message: '학습 통계를 가져오는데 실패했습니다.'
    });
  }
};

// 오늘의 퀴즈 조회
const getTodayQuiz = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const today = new Date().toISOString().split('T')[0];

    // 오늘의 퀴즈 조회
    const [dailyQuizzes] = await pool.execute(
      `SELECT 
        dq.quiz_id,
        q.title as quiz_title,
        n.title as note_title,
        n.summary as note_summary
      FROM daily_quizzes dq
      INNER JOIN quizzes q ON dq.quiz_id = q.quiz_id
      INNER JOIN notes n ON q.note_id = n.note_id
      WHERE dq.user_id = ? AND dq.date = ?`,
      [userId, today]
    );

    // 랜덤 퀴즈 추천 (오늘의 퀴즈가 없는 경우)
    let recommendedQuiz = null;
    if (dailyQuizzes.length === 0) {
      const [randomQuizzes] = await pool.execute(
        `SELECT 
          q.quiz_id,
          q.title as quiz_title,
          n.title as note_title,
          n.summary as note_summary
        FROM quizzes q
        INNER JOIN notes n ON q.note_id = n.note_id
        WHERE n.user_id = ?
        ORDER BY RAND()
        LIMIT 1`,
        [userId]
      );

      if (randomQuizzes.length > 0) {
        recommendedQuiz = randomQuizzes[0];
      }
    }

    res.json({
      success: true,
      data: {
        daily_quizzes: dailyQuizzes,
        recommended_quiz: recommendedQuiz,
        date: today
      }
    });

  } catch (error) {
    console.error('Get today quiz error:', error);
    res.status(500).json({
      success: false,
      message: '오늘의 퀴즈를 가져오는데 실패했습니다.'
    });
  }
};

// 오늘의 퀴즈 설정
const setTodayQuiz = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { quiz_id, date } = req.body;

    const targetDate = date || new Date().toISOString().split('T')[0];

    // 퀴즈 소유권 확인
    const [quizzes] = await pool.execute(
      `SELECT q.quiz_id 
      FROM quizzes q
      INNER JOIN notes n ON q.note_id = n.note_id
      WHERE q.quiz_id = ? AND n.user_id = ?`,
      [quiz_id, userId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '퀴즈를 찾을 수 없습니다.'
      });
    }

    // 기존 오늘의 퀴즈가 있는지 확인
    const [existing] = await pool.execute(
      'SELECT user_id FROM daily_quizzes WHERE user_id = ? AND date = ?',
      [userId, targetDate]
    );

    if (existing.length > 0) {
      // 기존 퀴즈 업데이트
      await pool.execute(
        'UPDATE daily_quizzes SET quiz_id = ? WHERE user_id = ? AND date = ?',
        [quiz_id, userId, targetDate]
      );
    } else {
      // 새로운 오늘의 퀴즈 생성
      await pool.execute(
        'INSERT INTO daily_quizzes (user_id, date, quiz_id) VALUES (?, ?, ?)',
        [userId, targetDate, quiz_id]
      );
    }

    res.json({
      success: true,
      message: '오늘의 퀴즈가 설정되었습니다.',
      data: {
        quiz_id,
        date: targetDate
      }
    });

  } catch (error) {
    console.error('Set today quiz error:', error);
    res.status(500).json({
      success: false,
      message: '오늘의 퀴즈 설정에 실패했습니다.'
    });
  }
};

module.exports = {
  getLearningProgress,
  checkAttendance,
  recordStudyTime,
  recordNoteCreation,
  recordQuizCompletion,
  getLearningStats,
  getTodayQuiz,
  setTodayQuiz
};
