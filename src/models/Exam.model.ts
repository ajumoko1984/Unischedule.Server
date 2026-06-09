import mongoose, { Document, Schema } from 'mongoose';

export type ExamType = 'cbt' | 'practical' | 'written' | 'oral';
export type ExamStatus = 'draft' | 'published' | 'scheduled' | 'ongoing' | 'completed';


export interface IExam extends Document {
  courseCode: string; // Normalized course code (e.g., EDT401)
  courseTitle: string;
  examType: ExamType;
  scheduleDate: Date;
  startTime: string;
  endTime: string;
  venue: string; // Automatic "CBT CENTRE" for CBT, specific venue for others
  semester: string;
  academicYear: string;
  status: ExamStatus;
  createdBy: mongoose.Types.ObjectId; // exam_officer who created it
  students: mongoose.Types.ObjectId[]; // student IDs taking this exam
  studentPopulation?: number;
  // Optional legacy/admin fields (not displayed to students)
  title?: string;
  duration?: number; // in minutes
  totalMarks?: number;
  faculty?: string;
  level?: string;
  courseOfStudy?: string;
  invigilators: mongoose.Types.ObjectId[]; // lecturer IDs invigilating
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examSchema = new Schema<IExam>(
  {
    // Core required fields (visible to students)
    courseCode: { type: String, required: true, uppercase: true, index: true },
    courseTitle: { type: String, required: true },
    examType: {
      type: String,
      enum: ['cbt', 'practical', 'written', 'oral'],
      default: 'cbt',
      required: true,
    },
    scheduleDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    venue: { type: String, required: true },
    semester: { type: String, required: true },
    academicYear: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'active', 'closed', 'graded'],
      default: 'draft',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    studentPopulation: { type: Number, min: 0 },
    // Optional legacy/admin fields (not required, not displayed to students)
    title: { type: String },
    duration: { type: Number },
    totalMarks: { type: Number },
    faculty: { type: String },
    level: { type: String },
    courseOfStudy: { type: String },
    invigilators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    instructions: { type: String },
  },
  { timestamps: true }
);

// Indexes for faster queries
examSchema.index({ createdBy: 1 });
examSchema.index({ courseCode: 1, academicYear: 1, semester: 1 });
examSchema.index({ scheduleDate: 1 });
examSchema.index({ courseCode: 1, academicYear: 1, semester: 1, 'createdBy': 1 }, { unique: false });

export default mongoose.model<IExam>('Exam', examSchema);
