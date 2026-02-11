export const SUPPORTED_PINYIN_WORD_LENGTHS = [2, 3, 4] as const;

export type PinyinWordLength = (typeof SUPPORTED_PINYIN_WORD_LENGTHS)[number];

export interface PinyinQuestion {
  initials: string[];
  initialsText: string;
  answer: string;
  category: string;
}

export interface PinyinQuestionCandidate {
  initials: string[];
  answer: string;
  category: string;
}

export interface GeneratePinyinQuestionOptions {
  length?: PinyinWordLength;
  category?: string;
  count?: number;
}

