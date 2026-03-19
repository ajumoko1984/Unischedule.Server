import mongoose, { Document, Schema } from 'mongoose';

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type EventType = 'lecture' | 'lab' | 'test' | 'exam' | 'seminar' | 'other';
export type Semester = 'First' | 'Second';

export interface ITimetableSlot {
  _id: mongoose.Types.ObjectId;
  courseCode: string;
  courseTitle: string;
  lecturer: string;
  venue: string;
  venueHistory: { venue: string; changedBy: string; changedAt: Date; reason?: string }[];
  day: DayOfWeek;
  startTime: string; // "08:00"
  endTime: string;   // "10:00"
  type: EventType;
  color?: string;    // hex color for display
}

export interface ITimetable extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: Semester;
  academicYear: string; // "2024/2025"
  slots: ITimetableSlot[];
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const venueHistorySchema = new Schema({
  venue: { type: String, required: true },
  changedBy: { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
  reason: { type: String },
}, { _id: false });

const timetableSlotSchema = new Schema({
  courseCode: { type: String, required: true, uppercase: true },
  courseTitle: { type: String, required: true },
  lecturer: { type: String, required: true },
  venue: { type: String, required: true },
  venueHistory: { type: [venueHistorySchema], default: [] },
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: true,
  },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  type: {
    type: String,
    enum: ['lecture', 'lab', 'test', 'exam', 'seminar', 'other'],
    default: 'lecture',
  },
  color: { type: String, default: '#2563eb' },
});

const timetableSchema = new Schema<ITimetable>(
  {
    title: { type: String, required: true },
    faculty: { type: String, required: true },
    level: { type: String, required: true },
    courseOfStudy: { type: String, required: true },
    semester: { type: String, enum: ['First', 'Second'], required: true },
    academicYear: { type: String, required: true },
    slots: { type: [timetableSlotSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<ITimetable>('Timetable', timetableSchema);
