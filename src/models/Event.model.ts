import mongoose, { Document, Schema } from 'mongoose';

export type EventCategory = 'test' | 'exam' | 'assignment' | 'project' | 'other';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface IEvent extends Document {
  title: string;
  courseCode: string;
  courseTitle: string;
  category: EventCategory;
  date: Date;
  startTime: string;
  endTime?: string;
  venue: string;
  description?: string;
  faculty: string;
  level: string;
  courseOfStudy: string;
  semester: string;
  academicYear: string;
  status: EventStatus;
  emailSent: boolean;
  emailSentAt?: Date;
  reminderSent: boolean;
  reminderSentAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    courseCode: { type: String, required: true, uppercase: true },
    courseTitle: { type: String, required: true },
    category: {
      type: String,
      enum: ['test', 'exam', 'assignment', 'project', 'other'],
      required: true,
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String },
    venue: { type: String, required: true },
    description: { type: String },
    faculty: { type: String, required: true },
    level: { type: String, required: true },
    courseOfStudy: { type: String, required: true },
    semester: { type: String, required: true },
    academicYear: { type: String, required: true },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    emailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IEvent>('Event', eventSchema);
