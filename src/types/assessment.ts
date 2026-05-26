/**
 * Assessment Type Enum
 * Used to distinguish between exams and CBT tests
 * Frontend can use this to switch between different assessment modes
 */
export enum AssessmentType {
  EXAM = 'exam',
  TEST = 'test',
}

export type AssessmentTypeValue = 'exam' | 'test';
