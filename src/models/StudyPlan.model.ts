import mongoose, { Document, Schema } from 'mongoose';

export type StudyTaskStatus = 'pending' | 'in_progress' | 'completed' | 'missed';

export interface IStudyTask {
  _id: mongoose.Types.ObjectId;
  courseCode: string;
  courseTitle: string;
  task: string;           // e.g. "Read Chapter 1"
  scheduledAt: Date;      // date + time to study
  durationMinutes: number;
  status: StudyTaskStatus;
  reminderSent: boolean;
  completedAt?: Date;
  notes?: string;
}

export interface IStudyPlan extends Document {
  owner: mongoose.Types.ObjectId;
  level: string;
  courseOfStudy: string;
  tasks: IStudyTask[];
  createdAt: Date;
  updatedAt: Date;
}

const studyTaskSchema = new Schema({
  courseCode:      { type: String, required: true, uppercase: true },
  courseTitle:     { type: String, required: true },
  task:            { type: String, required: true },
  scheduledAt:     { type: Date, required: true },
  durationMinutes: { type: Number, default: 60 },
  status:          { type: String, enum: ['pending','in_progress','completed','missed'], default: 'pending' },
  reminderSent:    { type: Boolean, default: false },
  completedAt:     { type: Date },
  notes:           { type: String },
});

const studyPlanSchema = new Schema<IStudyPlan>(
  {
    owner:         { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    level:         { type: String, required: true },
    courseOfStudy: { type: String, required: true },
    tasks:         { type: [studyTaskSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IStudyPlan>('StudyPlan', studyPlanSchema);