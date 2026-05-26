/**
 * EXAM BULK IMPORT EXAMPLES
 * Updated to focus on course codes as standalone exams
 */

// ============================================================
// Example 1: JSON Bulk Import (Nested Format)
// ============================================================
const bulkImportNestedJSON = {
  timetableData: [
    {
      day: "Monday, 20th April, 2026",
      slots: [
        {
          time: "9am-10am",
          courses: [
            { code: "EDT401(2321)", batches: "*EDUCATION" },
            { code: "CSI411(1200)", batches: "*CIS" },
          ],
        },
        {
          time: "10am-11am",
          courses: [
            { code: "PHY102(5112)", batches: "*PHYSICAL SCIENCES" },
          ],
        },
      ],
    },
    {
      day: "Tuesday, 21st April, 2026",
      slots: [
        {
          time: "9am-10am",
          courses: [
            { code: "ACC204(900)" },
            { code: "BIO201(1200)", batches: "*BMS" },
          ],
        },
      ],
    },
  ],
  semester: "First",
  academicYear: "2025/2026",
  defaults: {
    examType: "cbt",
    venue: "CBT CENTRE",
  },
};

// RESULT: 4 exams created (EDT401, CSI411, PHY102, ACC204, BIO201)
// One exam per unique course code regardless of duplicates

// ============================================================
// Example 2: JSON Bulk Import (Flat Format)
// ============================================================
const bulkImportFlatJSON = {
  timetableData: [
    {
      courseCode: "EDT401",
      courseTitle: "Educational Technology",
      day: "Monday, 20th April, 2026",
      time: "9am-10am",
      venue: "CBT CENTRE",
    },
    {
      courseCode: "edt 401", // Different format, same course!
      courseTitle: "Educational Technology",
      day: "Tuesday, 21st April, 2026", // Different day
      time: "10am-11am",
      venue: "CBT CENTRE",
    },
    {
      courseCode: "CSI411",
      courseTitle: "Cyber Security",
      day: "Monday, 20th April, 2026",
      time: "10am-11am",
      venue: "CBT CENTRE",
    },
  ],
  semester: "First",
  academicYear: "2025/2026",
  defaults: {
    examType: "cbt",
  },
};

// RESULT: 2 exams created (EDT401, CSI411)
// EDT401 appears twice but only one is imported (first occurrence wins)
// Both "EDT401" and "edt 401" are normalized to the same code

// ============================================================
// Example 3: CSV Bulk Import (Tabular Format)
// ============================================================
const csvTabularData = `Day,Date,9am-10am,10am-11am,11am-12pm,12-1pm,1-2pm,2-3pm,3-4pm,4-5pm
Monday,20th April 2026,EDT401(2321) BATCH 1: EDUCATION,CSI411(1200),PHY102(5112),ACC204(900),BIO201(1200),CHM212(1300),AGY302(462),STA112(1645)
Tuesday,21st April 2026,EDU316(2321) BATCH 1: EDUCATION,ISS202(341),ANA204(480),PHY104(1084),AGY310(529),ABE376(900),COS102(784),GET204(900)`;

// RESULT: 16 exams created
// One per unique course code (EDT401, CSI411, PHY102, ACC204, BIO201, CHM212, AGY302, STA112, EDU316, ISS202, ANA204, PHY104, AGY310, ABE376, COS102, GET204)
// If a course code appears in multiple time slots, only first is imported

// ============================================================
// Example 4: CSV Bulk Import (Simple Format)
// ============================================================
const csvSimpleData = `courseCode,courseTitle,day,date,startTime,endTime,batches
EDT401,Educational Technology,Monday,20th April 2026,9am-10am,10am-11am,EDUCATION
CSI411,Cyber Security,Monday,20th April 2026,10am-11am,11am-12pm,CIS
edt 401,Educational Technology,Tuesday,21st April 2026,2pm-3pm,3pm-4pm,EDUCATION|ARTS
PHY102,Physics II,Tuesday,21st April 2026,9am-10am,10am-11am,PHYSICAL SCIENCES`;

// RESULT: 3 exams created (EDT401, CSI411, PHY102)
// EDT401 and "edt 401" are normalized to same code - only first imported
// Batches are optional - handled gracefully

// ============================================================
// NORMALIZED COURSE CODE EXAMPLES
// ============================================================
// All these are treated as the SAME exam:
// ✓ EDT401
// ✓ EDT 401
// ✓ edt401
// ✓ edt 401
// ✓ Edt401
// ✓ EDT  401 (multiple spaces)

// All normalize to: EDT401

