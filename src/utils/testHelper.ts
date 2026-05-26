/**
 * Test Helper Utilities
 * Handles course code normalization and test data formatting
 * (CBT Tests)
 */

import { ITest } from '../models/Test.model';

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
 * Format test data for student view - only essential fields
 * Fields: courseCode, courseTitle, location, testType, startTime, endTime, date
 */
export const formatTestForStudent = (test: ITest) => {
  const date = new Date(test.scheduleDate);
  
  return {
    _id: test._id,
    courseCode: test.courseCode,
    courseTitle: test.courseTitle,
    location: test.venue,
    testType: test.testType, // 'cbt' or 'written'
    startTime: test.startTime,
    endTime: test.endTime,
    date: date.toISOString().split('T')[0], // YYYY-MM-DD format
    dateTime: date.toLocaleString(), // Full date time string
    semester: test.semester,
    academicYear: test.academicYear,
    status: test.status,
  };
};

/**
 * Format test data for exam officer view - all fields
 */
export const formatTestForOfficer = (test: ITest) => {
  return {
    ...test.toObject(),
  };
};

/**
 * Get displayable test data based on user role
 */
export const formatTestResponse = (test: ITest, userRole?: string) => {
  if (userRole === 'student') {
    return formatTestForStudent(test);
  }
  return formatTestForOfficer(test);
};

/**
 * Deduplicate tests by course code
 * Keeps the first occurrence of each normalized course code
 */
export const deduplicateTestsByCode = (
  tests: ITest[],
  options?: { keepLatest?: boolean }
): ITest[] => {
  const seen = new Map<string, ITest>();
  
  for (const test of tests) {
    const normalized = normalizeCourseCode(test.courseCode);
    
    if (!seen.has(normalized)) {
      seen.set(normalized, test);
    } else if (options?.keepLatest) {
      // Replace with later date/time if keeping latest
      const existing = seen.get(normalized)!;
      if (test.scheduleDate > existing.scheduleDate) {
        seen.set(normalized, test);
      }
    }
  }
  
  return Array.from(seen.values());
};
