/**
 * Utility functions to parse exam timetable data from various formats
 */

export interface TimetableEntry {
  courseCode: string;
  courseTitle?: string;
  day: string;
  date: Date;
  startTime: string;
  endTime: string;
  venue?: string;         
  batches?: string[];
  faculty?: string;
  level?: string;
  courseOfStudy?: string;
  semester: string;
  academicYear: string;
  studentCount?: number;
}
/**
 * Parse time string (e.g., "11am-12pm", "1-2.00pm") to start and end time
 */
export const parseTimeSlot = (timeSlot: string): { startTime: string; endTime: string } => {
  // Normalize the time slot string
  const normalized = timeSlot.trim().replace(/\s+/g, '');
  
  // Handle different formats like "11am-12pm", "11:00am-12:00pm", "1-2:00pm"
  const timeRegex = /(\d{1,2}):?(\d{2})?(am|pm)?-?(\d{1,2}):?(\d{2})?(am|pm)?/i;
  
  // If it has both am/pm, use them directly
  if (normalized.includes('-')) {
    const parts = normalized.split('-');
    let startTime = parts[0];
    let endTime = parts[1];
    
    // Handle implicit am/pm (if second part has am/pm but first doesn't)
    if (!startTime.match(/am|pm/i) && endTime.match(/am|pm/i)) {
      const endPeriod = endTime.match(/am|pm/i)?.[0]?.toLowerCase() || 'am';
      // If end is pm and start hour is less than 12, it's likely am
      if (endPeriod === 'pm' && parseInt(startTime) < 12) {
        startTime += 'am';
      } else {
        startTime += endPeriod;
      }
    }
    
    // Ensure both have am/pm
    if (!startTime.match(/am|pm/i)) startTime += 'am';
    if (!endTime.match(/am|pm/i)) endTime += 'am';
    
    return { startTime, endTime };
  }
  
  // Fallback for edge cases
  return { startTime: normalized, endTime: normalized };
};

/**
 * Parse date string (e.g., "Monday, 20th April, 2026") to Date object
 */
export const parseDate = (dateString: string, year?: number): Date => {
  try {
    // Handle formats like "Monday, 20th April, 2026" or "20th April, 2026"
    const dateRegex = /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s*(\d{4})?/;
    const match = dateString.match(dateRegex);
    
    if (match) {
      const day = parseInt(match[1]);
      const month = match[2];
      const yearFromString = match[3] ? parseInt(match[3]) : year || new Date().getFullYear();
      
      const date = new Date(`${month} ${day}, ${yearFromString}`);
      return date;
    }
    
    return new Date();
  } catch (error) {
    return new Date();
  }
};

/**
 * Parse batch string to extract faculties/course types
 * Example: "*EDUCATION *ARTS *SOCIAL SCI." -> ["EDUCATION", "ARTS", "SOCIAL SCI"]
 */
export const parseBatches = (batchString: string): string[] => {
  if (!batchString) return [];
  
  return batchString
    .split('*')
    .map(b => b.trim())
    .filter(b => b.length > 0);
};

/**
 * Parse course code with student count
 * Example: "GNS312(10256)" -> { code: "GNS312", studentCount: 10256 }
 * Normalizes the code (uppercase, no spaces)
 */
export const parseCourseCode = (courseString: string): { code: string; studentCount?: number } => {
  const regex = /([A-Z0-9-]+)\s*\((\d+)\)?/;
  const match = courseString.trim().match(regex);
  
  if (match) {
    return {
      code: match[1].toUpperCase().replace(/\s+/g, ''), // Normalize
      studentCount: parseInt(match[2]),
    };
  }
  
  return { code: courseString.trim().toUpperCase().replace(/\s+/g, '') }; // Normalize
};

/**
 * Convert timetable entry to exam creation request format
 * Only includes essential fields for students to see
 */
export const convertToExamData = (entry: TimetableEntry, defaults: any = {}) => {
  return {
    courseCode: entry.courseCode,
    courseTitle: entry.courseTitle || entry.courseCode,
    examType: defaults.examType || 'cbt',
    scheduleDate: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
   venue: entry.venue || defaults.venue || 'CBT CENTRE',
    semester: entry.semester,
    academicYear: entry.academicYear,
    // Optional fields (not displayed to students)
    title: `${entry.courseCode} Exam`,
    duration: defaults.duration || undefined,
    totalMarks: defaults.totalMarks || undefined,
    faculty: entry.faculty || defaults.faculty || undefined,
    level: entry.level || defaults.level || undefined,
    courseOfStudy: entry.courseOfStudy || defaults.courseOfStudy || undefined,
    invigilators: defaults.invigilators || [],
    students: [],
    instructions: undefined,
  };
};

/**
 * Detect if timetable data is flat array format (direct exams) or nested format (days → slots → courses)
 */
