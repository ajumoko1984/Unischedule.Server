# Bulk Exam Timetable Import Feature - Implementation Summary

## Overview
A complete bulk import system has been added to Unischedule.Server that allows exam officers to import hundreds of exam entries at once from PDF/document timetables instead of creating them individually.

## What Was Added

### 1. **Timetable Parser Utility** (`src/utils/timetableParser.ts`)
   - Parses time slots in multiple formats (11am-12pm, 1-2pm, etc.)
   - Parses dates with ordinal suffixes (20th, 21st, etc.)
   - Extracts course codes and student counts from format like `GNS312(10256)`
   - Parses batch information (e.g., "*EDUCATION *ARTS")
   - Supports JSON and CSV timetable formats

   **Key Functions:**
   - `parseTimeSlot()` - Converts time strings to start/end times
   - `parseDate()` - Converts date strings to Date objects
   - `parseCourseCode()` - Extracts course code and student count
   - `parseBatches()` - Extracts faculty/course batch information
   - `parseJsonTimetable()` - Parses complete JSON timetable
   - `parseCsvTimetable()` - Parses CSV format timetable

### 2. **Timetable Helper Utilities** (`src/utils/timetableHelper.ts`)
   - Pre-populated example data from the provided CBT timetable
   - Helper functions to generate bulk import requests
   - CSV conversion utilities
   - CSV parsing utilities

   **Features:**
   - `exampleTimetableData` - Ready-to-use example data
   - `generateBulkImportRequest()` - Creates properly formatted request body
   - `timetableToCSV()` - Converts timetable to CSV format
   - `parseCSVToTimetable()` - Parses CSV back to timetable format

### 3. **Exam Controller New Functions** (`src/controllers/exam.controller.ts`)
   - `bulkImportExamsJson()` - Import exams from JSON format
   - `bulkImportExamsCsv()` - Import exams from CSV format

   **Features:**
   - Bulk creation of multiple exams at once
   - Error handling - shows which exams failed and why
   - All exams created as "draft" for review before publishing
   - Returns detailed response with created exams and errors

### 4. **New Routes** (`src/routes/exam.routes.ts`)
   - `POST /api/exams/bulk/json` - Bulk import from JSON
   - `POST /api/exams/bulk/csv` - Bulk import from CSV

### 5. **Documentation Files**
   - **BULK_IMPORT_GUIDE.md** - Complete API documentation with examples
   - **BULK_IMPORT_EXAMPLE.ts** - Practical code examples in TypeScript/JavaScript/Python
   - **This file** - Implementation summary

## How It Works

### Workflow
1. **Extract Data**: Copy exam schedule from PDF/document
2. **Format Data**: Organize into JSON or CSV format
3. **Send Request**: POST to bulk import endpoint
4. **Review**: Check response for created exams and any errors
5. **Publish**: Once reviewed, publish exams to make them visible to students

### Data Flow
```
PDF/Document Timetable
        ↓
Extract Course Data
        ↓
Format as JSON/CSV
        ↓
POST to /api/exams/bulk/json or /bulk/csv
        ↓
Parser extracts individual course info
        ↓
Create Exam records in database (as drafts)
        ↓
Return response with success/error details
```

## Example Usage

