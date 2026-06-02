/**
 * Exam Helper Utilities
 * Handles course code normalization and exam data formatting
 */

import { IExam } from '../models/Exam.model';

/**
 * Normalize course code - convert to uppercase and remove spaces
 * Example: "EDT 401" or "edt 401" or "EDT401" → "EDT401"
 */
export const normalizeCourseCode = (courseCode: string): string => {
  return courseCode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ''); // Remove all whitespace
};

/**
 * Check if two course codes are equivalent (both normalized)
 */
export const areCourseCodesEqual = (code1: string, code2: string): boolean => {
  return normalizeCourseCode(code1) === normalizeCourseCode(code2);
};

/**
 * Format exam data for student view - only essential fields
 * Fields: courseCode, courseTitle, location, examType, startTime, endTime, date
 */
export const formatExamForStudent = (exam: IExam) => {
  const date = new Date(exam.scheduleDate);
  
  return {
    _id: exam._id,
    courseCode: exam.courseCode,
    courseTitle: exam.courseTitle,
    location: exam.venue,
    examType: exam.examType, // 'cbt' or 'written'
    startTime: exam.startTime,
    endTime: exam.endTime,
    date: date.toISOString().split('T')[0], // YYYY-MM-DD format
    dateTime: date.toLocaleString(), // Full date time string
    semester: exam.semester,
    academicYear: exam.academicYear,
    status: exam.status,
    invigilators: Array.isArray(exam.invigilators) ? exam.invigilators : [],
  };
};

/**
 * Format exam data for exam officer view - all fields
 */
export const formatExamForOfficer = (exam: IExam) => {
  return {
    ...exam.toObject(),
  };
};

/**
 * Get displayable exam data based on user role
 */
export const formatExamResponse = (exam: IExam, userRole?: string) => {
  if (userRole === 'student') {
    return formatExamForStudent(exam);
  }
  return formatExamForOfficer(exam);
};

/**
 * Deduplicate exams by course code
 * Keeps the first occurrence of each normalized course code
 */
export const deduplicateExamsByCode = (
  exams: IExam[],
  options?: { keepLatest?: boolean }
): IExam[] => {
  const seen = new Map<string, IExam>();
  
  for (const exam of exams) {
    const normalized = normalizeCourseCode(exam.courseCode);
    
    if (!seen.has(normalized)) {
      seen.set(normalized, exam);
    } else if (options?.keepLatest) {
      // Replace with later date/time if keeping latest
      const existing = seen.get(normalized)!;
      if (exam.scheduleDate > existing.scheduleDate) {
        seen.set(normalized, exam);
      }
    }
  }
  
  return Array.from(seen.values());
};
