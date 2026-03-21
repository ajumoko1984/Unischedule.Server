import mongoose, { Document, Schema } from 'mongoose';

export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type AssignmentPriority = 'low' | 'medium' | 'high';

export interface IAssignment extends Document {
  owner: mongoose.Types.ObjectId;
  courseCode: string;
  courseTitle: string;
  title: string;
  description?: string;
  deadline: Date;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  completedAt?: Date;
  reminderSent: boolean;   // 24hr before deadline reminder
  level: string;
  courseOfStudy: string;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    owner:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseCode:    { type: String, required: true, uppercase: true },
    courseTitle:   { type: String, required: true },
    title:         { type: String, required: true },
    description:   { type: String },
    deadline:      { type: Date, required: true },
    priority:      { type: String, enum: ['low','medium','high'], default: 'medium' },
    status:        { type: String, enum: ['pending','in_progress','completed','overdue'], default: 'pending' },
    completedAt:   { type: Date },
    reminderSent:  { type: Boolean, default: false },
    level:         { type: String, required: true },
    courseOfStudy: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAssignment>('Assignment', assignmentSchema);