import mongoose, { Document, Schema } from 'mongoose';

export type NotificationType = 'venue_change' | 'new_event' | 'reminder' | 'announcement' | 'cancellation';

export interface INotification extends Document {
  type: NotificationType;
  subject: string;
  message: string;
  recipients: string[]; // email addresses
  recipientCount: number;
  sentBy: mongoose.Types.ObjectId;
  faculty: string;
  level: string;
  courseOfStudy: string;
  relatedEvent?: mongoose.Types.ObjectId;
  relatedTimetableId?: mongoose.Types.ObjectId;
  isAutomatic: boolean;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'partial';
  failedRecipients?: string[];
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ['venue_change', 'new_event', 'reminder', 'announcement', 'cancellation'],
      required: true,
    },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    recipients: [{ type: String }],
    recipientCount: { type: Number, default: 0 },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    faculty: { type: String, required: true },
    level: { type: String, required: true },
    courseOfStudy: { type: String, required: true },
    relatedEvent: { type: Schema.Types.ObjectId, ref: 'Event' },
    relatedTimetableId: { type: Schema.Types.ObjectId, ref: 'Timetable' },
    isAutomatic: { type: Boolean, default: false },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'partial'],
      default: 'pending',
    },
    failedRecipients: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model<INotification>('Notification', notificationSchema);