// ============================================================
// EXAMPLE REQUEST: Single Exam Creation
// ============================================================
const createSingleExam = {
  courseCode: "EDT401", // Will be normalized
  courseTitle: "Educational Technology",
  examType: "cbt",
  scheduleDate: "2026-04-20",
  startTime: "9:00am",
  endTime: "10:00am",
  venue: "CBT CENTRE",
  semester: "First",
  academicYear: "2025/2026",
  // Optional fields (can be omitted):
  duration: 60,
  totalMarks: 100,
  faculty: "Education",
  level: "100",
  courseOfStudy: "Educational Technology",
  invigilators: ["Prof. John Doe"],
  instructions: "Use approved scientific calculators only",
};

// ============================================================
// STUDENT VIEW (What students see)
// ============================================================
const studentExamView = {
  _id: "exam-id-123",
  courseCode: "EDT401",
  courseTitle: "Educational Technology",
  location: "CBT CENTRE",
  examType: "cbt",
  startTime: "9:00am",
  endTime: "10:00am",
  date: "2026-04-20",
  dateTime: "Monday, April 20, 2026 9:00am - 10:00am",
  semester: "First",
  academicYear: "2025/2026",
  status: "published",
  // NOT shown:
  // - instructions
  // - totalMarks
  // - level
  // - faculty
  // - courseOfStudy
  // - duration
  // - invigilators
  // - students list
};

// ============================================================
// BULK IMPORT RESPONSE EXAMPLE
// ============================================================
const bulkImportResponse = {
  success: true,
  message: "5 exams created successfully (deduplicated by course code)",
  createdCount: 5,
  duplicatesSkipped: 2, // These were ignored due to duplicate course codes
  failedCount: 0,
  createdExams: [
    {
      _id: "exam-1",
      courseCode: "EDT401",
      courseTitle: "EDT401",
      examType: "cbt",
      scheduleDate: "2026-04-20T00:00:00Z",
      startTime: "9:00am",
      endTime: "10:00am",
      venue: "CBT CENTRE",
      semester: "First",
      academicYear: "2025/2026",
      status: "draft",
      students: [],
      invigilators: [],
    },
    {
      _id: "exam-2",
      courseCode: "CSI411",
      courseTitle: "CSI411",
      examType: "cbt",
      scheduleDate: "2026-04-20T00:00:00Z",
      startTime: "10:00am",
      endTime: "11:00am",
      venue: "CBT CENTRE",
      semester: "First",
      academicYear: "2025/2026",
      status: "draft",
      students: [],
      invigilators: [],
    },
    // ... more exams
  ],
  errors: [],
};

// ============================================================
// API CALLS USING CURL
// ============================================================

// 1. Create single exam
// curl -X POST http://localhost:5000/api/exams \
//   -H "Authorization: Bearer {token}" \
//   -H "Content-Type: application/json" \
//   -d '{
//     "courseCode": "EDT401",
//     "courseTitle": "Educational Technology",
//     "examType": "cbt",
//     "scheduleDate": "2026-04-20",
//     "startTime": "9:00am",
//     "endTime": "10:00am",
//     "venue": "CBT CENTRE",
//     "semester": "First",
//     "academicYear": "2025/2026"
//   }'

// 2. Bulk import JSON
// curl -X POST http://localhost:5000/api/exams/bulk/json \
//   -H "Authorization: Bearer {token}" \
//   -H "Content-Type: application/json" \
//   -d '{ timetableData, semester, academicYear, defaults }'

// 3. Bulk import CSV
// curl -X POST http://localhost:5000/api/exams/bulk/csv \
//   -H "Authorization: Bearer {token}" \
//   -H "Content-Type: application/json" \
//   -d '{ "csvData": "...", "semester": "First", "academicYear": "2025/2026" }'

// 4. Get exams for course (latest only)
// curl -X GET "http://localhost:5000/api/exams/course?courseCode=EDT401&academicYear=2025/2026" \
//   -H "Authorization: Bearer {token}"

// 5. Get my exams (with filters)
// curl -X GET "http://localhost:5000/api/exams/my-exams?semester=First&academicYear=2025/2026&status=published" \
//   -H "Authorization: Bearer {token}"

// 6. Get specific exam
// curl -X GET "http://localhost:5000/api/exams/{examId}" \
//   -H "Authorization: Bearer {token}"

// 7. Publish exam
// curl -X POST "http://localhost:5000/api/exams/{examId}/publish" \
//   -H "Authorization: Bearer {token}"

// 8. Update exam
// curl -X PUT "http://localhost:5000/api/exams/{examId}" \
//   -H "Authorization: Bearer {token}" \
//   -H "Content-Type: application/json" \
//   -d '{ "courseTitle": "New Title", "venue": "Hall 1" }'

// 9. Delete exam
// curl -X DELETE "http://localhost:5000/api/exams/{examId}" \
//   -H "Authorization: Bearer {token}"

// 10. Add students to exam
// curl -X POST "http://localhost:5000/api/exams/{examId}/add-students" \
//   -H "Authorization: Bearer {token}" \
//   -H "Content-Type: application/json" \
//   -d '{ "studentIds": ["student-id-1", "student-id-2"] }'
