import type {
  GeneratePinyinQuestionOptions,
  PinyinQuestion,
  PinyinQuestionCandidate
} from '@/lib/game/pinyin-question-types';
import {
  toValidatedQuestion,
  validateQuestionCandidate
} from '@/lib/game/pinyin-question-validator';

const QUESTION_BANK: PinyinQuestionCandidate[] = [
  // 2字题（60题）
  { initials: ['C', 'F'], answer: '吃饭', category: '动作' },
  { initials: ['S', 'J'], answer: '睡觉', category: '动作' },
  { initials: ['Z', 'L'], answer: '走路', category: '动作' },
  { initials: ['P', 'B'], answer: '跑步', category: '动作' },
  { initials: ['S', 'B'], answer: '上班', category: '动作' },
  { initials: ['X', 'B'], answer: '下班', category: '动作' },
  { initials: ['X', 'Z'], answer: '洗澡', category: '动作' },
  { initials: ['S', 'Y'], answer: '刷牙', category: '动作' },
  { initials: ['X', 'Z'], answer: '写字', category: '动作' },
  { initials: ['C', 'G'], answer: '唱歌', category: '动作' },
  { initials: ['T', 'W'], answer: '跳舞', category: '动作' },
  { initials: ['D', 'Q'], answer: '打球', category: '动作' },
  { initials: ['K', 'S'], answer: '看书', category: '动作' },
  { initials: ['Y', 'Y'], answer: '游泳', category: '动作' },
  { initials: ['G', 'J'], answer: '逛街', category: '动作' },
  { initials: ['K', 'H'], answer: '开会', category: '动作' },
  { initials: ['L', 'T'], answer: '聊天', category: '动作' },
  { initials: ['Z', 'F'], answer: '做饭', category: '动作' },

  { initials: ['D', 'S'], answer: '电视', category: '生活用品' },
  { initials: ['B', 'X'], answer: '冰箱', category: '生活用品' },
  { initials: ['K', 'T'], answer: '空调', category: '生活用品' },
  { initials: ['S', 'J'], answer: '手机', category: '生活用品' },
  { initials: ['D', 'N'], answer: '电脑', category: '生活用品' },
  { initials: ['J', 'P'], answer: '键盘', category: '生活用品' },
  { initials: ['S', 'B'], answer: '鼠标', category: '生活用品' },
  { initials: ['S', 'B'], answer: '书包', category: '生活用品' },
  { initials: ['Q', 'B'], answer: '铅笔', category: '学习用品' },
  { initials: ['Z', 'J'], answer: '纸巾', category: '生活用品' },
  { initials: ['M', 'J'], answer: '毛巾', category: '生活用品' },
  { initials: ['Y', 'S'], answer: '牙刷', category: '生活用品' },
  { initials: ['S', 'B'], answer: '水杯', category: '生活用品' },
  { initials: ['Y', 'S'], answer: '雨伞', category: '生活用品' },
  { initials: ['S', 'F'], answer: '沙发', category: '家居' },
  { initials: ['C', 'L'], answer: '窗帘', category: '家居' },
  { initials: ['Z', 'Z'], answer: '桌子', category: '家居' },
  { initials: ['Y', 'Z'], answer: '椅子', category: '家居' },
  { initials: ['C', 'D'], answer: '床单', category: '家居' },
  { initials: ['Z', 'T'], answer: '枕头', category: '家居' },
  { initials: ['B', 'Z'], answer: '被子', category: '家居' },

  { initials: ['H', 'C'], answer: '火车', category: '交通工具' },
  { initials: ['F', 'J'], answer: '飞机', category: '交通工具' },
  { initials: ['D', 'T'], answer: '地铁', category: '交通工具' },
  { initials: ['G', 'J'], answer: '公交', category: '交通工具' },
  { initials: ['C', 'Z'], answer: '出租', category: '交通工具' },
  { initials: ['D', 'C'], answer: '单车', category: '交通工具' },
  { initials: ['L', 'C'], answer: '轮船', category: '交通工具' },

  { initials: ['P', 'G'], answer: '苹果', category: '水果' },
  { initials: ['X', 'J'], answer: '香蕉', category: '水果' },
  { initials: ['X', 'G'], answer: '西瓜', category: '水果' },
  { initials: ['C', 'M'], answer: '草莓', category: '水果' },
  { initials: ['C', 'Z'], answer: '橙子', category: '水果' },
  { initials: ['P', 'T'], answer: '葡萄', category: '水果' },

  { initials: ['B', 'J'], answer: '北京', category: '地名' },
  { initials: ['S', 'H'], answer: '上海', category: '地名' },
  { initials: ['G', 'Z'], answer: '广州', category: '地名' },
  { initials: ['S', 'Z'], answer: '深圳', category: '地名' },
  { initials: ['C', 'D'], answer: '成都', category: '地名' },
  { initials: ['H', 'Z'], answer: '杭州', category: '地名' },
  { initials: ['N', 'J'], answer: '南京', category: '地名' },
  { initials: ['W', 'H'], answer: '武汉', category: '地名' },

  // 3字题（25题）
  { initials: ['H', 'S', 'R'], answer: '红烧肉', category: '食物' },
  { initials: ['X', 'H', 'S'], answer: '西红柿', category: '食物' },
  { initials: ['D', 'C', 'F'], answer: '蛋炒饭', category: '食物' },
  { initials: ['B', 'Q', 'L'], answer: '冰淇淋', category: '食物' },
  { initials: ['X', 'L', 'B'], answer: '小笼包', category: '食物' },
  { initials: ['N', 'R', 'M'], answer: '牛肉面', category: '食物' },
  { initials: ['M', 'L', 'T'], answer: '麻辣烫', category: '食物' },

  { initials: ['D', 'F', 'G'], answer: '电饭锅', category: '生活用品' },
  { initials: ['X', 'Y', 'J'], answer: '洗衣机', category: '生活用品' },
  { initials: ['D', 'F', 'S'], answer: '电风扇', category: '生活用品' },
  { initials: ['D', 'Y', 'J'], answer: '打印机', category: '办公用品' },
  { initials: ['C', 'D', 'Q'], answer: '充电器', category: '生活用品' },
  { initials: ['R', 'S', 'Q'], answer: '热水器', category: '生活用品' },
  { initials: ['C', 'F', 'J'], answer: '吹风机', category: '生活用品' },
  { initials: ['D', 'S', 'J'], answer: '电视机', category: '生活用品' },

  { initials: ['T', 'A', 'M'], answer: '天安门', category: '地名' },
  { initials: ['H', 'P', 'J'], answer: '黄浦江', category: '地名' },
  { initials: ['Y', 'H', 'Y'], answer: '颐和园', category: '地名' },
  { initials: ['Z', 'J', 'C'], answer: '紫禁城', category: '地名' },

  { initials: ['Y', 'E', 'Y'], answer: '幼儿园', category: '场所' },
  { initials: ['T', 'S', 'G'], answer: '图书馆', category: '场所' },
  { initials: ['T', 'Y', 'G'], answer: '体育馆', category: '场所' },
  { initials: ['D', 'W', 'Y'], answer: '动物园', category: '场所' },
  { initials: ['Y', 'L', 'C'], answer: '游乐场', category: '场所' },
  { initials: ['B', 'W', 'G'], answer: '博物馆', category: '场所' },

  // 4字题（15题）
  { initials: ['C', 'X', 'Q', 'D'], answer: '春夏秋冬', category: '常见词' },
  { initials: ['D', 'N', 'X', 'B'], answer: '东南西北', category: '常见词' },
  { initials: ['F', 'H', 'R', 'L'], answer: '风和日丽', category: '天气' },
  { initials: ['H', 'T', 'X', 'D'], answer: '欢天喜地', category: '情感' },
  { initials: ['W', 'M', 'Z', 'K'], answer: '望梅止渴', category: '成语' },
  { initials: ['Y', 'X', 'Y', 'Y'], answer: '一心一意', category: '成语' },
  { initials: ['R', 'S', 'R', 'H'], answer: '人山人海', category: '常见词' },
  { initials: ['W', 'Y', 'L', 'S'], answer: '五颜六色', category: '常见词' },
  { initials: ['Z', 'X', 'C', 'D'], answer: '自行车道', category: '交通' },
  { initials: ['G', 'G', 'Q', 'C'], answer: '公共汽车', category: '交通' },
  { initials: ['D', 'S', 'J', 'M'], answer: '电视节目', category: '媒体' },
  { initials: ['S', 'J', 'H', 'M'], answer: '手机号码', category: '生活用品' },
  { initials: ['H', 'G', 'D', 'L'], answer: '火锅底料', category: '食物' },
  { initials: ['L', 'Q', 'B', 'S'], answer: '篮球比赛', category: '体育' },
  { initials: ['B', 'J', 'D', 'X'], answer: '北京大学', category: '学校' }
];

