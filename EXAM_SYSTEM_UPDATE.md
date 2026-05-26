# Exam System Update - Course Code Focused Design

## Overview
The exam system has been completely reorganized to focus on **course codes as standalone exams**. Each course code now represents a single exam, with duplicate course codes being automatically deduplicated during bulk import.

## Key Changes

### 1. **Exam Model Updates** (`src/models/Exam.model.ts`)

**Required Fields (Visible to Students):**
- `courseCode` - Normalized course code (e.g., EDT401, CSI411)
- `courseTitle` - Course title
- `examType` - Type of exam (cbt, written, practical, oral)
- `scheduleDate` - Date of exam
- `startTime` - Exam start time (e.g., "9:00am")
- `endTime` - Exam end time (e.g., "10:00am")
- `venue` - Exam location (auto "CBT CENTRE" for CBT exams)
- `semester` - Semester (First, Second)
- `academicYear` - Academic year

**Optional Fields (Admin/Legacy):**
- `title` - Exam title (auto-generated from course code)
- `duration` - Exam duration in minutes
- `totalMarks` - Total marks
- `faculty` - Faculty name
- `level` - Study level
- `courseOfStudy` - Course of study
- `invigilators` - Invigilator names
- `instructions` - Special instructions

---

### 2. **Course Code Normalization** (`src/utils/examHelper.ts`)

All course codes are automatically normalized:
- Uppercase conversion: `edt 401` → `EDT401`
- Space removal: `EDT 401` → `EDT401`
- Consistent format: `edt 401`, `EDT401`, `EDT 401` all become `EDT401`

**Functions:**
```typescript
normalizeCourseCode(courseCode: string)  // Normalize a single code
areCourseCodesEqual(code1, code2)       // Compare two codes
formatExamForStudent(exam)              // Student-friendly view
formatExamForOfficer(exam)              // Full admin view
deduplicateExamsByCode(exams)           // Remove duplicate codes
```

---

### 3. **Student View** (Simplified)

When students fetch exam details, they only see:
```json
{
  "_id": "exam-id",
  "courseCode": "EDT401",
  "courseTitle": "Educational Technology",
  "location": "CBT CENTRE",
  "examType": "cbt",
  "startTime": "9:00am",
  "endTime": "10:00am",
  "date": "2026-04-20",
  "dateTime": "Monday, April 20, 2026 9:00am - 10:00am",
  "semester": "First",
  "academicYear": "2025/2026",
  "status": "published"
}
```

**Hidden Fields from Students:**
- ❌ Instructions
- ❌ Total Marks
- ❌ Level
- ❌ Faculty
- ❌ Course of Study
- ❌ Invigilators
- ❌ Duration
- ❌ Student list

---

### 4. **Exam Officer View** (Full Details)

Exam officers see all fields including optional ones.

---

### 5. **Creating Single Exams**

**Endpoint:** `POST /api/exams`

**Required Fields:**
```json
{
  "courseCode": "EDT401",
  "courseTitle": "Educational Technology",
  "examType": "cbt",
  "scheduleDate": "2026-04-20",
  "startTime": "9:00am",
  "endTime": "10:00am",
  "venue": "CBT CENTRE",
  "semester": "First",
  "academicYear": "2025/2026"
}
```

**Optional Fields:**
```json
{
  "duration": 60,
  "totalMarks": 100,
  "faculty": "Education",
  "level": "100",
  "courseOfStudy": "Educational Technology",
  "invigilators": ["Prof. John Doe"],
  "instructions": "Use approved calculators only"
}
```

---

### 6. **Bulk Import - Automatic Deduplication**

**Key Feature:** When importing multiple exams, each course code appears **only once**.

**Endpoint:** `POST /api/exams/bulk/json` or `POST /api/exams/bulk/csv`

**Behavior:**
- If timetable has `EDT401` appearing in multiple time slots, only the **first occurrence** is imported
- Response includes: `duplicatesSkipped: N`

**Example Request:**
```json
{
  "timetableData": [
    {
      "day": "Monday, 20th April, 2026",
      "slots": [
        {
          "time": "9am-10am",
          "courses": [
            { "code": "EDT401(2321)", "batches": "*EDUCATION" },
            { "code": "CSI411(1200)", "batches": "*CIS" }
          ]
        },
        {
          "time": "10am-11am",
          "courses": [
            { "code": "EDT401(2000)", "batches": "*EDUCATION *ARTS" }
          ]
        }
      ]
    }
  ],
  "semester": "First",
  "academicYear": "2025/2026",
  "defaults": {
    "examType": "cbt",
    "venue": "CBT CENTRE"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "2 exams created successfully (deduplicated by course code)",
  "createdCount": 2,
  "duplicatesSkipped": 1,
  "failedCount": 0,
  "createdExams": [
    { "courseCode": "EDT401", "courseTitle": "EDT401", ... },
    { "courseCode": "CSI411", "courseTitle": "CSI411", ... }
  ]
}
```

