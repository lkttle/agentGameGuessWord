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
  { initials: ['C', 'F'], answer: '吃饭', category: '动作' },
  { initials: ['C', 'F'], answer: '出发', category: '动作' },
  { initials: ['X', 'P'], answer: '洗牌', category: '动作' },
  { initials: ['T', 'B'], answer: '跳绳', category: '动作' },
  { initials: ['L', 'P'], answer: '跑步', category: '动作' },

  { initials: ['X', 'M'], answer: '熊猫', category: '动物' },
  { initials: ['L', 'H'], answer: '老虎', category: '动物' },
  { initials: ['H', 'Z'], answer: '猴子', category: '动物' },
  { initials: ['C', 'J'], answer: '雏鸡', category: '动物' },
  { initials: ['M', 'Y'], answer: '绵羊', category: '动物' },

  { initials: ['P', 'G'], answer: '苹果', category: '水果' },
  { initials: ['X', 'J'], answer: '香蕉', category: '水果' },
  { initials: ['C', 'Z'], answer: '橙子', category: '水果' },
  { initials: ['P', 'T'], answer: '葡萄', category: '水果' },
  { initials: ['X', 'G'], answer: '西瓜', category: '水果' },

  { initials: ['Y', 'M', 'R'], answer: '玉米粥', category: '食物' },
  { initials: ['H', 'S', 'B'], answer: '红烧肉', category: '食物' },
  { initials: ['D', 'J', 'T'], answer: '蛋挞店', category: '地点' },
  { initials: ['D', 'N', 'G'], answer: '电脑馆', category: '地点' },
  { initials: ['X', 'L', 'Y'], answer: '向日葵', category: '植物' },

  { initials: ['Y', 'X', 'Y', 'Y'], answer: '一心一意', category: '情感' },
  { initials: ['S', 'H', 'W', 'J'], answer: '四海为家', category: '成语' },
  { initials: ['F', 'H', 'R', 'L'], answer: '风和日丽', category: '天气' },
  { initials: ['H', 'T', 'X', 'D'], answer: '欢天喜地', category: '情感' },
  { initials: ['W', 'M', 'Z', 'K'], answer: '望梅止渴', category: '成语' }
];

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

export function getPinyinQuestionCandidates(): PinyinQuestionCandidate[] {
  return QUESTION_BANK;
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

  return shuffle(filteredCandidates)
    .slice(0, Math.min(count, filteredCandidates.length))
    .map((candidate) => toValidatedQuestion(candidate));
}
