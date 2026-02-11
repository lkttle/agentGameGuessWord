import type { PinyinQuestion, PinyinQuestionCandidate } from '@/lib/game/pinyin-question-types';

const HANZI_REGEX = /^[\u4e00-\u9fff]+$/;
const INITIAL_REGEX = /^[A-Z]$/;

function isValidAnswer(answer: string): boolean {
  return HANZI_REGEX.test(answer) && answer.length >= 2 && answer.length <= 4;
}

function isValidInitials(initials: string[]): boolean {
  return initials.length > 0 && initials.every((item) => INITIAL_REGEX.test(item));
}

export function normalizeInitials(initials: string[]): string[] {
  return initials.map((item) => item.trim().toUpperCase());
}

export function buildInitialsText(initials: string[]): string {
  return normalizeInitials(initials).join('');
}

export function validateQuestionCandidate(candidate: PinyinQuestionCandidate): string | null {
  if (!candidate.category?.trim()) {
    return 'category is required';
  }

  const answer = candidate.answer?.trim();
  if (!answer || !isValidAnswer(answer)) {
    return 'answer must be 2-4 Chinese characters';
  }

  const initials = normalizeInitials(candidate.initials ?? []);
  if (!isValidInitials(initials)) {
    return 'initials must be uppercase single letters';
  }

  if (initials.length !== answer.length) {
    return 'initials length must match answer length';
  }

  return null;
}

export function toValidatedQuestion(candidate: PinyinQuestionCandidate): PinyinQuestion {
  const answer = candidate.answer.trim();
  const category = candidate.category.trim();
  const initials = normalizeInitials(candidate.initials);

  return {
    answer,
    category,
    initials,
    initialsText: buildInitialsText(initials)
  };
}

