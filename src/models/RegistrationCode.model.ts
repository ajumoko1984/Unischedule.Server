import mongoose, { Document, Schema } from 'mongoose';

export interface IRegistrationCode extends Document {
  code: string; // Unique registration code
  role: 'level_adviser' | 'exam_officer'; // What role this code is for
  faculty?: string; // Optional: Restrict to specific faculty
  facultyId?: string; // Optional: Restrict to specific faculty ID
  level?: string; // Optional: For level_adviser - restrict to specific level
  isUsed: boolean; // Whether the code has been used
  usedBy?: mongoose.Types.ObjectId; // User who used this code
  usedAt?: Date; // When the code was used
  expiresAt: Date; // When the code expires (auto-delete)
  createdBy: mongoose.Types.ObjectId; // Admin who created this code
  createdAt: Date;
  updatedAt: Date;
}

const registrationCodeSchema = new Schema<IRegistrationCode>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['level_adviser', 'exam_officer'],
      required: true,
    },
    faculty: { type: String }, // Full faculty name
    facultyId: { type: String }, // Faculty ID for easier lookup
    level: { type: String }, // e.g., "100", "200", "300", "400", "500"
    isUsed: { type: Boolean, default: false, index: true },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true }, // TTL index
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// TTL index to auto-delete expired codes
registrationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRegistrationCode>('RegistrationCode', registrationCodeSchema);