---

### 7. **Timetable Parser Updates** (`src/utils/timetableParser.ts`)

**Course Code Normalization:**
- `EDT 401` → `EDT401`
- `edt401` → `EDT401`
- `GNS312/GNS114` → `GNS312/GNS114` (compound codes preserved)

**Parsing Formats Supported:**

1. **JSON Nested Format:**
```json
{
  "day": "Monday, 20th April, 2026",
  "slots": [
    {
      "time": "9am-10am",
      "courses": [
        { "code": "EDT401(2321)", "batches": "*EDUCATION" }
      ]
    }
  ]
}
```

2. **JSON Flat Format:**
```json
{
  "courseCode": "EDT401",
  "courseTitle": "Educational Technology",
  "day": "Monday, 20th April, 2026",
  "time": "9am-10am"
}
```

3. **CSV Tabular Format:**
```
Day,Date,9am-10am,10am-11am,11am-12pm
Monday,20th April 2026,EDT401(2321) BATCH 1: EDUCATION,CSI411(1200),PHY102(5112)
```

4. **CSV Simple Format:**
```
courseCode,day,date,startTime,endTime,batches
EDT401,Monday,20th April 2026,9am-10am,10am-11am,EDUCATION
```

---

### 8. **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exams` | Create single exam |
| GET | `/api/exams/my-exams` | Get student's exams or officer's created exams |
| GET | `/api/exams/:id` | Get exam details (filtered view for students) |
| PUT | `/api/exams/:id` | Update exam |
| DELETE | `/api/exams/:id` | Delete exam |
| GET | `/api/exams/course?courseCode=EDT401` | Get exam for specific course (latest only) |
| POST | `/api/exams/bulk/json` | Bulk import from JSON (auto-deduplicated) |
| POST | `/api/exams/bulk/csv` | Bulk import from CSV (auto-deduplicated) |
| POST | `/api/exams/:id/publish` | Publish exam to students |
| POST | `/api/exams/:id/add-students` | Add students to exam |
| POST | `/api/exams/:id/remove-students` | Remove students from exam |

---

### 9. **Query Parameters**

**Get My Exams:**
```
GET /api/exams/my-exams?academicYear=2025/2026&semester=First&status=published&courseCode=EDT401
```

**Get Exam by Course:**
```
GET /api/exams/course?courseCode=EDT401&academicYear=2025/2026
```
Returns only the **latest exam** for that course code.

---

### 10. **Database Indexes**

Optimized for performance:
- `{ courseCode: 1, academicYear: 1, semester: 1 }` - Fast course lookup
- `{ courseCode: 1, academicYear: 1, semester: 1, createdBy: 1 }` - Officer queries
- `{ scheduleDate: 1 }` - Sort by date
- `{ createdBy: 1 }` - Get officer's exams

---

### 11. **Validation Rules**

✅ **Required for all exams:**
- courseCode (auto-normalized)
- courseTitle
- examType (cbt, written, practical, oral)
- scheduleDate
- startTime
- endTime
- venue
- semester
- academicYear

❌ **NOT required** (can be null/undefined):
- title
- duration
- totalMarks
- faculty
- level
- courseOfStudy
- invigilators
- instructions

---

### 12. **Migration Notes**

If you have existing exams:
1. Course codes will be normalized on next save/update
2. Exams with duplicate course codes can be manually deduplicated using bulk import
3. No data loss - optional fields are preserved

---

## Example Workflows

### Workflow 1: Create Single Exam
```bash
curl -X POST http://localhost:5000/api/exams \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "courseCode": "EDT401",
    "courseTitle": "Educational Technology",
    "examType": "cbt",
    "scheduleDate": "2026-04-20",
    "startTime": "9:00am",
    "endTime": "10:00am",
    "venue": "CBT CENTRE",
    "semester": "First",
    "academicYear": "2025/2026"
  }'
```

### Workflow 2: Bulk Import with Auto-Deduplication
```bash
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "timetableData": [ ... ],
    "semester": "First",
    "academicYear": "2025/2026"
  }'
```

### Workflow 3: Get Exam for Course
```bash
curl -X GET "http://localhost:5000/api/exams/course?courseCode=EDT401" \
  -H "Authorization: Bearer {token}"
```
Returns only the latest exam for EDT401.

---

## Testing Checklist

- [ ] Create exam with normalized course codes
- [ ] Bulk import with duplicate course codes (verify deduplication)
- [ ] Student views simplified fields (no admin fields)
- [ ] Exam officer sees all fields
- [ ] Course code normalization works (EDT 401 = edt401 = EDT401)
- [ ] Get exam by course returns only latest
- [ ] Update exam maintains normalization
- [ ] Bulk CSV import works with all formats
- [ ] Bulk JSON import works with nested/flat formats