const RECENT_QUESTION_WINDOW = 20;
const recentQuestionKeys: string[] = [];

function clampCount(count: number | undefined): number {
  if (!Number.isFinite(count)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(count ?? 1), 1), 20);
}

function normalizeCategory(category?: string): string | undefined {
  const normalized = category?.trim();
  return normalized ? normalized : undefined;
}

function shuffle<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[nextIndex]] = [cloned[nextIndex], cloned[index]];
  }
  return cloned;
}

function pushRecentQuestionKeys(keys: string[]): void {
  if (keys.length === 0) return;
  recentQuestionKeys.push(...keys);
  if (recentQuestionKeys.length > RECENT_QUESTION_WINDOW) {
    recentQuestionKeys.splice(0, recentQuestionKeys.length - RECENT_QUESTION_WINDOW);
  }
}

export function buildPinyinQuestionKey(question: Pick<PinyinQuestion, 'initialsText' | 'answer' | 'category'>): string {
  return `${question.initialsText.trim().toUpperCase()}|${question.answer.trim()}|${question.category.trim()}`;
}

export function parsePinyinQuestionKey(questionKey?: string | null): PinyinQuestion | null {
  const normalized = questionKey?.trim();
  if (!normalized) {
    return null;
  }

  const [initialsTextRaw, answerRaw, categoryRaw = ''] = normalized.split('|');
  const initialsText = initialsTextRaw?.trim().toUpperCase();
  const answer = answerRaw?.trim();
  const category = categoryRaw.trim();

  if (!initialsText || !answer) {
    return null;
  }

  const initials = initialsText.split('');
  const candidate: PinyinQuestionCandidate = {
    initials,
    answer,
    category: category || '未知分类'
  };

  if (validateQuestionCandidate(candidate) !== null) {
    return null;
  }

  return toValidatedQuestion(candidate);
}

