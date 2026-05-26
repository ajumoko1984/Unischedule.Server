# Exam Timetable Bulk Import Feature

## Overview
This feature allows exam officers to import exam timetables in bulk from JSON or CSV formats instead of creating exams one by one. Perfect for large timetables like the CBT schedules.

## API Endpoints

### 1. Bulk Import from JSON
**Endpoint:** `POST /api/exams/bulk/json`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "timetableData": [
    {
      "day": "Monday, 20th April, 2026",
      "slots": [
        {
          "time": "11am-12pm",
          "courses": [
            {
              "code": "GNS312(10256)",
              "batches": "*EDUCATION *ARTS *SOCIAL SCI."
            },
            {
              "code": "UIL-MTH114(597)",
              "batches": ""
            }
          ]
        },
        {
          "time": "12-1pm",
          "courses": [
            {
              "code": "GNS312(10256)",
              "batches": "*AGRICULTURE *PHYSICAL SCI *VET. MED *CIS"
            }
          ]
        }
      ]
    },
    {
      "day": "Tuesday, 21st April, 2026",
      "slots": [
        {
          "time": "11am-12pm",
          "courses": [
            {
              "code": "EDU316(2321)",
              "batches": ""
            }
          ]
        }
      ]
    }
  ],
  "semester": "RAIN",
  "academicYear": "2025/2026",
  "defaults": {
    "faculty": "Faculty of Science",
    "level": "100",
    "courseOfStudy": "Computer Science"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "25 exams created successfully",
  "createdCount": 25,
  "failedCount": 0,
  "createdExams": [
    {
      "_id": "65f1234...",
      "title": "GNS312 Exam",
      "courseCode": "GNS312",
      "courseTitle": "GNS312",
      "examType": "cbt",
      "duration": 60,
      "totalMarks": 100,
      "scheduleDate": "2026-04-20T00:00:00.000Z",
      "startTime": "11am",
      "endTime": "12pm",
      "venue": "CBT CENTRE",
      "semester": "RAIN",
      "academicYear": "2025/2026",
      "status": "draft",
      "instructions": "Batches: EDUCATION, ARTS, SOCIAL SCI."
    }
    // ... more exams
  ]
}
```

### 2. Bulk Import from CSV
**Endpoint:** `POST /api/exams/bulk/csv`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**CSV Format:**
```
courseCode,day,date,startTime,faculty,level,courseOfStudy,studentCount
GNS312,Monday,20th April 2026,11am-12pm,Science,100,General Studies,10256
UIL-MTH114,Monday,20th April 2026,11am-12pm,Science,100,Mathematics,597
EDU316,Tuesday,21st April 2026,11am-12pm,Education,200,Education,2321
```

**Request Body:**
```json
{
  "csvData": "courseCode,day,date,startTime,facility,level,courseOfStudy,studentCount\nGNS312,Monday,20th April 2026,11am-12pm,Science,100,General Studies,10256\n...",
  "semester": "RAIN",
  "academicYear": "2025/2026",
  "defaults": {
    "faculty": "Faculty of Science",
    "level": "100",
    "courseOfStudy": "Computer Science"
  }
}
```

## Data Format Details

### Time Slot Parsing
The parser supports various time formats:
- `11am-12pm` ✓
- `11:00am-12:00pm` ✓
- `1-2pm` ✓
- `1-2:00pm` ✓
- `1pm-2pm` ✓

### Date Parsing
Supports multiple date formats:
- `Monday, 20th April, 2026` ✓
- `20th April, 2026` ✓
- `April 20, 2026` ✓

### Course Code Parsing
Course codes with student counts in parentheses:
- `GNS312(10256)` → Code: `GNS312`, Students: `10256`
- `UIL-MTH114(597)` → Code: `UIL-MTH114`, Students: `597`

### Batch Information
Batches are parsed and stored as instructions:
- `*EDUCATION *ARTS *SOCIAL SCI.` → Stored as: "Batches: EDUCATION, ARTS, SOCIAL SCI."

## Step-by-Step Usage

### Step 1: Extract Timetable Data
From the PDF/Document, organize the data in JSON format with days, time slots, and courses.

### Step 2: Prepare Request
Create the request body with:
- `timetableData` or `csvData`
- `semester` (e.g., "RAIN", "HARMATTAN")
- `academicYear` (e.g., "2025/2026")
- Optional `defaults` for faculty, level, courseOfStudy

### Step 3: Send Request
```bash
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d @timetable.json
```

### Step 4: Review Results
The response will show:
- Number of successfully created exams
- Number of failed imports with error details
- List of created exam objects

## Example: Complete Workflow

### 1. Extract from the provided timetable and format as JSON:
```json
{
  "timetableData": [
    {
      "day": "Monday, 20th April, 2026",
      "slots": [
        {
          "time": "11am-12pm",
          "courses": [
            { "code": "GNS312(10256)", "batches": "*EDUCATION *ARTS *SOCIAL SCI." },
            { "code": "GNS312(10256)", "batches": "*AGRICULTURE *PHYSICAL SCI *VET. MED *CIS" },
            { "code": "GNS312(10256)", "batches": "*AGRIC *CIS *LAW *ENGR" },
            { "code": "GNS312(10256)", "batches": "*MGT SCI. *PHARM *PHY SCI" },
            { "code": "GNS312(10256)", "batches": "*BMS *CLINICAL SCI. *VET MED *LIFE SCIENCES" },
            { "code": "UIL-MTH114(597)", "batches": "" },
            { "code": "GET210(1200)", "batches": "" },
            { "code": "ACC204(900)", "batches": "" }
          ]
        },
        {
          "time": "12-1pm",
          "courses": [
            { "code": "GNS312(10256)", "batches": "*AGRICULTURE *PHYSICAL SCI *VET. MED *CIS" }
          ]
        }
      ]
    },
    {
      "day": "Tuesday, 21st April, 2026",
      "slots": [
        {
          "time": "11am-12pm",
          "courses": [
            { "code": "EDU316(2321)", "batches": "" },
            { "code": "ISS202(341)", "batches": "" }
          ]
        }
      ]
    }
  ],
  "semester": "RAIN",
  "academicYear": "2025/2026"
}
```

### 2. Send the request:
```bash
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer exam_officer_token" \
  -H "Content-Type: application/json" \
  -d @timetable.json
