/**
 * Helper utility to convert the university CBT timetable format to JSON
 * Usage: Use this to help extract and format timetable data from PDF/documents
 */

export interface TimetableSlot {
  time: string;
  courses: Array<{
    code: string;
    batches?: string;
  }>;
}

export interface TimetableDay {
  day: string;
  slots: TimetableSlot[];
}

/**
 * Example data extracted from the provided timetable
 * This can be used as a template to copy and fill in your own data
 */
export const exampleTimetableData: TimetableDay[] = [
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
  {
    day: "Wednesday, 22nd April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "PHY102(5112)", batches: "*EDUCATION *ENGR *PHARM *LIFE SCI" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "PHY102(5112)", batches: "*AGRICULTURE *PHYSICAL SCI *VET. MED *ENV. SCI" },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "PHY102(5112)", batches: "*CIS *BMS *BCS" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "PIO216(312)", batches: "" },
          { code: "UIL-CPS152(800)", batches: "" },
          { code: "ANP306(491)", batches: "" },
          { code: "ACC202(900)", batches: "" },
          { code: "UIL-AGE204(657)", batches: "" },
          { code: "ENG204(546)", batches: "" },
          { code: "FIN346(845)", batches: "" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "BUL506(603)", batches: "" },
          { code: "AGR102/AGG102(571)", batches: "" },
          { code: "UIL-ANS202(659)", batches: "" },
          { code: "MTH202(760)", batches: "" },
          { code: "ENG102(500)", batches: "" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "EDU414(2791)", batches: "" },
          { code: "PIO212(482)", batches: "" },
          { code: "ECO206(317)", batches: "" },
        ],
      },
    ],
  },
  {
    day: "Thursday, 23rd April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "GST/GNS112(10256)", batches: "*EDUCATION *ENGR. & TECH. *ENV. SCI." },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "GST/GNS112(10256)", batches: "*AGRIC *CIS" },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "GST/GNS112(10256)", batches: "*BMS *CLINICAL SCI. *LAW *VET MED" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "GST/GNS112(10256)", batches: "*LIFE SCI *SOCIAL SCI. *ARTS" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "GST/GNS112(10256)", batches: "*MGT SCI. *PHARM *PHY SCI" },
          { code: "AEF302(458)", batches: "" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "EDU312(2984)", batches: "" },
        ],
      },
    ],
  },
  {
    day: "Friday, 24th April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "STA202(430)", batches: "" },
          { code: "GET206(890)", batches: "" },
          { code: "ACC102(986)", batches: "" },
          { code: "ZOO102(868)", batches: "" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "ECO102(1272)", batches: "" },
          { code: "AGR206(962)", batches: "" },
          { code: "AGY308(522)", batches: "" },
          { code: "AMS102(1400)", batches: "" },
        ],
      },
      {
        time: "1-3pm",
        courses: [
          { code: "JUMAT", batches: "" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "AGR204(977)", batches: "" },
          { code: "UIL-BCH102(618)", batches: "" },
          { code: "ABE306(800)", batches: "" },
          { code: "PIO214(510)", batches: "" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "EDU314(2364)", batches: "" },
          { code: "UIL/SWK122(605)", batches: "" },
        ],
      },
    ],
  },
  {
    day: "Saturday, 25th April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "MTH102(6662)", batches: "*EDUCATION *ENGR *PHARM *LIFE SCI" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          {
            code: "MTH102(6662)",
            batches: "*AGRICULTURE *PHYSICAL SCI *VET. MED *ENV. SCI *CIS *SOC. SCI",
          },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "MTH102(6662)", batches: "*CLINICAL SCI *BMS" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "GET202(1018)", batches: "" },
          { code: "UIL-ENG206(785)", batches: "" },
          { code: "COS202(856)", batches: "" },
          { code: "ECO204(473)", batches: "" },
          { code: "AGR112/AGG112(569)", batches: "" },
          { code: "SSC202(1317)", batches: "" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "ANP302(453)", batches: "" },
          { code: "UIL-BCH204(344)", batches: "" },
        ],
      },
      {
        time: "4-5pm",
        courses: [
          { code: "EDU412(2214)", batches: "" },
        ],
      },
    ],
  },
  {
    day: "Monday, 27th April, 2026",
    slots: [
      {
        time: "11am-12pm",
        courses: [
          { code: "CHM102(4900)", batches: "*EDUCATION *ENGR *PHARM *LIFE SCI" },
        ],
      },
      {
        time: "12-1pm",
        courses: [
          { code: "CHM102(4900)", batches: "*AGRICULTURE *PHYSICAL SCI *VET. MED" },
        ],
      },
      {
        time: "1-2pm",
        courses: [
          { code: "CHM102(4900)", batches: "*CLINICAL SCI *CIS *BMS" },
          { code: "BCH202(1392)", batches: "" },
        ],
      },
      {
        time: "2-3pm",
        courses: [
          { code: "MTH204(510)", batches: "" },
          { code: "GET208(659)", batches: "" },
          { code: "AMS104(1400)", batches: "" },
          { code: "CPT302(1036)", batches: "" },
        ],
      },
      {
        time: "3-4pm",
        courses: [
          { code: "EDU416(2209)", batches: "" },
          { code: "PIO218(800)", batches: "" },
        ],
      },
    ],
  },
];

/**
 * Helper function to generate a bulk import request body
 */
export const generateBulkImportRequest = (
  timetableData: TimetableDay[],
  semester: string,
  academicYear: string,
  defaults?: {
    faculty?: string;
    level?: string;
    courseOfStudy?: string;
  }
) => {
  return {
    timetableData,
    semester,
    academicYear,
    defaults: defaults || {},
  };
};

/**
 * Convert timetable to CSV format
 */
export const timetableToCSV = (timetableData: TimetableDay[]): string => {
  const header = "courseCode,day,time,batches";
  const rows: string[] = [];

  for (const day of timetableData) {
    for (const slot of day.slots) {
      for (const course of slot.courses) {
        const row = [course.code, day.day, slot.time, course.batches || ""].join(",");
        rows.push(row);
      }
    }
  }

  return [header, ...rows].join("\n");
};

/**
 * Parse a CSV-like text into timetable format
 * Expected format: courseCode,day,time,batches
 */
export const parseCSVToTimetable = (csvText: string): TimetableDay[] => {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const days: Map<string, TimetableDay> = new Map();

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 3) continue;

    const courseCode = parts[0].trim();
    const dayStr = parts[1].trim();
    const timeStr = parts[2].trim();
    const batches = parts[3]?.trim() || "";

    // Get or create day
    if (!days.has(dayStr)) {
      days.set(dayStr, { day: dayStr, slots: [] });
    }

    const dayObj = days.get(dayStr)!;

    // Find or create slot
    let slot = dayObj.slots.find((s) => s.time === timeStr);
    if (!slot) {
      slot = { time: timeStr, courses: [] };
      dayObj.slots.push(slot);
    }

    // Add course to slot
    slot.courses.push({ code: courseCode, batches });
  }

  // Return days in order
  return Array.from(days.values());
};

export default {
  exampleTimetableData,
  generateBulkImportRequest,
  timetableToCSV,
  parseCSVToTimetable,
};
