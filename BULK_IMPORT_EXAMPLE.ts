/**
 * Example: Using the Bulk Import Feature
 * 
 * This example shows how to use the bulk import endpoints with the provided CBT timetable.
 * Run this with Node.js or in your browser developer console if connected to your API.
 */

// Example 1: Using the exampleTimetableData directly
// =====================================================
const timetableData = [
  {
    day: "Monday, 20th April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "GNS312(10256)", batches: "*EDUCATION *ARTS *SOCIAL SCI." },
          { code: "GNS312(10256)", batches: "*AGRICULTURE *PHYSICAL SCI *VET. MED *CIS" },
          { code: "GNS312(10256)", batches: "*AGRIC *CIS *LAW *ENGR" },
          { code: "GNS312(10256)", batches: "*MGT SCI. *PHARM *PHY SCI" },
          { code: "GNS312(10256)", batches: "*BMS *CLINICAL SCI. *VET MED *LIFE SCIENCES" },
          { code: "UIL-MTH114(597)", batches: "" },
          { code: "GET210(1200)", batches: "" },
          { code: "ACC204(900)", batches: "" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "GNS312(10256)", batches: "*AGRICULTURE *PHYSICAL SCI *VET. MED *CIS" },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "GNS312(10256)", batches: "*AGRIC *CIS *LAW *ENGR" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "GNS312(10256)", batches: "*MGT SCI. *PHARM *PHY SCI" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "GNS312(10256)", batches: "*BMS *CLINICAL SCI. *VET MED *LIFE SCIENCES" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "UIL-MTH114(597)", batches: "" },
          { code: "GET210(1200)", batches: "" },
          { code: "ACC204(900)", batches: "" },
        ],
      },
    ],
  },
  {
    day: "Tuesday, 21st April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "EDU316(2321)", batches: "" },
          { code: "ISS202(341)", batches: "" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "ANA204(480)", batches: "" },
          { code: "PHY104(1084)", batches: "" },
          { code: "AGY310(529)", batches: "" },
          { code: "ABE376(900)", batches: "" },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "COS102(784)", batches: "" },
          { code: "GET204(900)", batches: "" },
          { code: "ANA202(350)", batches: "" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "CHM212(1300)", batches: "" },
          { code: "AGY302(462)", batches: "" },
          { code: "STA112(1645)", batches: "" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "BOT202(356)", batches: "" },
          { code: "PSY102(650)", batches: "" },
          { code: "BIO102(2249)", batches: "" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "ECO202(471)", batches: "" },
          { code: "UIL-CPS252(717)", batches: "" },
          { code: "IFT212(500)", batches: "" },
          { code: "ABE302(552)", batches: "" },
        ],
      },
    ],
  },
];

// Example 2: Fetch call using JavaScript
// ========================================
const importTimetable = async (timetableData, semester = "RAIN", academicYear = "2025/2026") => {
  try {
    const response = await fetch("http://localhost:5000/api/exams/bulk/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer YOUR_EXAM_OFFICER_TOKEN_HERE`,
      },
      body: JSON.stringify({
        timetableData,
        semester,
        academicYear,
        defaults: {
          // Optional: provide defaults for all exams
          faculty: "Faculty of Science",
          level: "100",
          courseOfStudy: "General Studies",
        },
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✓ Successfully imported ${result.createdCount} exams`);
      if (result.failedCount > 0) {
        console.warn(`⚠ ${result.failedCount} exams failed to import:`);
        console.table(result.errors);
      }
    } else {
      console.error("✗ Import failed:", result.message);
    }

    return result;
  } catch (error) {
    console.error("Error:", error);
  }
};

// Example 3: Using cURL (from terminal)
// ======================================
/*
curl -X POST http://localhost:5000/api/exams/bulk/json \
  -H "Authorization: Bearer YOUR_EXAM_OFFICER_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "timetableData": [...],
    "semester": "RAIN",
    "academicYear": "2025/2026",
    "defaults": {
      "faculty": "Faculty of Science",
      "level": "100",
      "courseOfStudy": "General Studies"
    }
  }'
*/

// Example 4: Using Python (if needed)
// ====================================
/*
import requests
import json

url = "http://localhost:5000/api/exams/bulk/json"
headers = {
    "Authorization": "Bearer YOUR_EXAM_OFFICER_TOKEN_HERE",
    "Content-Type": "application/json"
}

data = {
    "timetableData": timetable_data,
    "semester": "RAIN",
    "academicYear": "2025/2026",
    "defaults": {
        "faculty": "Faculty of Science",
        "level": "100",
        "courseOfStudy": "General Studies"
    }
}

response = requests.post(url, headers=headers, json=data)
result = response.json()

print(f"Created: {result.get('createdCount')} exams")
print(f"Failed: {result.get('failedCount')} exams")
if result.get('errors'):
    print("Errors:", result['errors'])
*/

// Example 5: Response handling with error checking
// ==================================================
const handleImportResponse = (result) => {
  if (result.success) {
    console.log(`✓ Import successful!`);
    console.log(`  - Created: ${result.createdCount} exams`);
    console.log(`  - Failed: ${result.failedCount} exams`);

    if (result.createdCount > 0) {
      console.log("\n📋 First exam created:");
      const firstExam = result.createdExams[0];
      console.log(`  - Course: ${firstExam.courseCode}`);
      console.log(`  - Date: ${new Date(firstExam.scheduleDate).toDateString()}`);
      console.log(`  - Time: ${firstExam.startTime} - ${firstExam.endTime}`);
      console.log(`  - Status: ${firstExam.status}`);
    }

    if (result.errors && result.errors.length > 0) {
      console.log("\n⚠️  Failed imports:");
      result.errors.forEach((error) => {
        console.log(`  - ${error.courseCode}: ${error.error}`);
      });
    }
  } else {
    console.error(`✗ Import failed: ${result.message}`);
  }
};

// Example 6: Importing in batches (if data is too large)
// =======================================================
const importInBatches = async (allTimetableData, batchSize = 50, semester = "RAIN", academicYear = "2025/2026") => {
  const token = "YOUR_EXAM_OFFICER_TOKEN_HERE";
  let totalCreated = 0;
  let totalFailed = 0;

  for (let i = 0; i < allTimetableData.length; i += batchSize) {
    const batch = allTimetableData.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.ceil((i + 1) / batchSize)}...`);

    try {
      const response = await fetch("http://localhost:5000/api/exams/bulk/json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          timetableData: batch,
          semester,
          academicYear,
        }),
      });

      const result = await response.json();
      totalCreated += result.createdCount || 0;
      totalFailed += result.failedCount || 0;

      console.log(`  ✓ Batch complete: ${result.createdCount} created, ${result.failedCount} failed`);
    } catch (error) {
      console.error(`  ✗ Batch failed: ${error.message}`);
      totalFailed += batch.length;
    }
  }

  console.log(`\n✓ All batches processed!`);
  console.log(`  - Total created: ${totalCreated}`);
  console.log(`  - Total failed: ${totalFailed}`);
};

// Example 7: Quick import (replace with your token)
// ==================================================
const quickImport = async () => {
  console.log("Starting bulk import...\n");

  const result = await importTimetable(timetableData, "RAIN", "2025/2026");
  handleImportResponse(result);
};

// Uncomment to run:
// quickImport();

export { importTimetable, handleImportResponse, importInBatches, timetableData };
