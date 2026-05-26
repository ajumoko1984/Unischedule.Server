import mongoose, { Document, Schema } from 'mongoose';

export interface ICourseFormCourse {
  courseCode: string;
  courseTitle: string;
  faculty?: string;
  level?: string;
  semester?: string;
  creditUnits?: number;
}

export interface ICourseForm extends Document {
  courses: ICourseFormCourse[]; // Array of courses for all students in this level/department
  academicYear: string; // e.g., "2023/2024"
  semester: string; // e.g., "first", "second"
  faculty: string;
  courseOfStudy: string; // Department / course of study
  level: string; // Level for which these courses are prescribed
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; // Form status
  approvedBy?: Schema.Types.ObjectId; // Reference to admin/level adviser who approved
  approvalDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const courseFormSchema = new Schema<ICourseForm>(
  {
    courses: [
      {
        courseCode: { type: String, required: true, uppercase: true },
        courseTitle: { type: String, required: true },
        faculty: { type: String },
        level: { type: String },
        semester: { type: String },
        creditUnits: { type: Number },
      },
    ],
    academicYear: { type: String, required: true }, // e.g., "2023/2024"
    semester: { type: String, required: true, enum: ['first', 'second'] },
    faculty: { type: String, required: true },
    courseOfStudy: { type: String, required: true },
    level: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvalDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

// Ensure one active course form per faculty/courseOfStudy/level per academic year/semester
courseFormSchema.index(
  { faculty: 1, courseOfStudy: 1, level: 1, academicYear: 1, semester: 1 },
  { unique: true, sparse: true, partialFilterExpression: { status: { $in: ['submitted', 'approved'] } } }
);

export default mongoose.model<ICourseForm>('CourseForm', courseFormSchema);