```

### 3. Check the response:
```json
{
  "success": true,
  "message": "45 exams created successfully",
  "createdCount": 45,
  "failedCount": 0
}
```

### 4. Publish exams (optional):
Once imported as drafts, exam officers can:
- Review the imported exams
- Publish them to make them visible to students
- Update any details if needed

## Features

✅ **Batch Import**: Import multiple exams at once  
✅ **Error Handling**: Shows which exams failed and why  
✅ **Flexible Parsing**: Handles various time and date formats  
✅ **Batch Information**: Captures faculty/course batches in instructions  
✅ **Student Counts**: Extracts and stores enrollment numbers  
✅ **Draft Status**: All imported exams start as drafts for review  
✅ **CSV & JSON Support**: Choose the format that works for you  

## Notes

- All imported exams are created with status `draft`
- Students need to be added after import using the `/add-students` endpoint
- Time zones are based on server time (UTC)
- Duplicate exams are not prevented during import (check before submitting)
- Failed imports don't prevent successful ones from being created

## Troubleshooting

**Issue**: "Timetable data must be an array"
- **Solution**: Ensure `timetableData` is an array of day objects

**Issue**: "Semester and academic year are required"
- **Solution**: Include both `semester` and `academicYear` in request body

**Issue**: Some exams failed to import
- **Solution**: Check the `errors` array in response for details on which courses failed and why

**Issue**: Time slots not parsing correctly
- **Solution**: Verify time format matches one of the supported formats (e.g., "11am-12pm")