export const isFlatFormat = (data: any[]): boolean => {
  if (!Array.isArray(data) || data.length === 0) return false;
  
  const firstItem = data[0];
  // Flat format has courseCode, title, or similar exam properties at top level
  // Nested format has 'day' or 'slots' at top level
  return !firstItem.day && !firstItem.slots && (firstItem.courseCode || firstItem.title);
};

/**
 * Convert flat exam array to nested timetable format
 * Input: [{ title: "ARTS", courseCode: "GNS312/GNS114 (10256) BATCH 1: EDUCATION", ... }, ...]
 * Output: [{ day: "...", slots: [{ time: "...", courses: [...] }] }, ...]
 */
export const flatToNestedFormat = (flatData: any[]): any[] => {
  const grouped: { [key: string]: { [key: string]: any[] } } = {};
  
  for (const exam of flatData) {
    // Extract date and time from exam
    const day = exam.day || exam.date || 'Unknown Day';
    const time = exam.time || exam.startTime || '9am-5pm';
    
    // Initialize day if not exists
    if (!grouped[day]) {
      grouped[day] = {};
    }
    
    // Initialize time slot if not exists
    if (!grouped[day][time]) {
      grouped[day][time] = [];
    }
    
    // Extract course code (handle formats like "GNS312(10256)" or "GNS312/GNS114 (10256)")
    const courseCode = exam.courseCode || exam.code || '';
    const { code } = parseCourseCode(courseCode);
    
    // Extract batches if available
    const batches = exam.batches || exam.courseOfStudy || '';
    
    grouped[day][time].push({
      code: code,
      batches: batches,
      title: exam.courseTitle || exam.title || code,
    });
  }
  
  // Convert grouped object to nested array format
  const nested = [];
  for (const day in grouped) {
    const slots = [];
    for (const time in grouped[day]) {
      slots.push({
        time: time,
        courses: grouped[day][time],
      });
    }
    nested.push({
      day: day,
      slots: slots,
    });
  }
  
  return nested;
};

/**
 * Parse JSON timetable format (handles both flat and nested formats)
 * 
 * Nested format:
 * [
 *   { day: "Monday, 20th April, 2026", slots: [
 *       { time: "11am-12pm", courses: [{ code: "GNS312(10256)", batches: "*EDUCATION *ARTS" }] }
 *     ]
 *   }
 * ]
 * 
 * Flat format (also supported):
 * [
 *   { title: "ARTS", courseCode: "GNS312(10256)", day: "Monday, 20th April, 2026", time: "11am-12pm", ... },
 *   ...
 * ]
 */
export const parseJsonTimetable = (timetableData: any[], semester: string, academicYear: string): TimetableEntry[] => {
  const entries: TimetableEntry[] = [];
  
  // Auto-detect and convert flat format to nested if needed
  let dataToProcess = timetableData;
  if (isFlatFormat(timetableData)) {
    dataToProcess = flatToNestedFormat(timetableData);
  }
  
  for (const day of dataToProcess) {
    const date = parseDate(day.day, parseInt(academicYear));
    
    if (day.slots && Array.isArray(day.slots)) {
      for (const slot of day.slots) {
        const { startTime, endTime } = parseTimeSlot(slot.time || '');
        
        if (slot.courses && Array.isArray(slot.courses)) {
          for (const course of slot.courses) {
            const { code, studentCount } = parseCourseCode(course.code || course);
            const batches = course.batches ? parseBatches(course.batches) : [];
            
            entries.push({
              courseCode: code,
              day: day.day,
              date,
              startTime,
              endTime,
              batches,
              semester,
              academicYear,
              studentCount,
              courseTitle: course.title,
            });
          }
        }
      }
    }
  }
  
  return entries;
};

/**
 * Parse CSV timetable format
 * Expected columns: courseCode,day,date,startTime,endTime,batches,faculty,level,courseOfStudy,studentCount
 */
export const parseCsvTimetable = (csvData: string, semester: string, academicYear: string): TimetableEntry[] => {
  const entries: TimetableEntry[] = [];
  const lines = csvData.trim().split('\n');
  
  if (lines.length < 2) return entries;
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (doesn't handle quoted values with commas)
    const parts = line.split(',').map(p => p.trim());
    
    if (parts.length >= 5) {
      const courseCode = parts[0];
      const day = parts[1];
      const date = parseDate(parts[2] || day, parseInt(academicYear));
      const timeSlot = parts[3];
      const { startTime, endTime } = parseTimeSlot(timeSlot);
      const batches = parts[5] ? parseBatches(parts[5]) : [];
      
      entries.push({
        courseCode,
        day,
        date,
        startTime,
        endTime,
        batches,
        faculty: parts[6] || undefined,
        level: parts[7] || undefined,
        courseOfStudy: parts[8] || undefined,
        semester,
        academicYear,
        studentCount: parts[9] ? parseInt(parts[9]) : undefined,
      });
    }
  }
  
  return entries;
};

