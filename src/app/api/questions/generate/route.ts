import { NextResponse } from 'next/server';
import {
  generatePinyinQuestions
} from '@/lib/game/pinyin-question-bank';
import {
  SUPPORTED_PINYIN_WORD_LENGTHS,
  type GeneratePinyinQuestionOptions,
  type PinyinWordLength
} from '@/lib/game/pinyin-question-types';

interface GenerateQuestionRequestBody {
  length?: number;
  category?: string;
  count?: number;
}

function parseOptionalLength(value: unknown): PinyinWordLength | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const length = Number(value);
  if (!Number.isInteger(length) || !SUPPORTED_PINYIN_WORD_LENGTHS.includes(length as PinyinWordLength)) {
    throw new Error('length must be one of 2, 3, 4');
  }

  return length as PinyinWordLength;
}

function parseOptionalCategory(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const category = String(value).trim();
  if (!category) {
    throw new Error('category must be a non-empty string');
  }

  return category;
}

function parseOptionalCount(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('count must be an integer between 1 and 20');
  }

  return count;
}

function parseOptions(body: GenerateQuestionRequestBody): GeneratePinyinQuestionOptions {
  return {
    length: parseOptionalLength(body.length),
    category: parseOptionalCategory(body.category),
    count: parseOptionalCount(body.count)
  };
}

export async function POST(request: Request): Promise<Response> {
  let body: GenerateQuestionRequestBody;

  try {
    body = (await request.json()) as GenerateQuestionRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let options: GeneratePinyinQuestionOptions;
  try {
    options = parseOptions(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid request params' },
      { status: 400 }
    );
  }

  const questions = generatePinyinQuestions(options);
  if (questions.length === 0) {
    return NextResponse.json(
      {
        error: 'No eligible questions can be generated with current filters',
        filters: options
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ questions });
}