export function getPinyinQuestionCandidates(): PinyinQuestionCandidate[] {
  return QUESTION_BANK;
}

export function getAllPinyinQuestions(): PinyinQuestion[] {
  return QUESTION_BANK
    .filter((candidate) => validateQuestionCandidate(candidate) === null)
    .map((candidate) => toValidatedQuestion(candidate));
}

export function findPinyinQuestionByAnswer(answer: string): PinyinQuestion | null {
  const normalizedAnswer = answer.trim();
  if (!normalizedAnswer) return null;

  const candidate = QUESTION_BANK.find((item) => item.answer.trim() === normalizedAnswer);
  if (!candidate || validateQuestionCandidate(candidate) !== null) {
    return null;
  }
  return toValidatedQuestion(candidate);
}

export function generatePinyinQuestions(options: GeneratePinyinQuestionOptions = {}): PinyinQuestion[] {
  const normalizedCategory = normalizeCategory(options.category);
  const count = clampCount(options.count);

  const filteredCandidates = getPinyinQuestionCandidates().filter((candidate) => {
    if (options.length && candidate.answer.length !== options.length) {
      return false;
    }
    if (normalizedCategory && candidate.category !== normalizedCategory) {
      return false;
    }

    return validateQuestionCandidate(candidate) === null;
  });

  if (filteredCandidates.length === 0) {
    return [];
  }

  const shuffledCandidates = shuffle(filteredCandidates);
  const shuffledQuestions = shuffledCandidates.map((candidate) => toValidatedQuestion(candidate));
  const recentSet = new Set(recentQuestionKeys);

  const nonRecentQuestions = shuffledQuestions.filter((question) => !recentSet.has(buildPinyinQuestionKey(question)));
  const sourceQuestions = nonRecentQuestions.length >= count ? nonRecentQuestions : shuffledQuestions;

  const selectedQuestions = sourceQuestions.slice(0, Math.min(count, sourceQuestions.length));
  pushRecentQuestionKeys(selectedQuestions.map((question) => buildPinyinQuestionKey(question)));

  return selectedQuestions;
}
