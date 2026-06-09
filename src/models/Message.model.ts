import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  sender: Types.ObjectId;
  recipients: Types.ObjectId[];
  subject?: string;
  message: string;
  replyTo?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    subject: { type: String, trim: true },
    message: { type: String, required: true },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

export default mongoose.model<IMessage>('Message', messageSchema);
