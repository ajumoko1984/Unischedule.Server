# Quick Start Guide - Bulk Exam Import

## 1️⃣ Import the 2025/2026 CBT Timetable in 2 Minutes

### Option A: Using JavaScript/Node.js
```javascript
const importData = {
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
        }
      ]
    }
  ],
  "semester": "RAIN",
  "academicYear": "2025/2026"
};

fetch('http://localhost:5000/api/exams/bulk/json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(importData)
})
.then(r => r.json())
.then(data => console.log(`✓ Created ${data.createdCount} exams`));
```

### Option B: Using cURL
```bash
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @timetable.json
```

## 2️⃣ Where to Find Everything

| Resource | Location | Purpose |
|----------|----------|---------|
| **API Docs** | `BULK_IMPORT_GUIDE.md` | Full endpoint documentation |
| **Code Examples** | `BULK_IMPORT_EXAMPLE.ts` | Runnable code samples |
| **Example Data** | `src/utils/timetableHelper.ts` | Pre-populated timetable data |
| **This Guide** | `BULK_IMPORT_QUICK_START.md` | Quick reference (you are here) |

## 3️⃣ Data Format Cheat Sheet

### Time Format
- ✓ `11am-12pm` / `11:00am-12:00pm` / `1-2pm` / `1-2:00pm`

### Course Code Format
- ✓ `GNS312(10256)` extracts to code: GNS312, students: 10256
- ✓ `UIL-MTH114(597)` also works with dashes

### Batch Format
- ✓ `*EDUCATION *ARTS *SOCIAL SCI.` → Stored as instructions
- ✓ Leave empty (`""`) if no batch info

### Date Format
- ✓ `Monday, 20th April, 2026`
- ✓ `20th April, 2026`

## 4️⃣ Response Examples

### Success ✅
```json
{
  "success": true,
  "message": "45 exams created successfully",
  "createdCount": 45,
  "failedCount": 0
}
```

### Partial Success ⚠️
```json
{
  "success": false,
  "createdCount": 42,
  "failedCount": 3,
  "errors": [
    { "courseCode": "INVALID", "error": "Required field missing" }
  ]
}
```

## 5️⃣ The 3 Timetable Days Structure

Every day needs this structure:
```json
{
  "day": "Monday, 20th April, 2026",    // Date with day name
  "slots": [
    {
      "time": "11am-12pm",               // Time range
      "courses": [
        {
          "code": "GNS312(10256)",       // Course code with student count
          "batches": "*EDUCATION *ARTS"  // Optional batch info
        }
      ]
    }
  ]
}
```

## 6️⃣ Complete Request Template

Copy & use this template:

```json
{
  "timetableData": [
    {
      "day": "Monday, 20th April, 2026",
      "slots": [
        {
          "time": "11am-12pm",
          "courses": [
            { "code": "COURSE1(500)", "batches": "" },
            { "code": "COURSE2(1000)", "batches": "*BATCH1 *BATCH2" }
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
    "courseOfStudy": "General Studies"
  }
}
```

## 7️⃣ Authentication

You need an exam officer token:

```bash
# 1. Login as exam officer
POST /api/auth/login
Body: { "email": "officer@university.edu", "password": "..." }

# 2. Copy the returned token
# 3. Use in Authorization header: Bearer YOUR_TOKEN
```

## 8️⃣ After Import - Next Steps

1. ✅ **Check Response** - Verify created count
2. 🔍 **Review Exams** - View created exams in database
3. ✏️ **Edit If Needed** - Update individual exams if needed
4. 📢 **Publish** - When ready, publish to make visible to students
5. 👥 **Assign Students** - Add students to exams if needed

## 9️⃣ Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| "Only exam officers can import" | Use exam officer account token |
| "Semester and academic year required" | Add these fields to request body |
| No time parsing error but times wrong | Check time format matches: 11am-12pm |
| Course code not extracting | Make sure format is: CODE(NUMBER) |

## 🔟 What Gets Created?

Each course entry creates one exam with:
- **Status**: `draft` (not visible to students yet)
- **Type**: `cbt` (Computer Based Test)
- **Venue**: `CBT CENTRE`
- **Duration**: 60 minutes (default)
- **Total Marks**: 100 (default)
- **Students**: Empty (add later if needed)

---

## Quick Commands

### Import from file
```bash
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @data.json
```

### Get token
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"officer@test.edu","password":"pass"}'
```

### View created exams
```bash
curl -X GET http://localhost:5000/api/exams/my-exams \
  -H "Authorization: Bearer TOKEN"
```

---

**Need more info?** See `BULK_IMPORT_GUIDE.md` for detailed documentation.