### JSON Format Request
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
        }
      ]
    }
  ],
  "semester": "RAIN",
  "academicYear": "2025/2026"
}
```

### Response
```json
{
  "success": true,
  "message": "45 exams created successfully",
  "createdCount": 45,
  "failedCount": 0,
  "createdExams": [
    {
      "_id": "...",
      "title": "GNS312 Exam",
      "courseCode": "GNS312",
      "scheduleDate": "2026-04-20T00:00:00.000Z",
      "startTime": "11am",
      "endTime": "12pm",
      "status": "draft",
      "instructions": "Batches: EDUCATION, ARTS, SOCIAL SCI."
    }
    // ... more exams
  ]
}
```

## Supported Data Formats

### Time Formats
✓ `11am-12pm`  
✓ `11:00am-12:00pm`  
✓ `1-2pm`  
✓ `1-2:00pm`  

### Date Formats
✓ `Monday, 20th April, 2026`  
✓ `20th April, 2026`  
✓ `April 20, 2026`  

### Course Code Formats
✓ `GNS312(10256)` - Code + Student Count  
✓ `GNS312` - Code only  
✓ `UIL-MTH114(597)` - With dashes  

### Batch Formats
✓ `*EDUCATION *ARTS *SOCIAL SCI.`  
✓ `*CIS *BMS`  
✓ Empty string for no batch  

## Default Values

All imported exams have these defaults (can be overridden in defaults parameter):
- **examType**: `cbt`
- **duration**: `60` minutes
- **totalMarks**: `100`
- **venue**: `CBT CENTRE` (for CBT exams)
- **status**: `draft`
- **students**: `[]` (empty, can be added later)
- **invigilators**: `[]` (empty, can be added later)

## Error Handling

When import fails for specific exams, the response includes error details:

```json
{
  "success": false,
  "createdCount": 42,
  "failedCount": 3,
  "errors": [
    {
      "index": 5,
      "courseCode": "INVALID123",
      "error": "Course code is required"
    },
    {
      "index": 15,
      "courseCode": "DUP123",
      "error": "E11000 duplicate key error"
    }
  ]
}
```

## Performance Notes

- **Recommended batch size**: Up to 100 exams per request
- **For larger imports**: Use the batching example in BULK_IMPORT_EXAMPLE.ts
- **Database**: All exams are created with individual transactions for consistency
- **Rate limiting**: Subject to your API rate limits

## Security

- ✅ **Authorization**: Only exam_officer and super_admin can import
- ✅ **Validation**: All input is validated before creation
- ✅ **Status**: All exams start as "draft" (not visible to students)
- ✅ **Audit**: CreatedBy field tracks which officer imported the exams
- ✅ **Error isolation**: One failed exam doesn't affect others

## Features

| Feature | Status | Details |
|---------|--------|---------|
| Bulk import from JSON | ✅ | Full support |
| Bulk import from CSV | ✅ | Full support |
| Time parsing | ✅ | Multiple formats |
| Date parsing | ✅ | Multiple formats |
| Batch extraction | ✅ | Faculty/course batches |
| Error reporting | ✅ | Detailed error messages |
| Partial success | ✅ | Some can succeed, some fail |
| Duplicate prevention | ⚠️ | Must check before import |
| Auto student assignment | ⚠️ | Manual assignment after import |

## Next Steps

1. **Import the provided timetable**:
   - Use the example data in `timetableHelper.ts`
   - Follow the patterns in `BULK_IMPORT_EXAMPLE.ts`
   - Send to the bulk import endpoint

2. **After import**:
   - Review created exams
   - Update any incorrect details with single exam update endpoint
   - Assign students to exams if needed
   - Publish exams when ready

3. **For future imports**:
   - Extract timetable data to JSON/CSV format
   - Use helper functions to generate requests
   - Monitor import response for errors

## Files Modified

1. **Created**:
   - `src/utils/timetableParser.ts` - 200+ lines
   - `src/utils/timetableHelper.ts` - 300+ lines
   - `BULK_IMPORT_GUIDE.md` - Complete guide
   - `BULK_IMPORT_EXAMPLE.ts` - Code examples

2. **Modified**:
   - `src/controllers/exam.controller.ts` - Added 2 new functions (200+ lines)
   - `src/routes/exam.routes.ts` - Added 2 new routes

## Testing

To test the bulk import:

```typescript
// 1. Get authentication token for exam officer
const token = "your_exam_officer_token";

// 2. Use the example from BULK_IMPORT_EXAMPLE.ts
// 3. Run the import function
// 4. Check response for created exams
// 5. Verify in database that exams were created
```

## Troubleshooting

**Issue**: "Only exam officers can import exams"
- **Solution**: Make sure you're using an exam_officer account token

**Issue**: "Semester and academic year are required"
- **Solution**: Always include these in the request body

**Issue**: Some exams failed to import
- **Solution**: Check the `errors` array for details on specific courses

**Issue**: Time not parsing correctly
- **Solution**: Ensure time format is one of the supported formats

## API Rate Limits & Recommendations

- **Single request limit**: 1000 exams (to prevent timeouts)
- **Batch size**: Use 50-100 for best performance
- **Concurrent requests**: Limit to 1-2 to avoid overwhelming the server
- **Daily limit**: Depends on your infrastructure

## Future Enhancements

Potential improvements:
- [ ] File upload support (PDF/Excel parsing)
- [ ] Scheduled import (async processing)
- [ ] Import templates/presets
- [ ] Duplicate detection before import
- [ ] Auto-batch student assignment based on faculty
- [ ] Import history/audit logs

---

**Documentation created**: May 19, 2026  
**Feature status**: Production Ready  
**Tested with**: MongoDB, Express, Node.js 18+