/**
 * Parse tabular CSV format (horizontal layout: days as rows, time slots as columns)
 * 
 * Expected format from University of Ilorin timetables:
 * Day,Date,11am-12:00pm,12-1:00pm,1-2:00pm,2-3:00pm,3-4:00pm,4-5:00pm
 * Monday DAY 1,20th April 2026,"GNS312/GNS114 (10256) BATCH 1: EDUCATION, ARTS","PHY102 (5112) | ...",..
 * 
 * Cells can contain:
 * - Single course: "GNS312/GNS114 (10256) BATCH 1: EDUCATION"
 * - Multiple courses separated by pipe: "PHY102 (5112) | AGY310 (529) | ABE376 (900)"
 * - Batches: "BATCH 1: EDUCATION, ARTS, SOCIAL SCI."
 */
/**
 * Parse course entry in format: "PES308 {LR8}" or "EDU212-EDLT"
 * Extracts course code and venue from curly braces
 */
const parseCourseWithVenue = (entry: string): { code: string; venue?: string } => {
  const trimmed = entry.trim();
  if (!trimmed) return { code: '' };

  // Extract venue from curly braces e.g. {LR8}
  const venueMatch = trimmed.match(/\{([^}]+)\}/);
  const venue = venueMatch ? venueMatch[1].trim() : undefined;

  // Extract course code — everything before the curly brace or end of string
  const codePart = trimmed.replace(/\{[^}]*\}/, '').trim();

  // Validate it looks like a course code e.g. PES308, EDU212-EDLT, EMA104
  const codeMatch = codePart.match(/^([A-Z]{2,5}\d{2,3}[A-Z0-9-]*)/i);
  if (!codeMatch) return { code: '' };

  const code = codeMatch[1].toUpperCase().trim();
  return { code, venue };
};

/**
 * Parse your actual timetable CSV format:
 * Each row = one time slot
 * Each cell = pipe-separated course codes with venues in {}
 * 
 * Format:
 * col1: "EDU212-EDLT | PES308 {LR8} | BED108 {LR5} ..."
 * col2: "PES102 {APLR} | SSE314 {NELH} ..."
 * col3: date (2026-05-25)
 * col4: time (21:00 - 02:00)
 * col5: venue fallback (CBT CENTRE)
 */
export const parseTabularCsv = (
  csvData: string,
  semester: string,
  academicYear: string
): TimetableEntry[] => {
  const entries: TimetableEntry[] = [];
  const lines = csvData.trim().split('\n');

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCsvLine(line);
    if (parts.length < 4) continue;

    // Last 3 cols are always: date, time, venue
    const dateStr   = parts[parts.length - 3];
    const timeStr   = parts[parts.length - 2];
    const venueDefault = parts[parts.length - 1];

    const date = parseDate(dateStr, parseInt(academicYear));
    const { startTime, endTime } = parseTimeSlot(timeStr);

    // All columns before the last 3 contain course groups
    const courseCols = parts.slice(0, parts.length - 3);

    for (const col of courseCols) {
      if (!col.trim()) continue;

      // Split by pipe to get individual course entries
      const courseEntries = col.split('|').map(c => c.trim()).filter(Boolean);

      for (const entry of courseEntries) {
        const { code, venue } = parseCourseWithVenue(entry);
        if (!code) continue;

        entries.push({
          courseCode: code,
          courseTitle: code,
          day: dateStr,
          date,
          startTime,
          endTime,
          venue: venue || venueDefault,  // use specific venue or fallback
          batches: [],
          semester,
          academicYear,
        });
      }
    }
  }

  return entries;
};
/**
 * Parse a CSV line respecting quoted values
 * Handles: "value with, commas", unquoted, etc.
 */
const parseCsvLine = (line: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  parts.push(current.trim().replace(/^"|"$/g, ''));
  return parts;
};

/**
 * Parse course cell content to extract code, title, and batch info
 * Handles formats like:
 * - "GNS312/GNS114 (10256) BATCH 1: EDUCATION, ARTS, SOCIAL SCI."
 * - "PHY102 (5112)"
 * - "MTH102 (6662) BATCH 1: EDUCATION, ENGR, PHARM, LIFE SCI"
 * Normalizes the course code (uppercase, no spaces)
 */
const parseCourseCellContent = (content: string): { code: string; batches?: string; title?: string } => {
  // Extract course code with student count
  const codeMatch = content.match(/([A-Z0-9-/]+)\s*\((\d+)\)/);
  if (!codeMatch) {
    return { code: '', batches: undefined };
  }

  let code = codeMatch[1];
  const studentCount = codeMatch[2];
  
  // Normalize code: remove spaces, uppercase
  code = code.toUpperCase().replace(/\s+/g, '');
  
  // Extract batch information
  let batches = '';
  const batchMatch = content.match(/BATCH\s+\d+:\s*([^,]*)/);
  if (batchMatch) {
    batches = batchMatch[1].trim();
  }
  
  return {
    code,
    batches: batches || undefined,
    title: `${code} (${studentCount})`,
  };
};
