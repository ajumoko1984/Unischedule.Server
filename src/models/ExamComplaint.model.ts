import mongoose, { Document, Schema } from 'mongoose';

export type ComplaintCategory = 'timing_scheduling' | 'venue_issue' | 'invigilator_issue' | 'postponement_request' | 'other';
export type ComplaintStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved' | 'closed';

export interface IExamComplaint extends Document {
  studentId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  category: ComplaintCategory;
  title: string;
  description: string;
  status: ComplaintStatus;
  classRepId?: mongoose.Types.ObjectId; // class rep handling the complaint
  levelAdviserNotified?: boolean;
  examOfficerNotified?: boolean;
  classRepResponse?: string;
  classRepResponseDate?: Date;
  escalatedTo?: 'level_adviser' | 'exam_officer';
  escalationReason?: string;
  resolution?: string;
  resolvedDate?: Date;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

const examComplaintSchema = new Schema<IExamComplaint>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    category: {
      type: String,
      enum: ['timing_scheduling', 'venue_issue', 'invigilator_issue', 'postponement_request', 'other'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ['open', 'acknowledged', 'escalated', 'resolved', 'closed'],
      default: 'open',
    },
    classRepId: { type: Schema.Types.ObjectId, ref: 'User' },
    levelAdviserNotified: { type: Boolean, default: false },
    examOfficerNotified: { type: Boolean, default: false },
    classRepResponse: { type: String },
    classRepResponseDate: { type: Date },
    escalatedTo: { type: String, enum: ['level_adviser', 'exam_officer'] },
    escalationReason: { type: String },
    resolution: { type: String },
    resolvedDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  { timestamps: true }
);

// Index for faster queries
examComplaintSchema.index({ studentId: 1, status: 1 });
examComplaintSchema.index({ examId: 1 });
examComplaintSchema.index({ classRepId: 1 });
examComplaintSchema.index({ createdAt: -1 });

export default mongoose.model<IExamComplaint>('ExamComplaint', examComplaintSchema);
