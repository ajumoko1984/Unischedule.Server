import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'super_admin' | 'level_adviser' | 'class_rep' | 'student';

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  faculty: string;
  level: string; // e.g., "400"
  courseOfStudy: string; // e.g., "Educational Technology"
  matricNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  resetPasswordToken?: String;
resetPasswordExpire?: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['super_admin', 'level_adviser', 'class_rep', 'student'],
      default: 'student',
    },
    faculty: { type: String },
    level: { type: String}, // "100", "200", "300", "400"
    courseOfStudy: { type: String},
    matricNumber: { type: String, sparse: true },
    isActive: { type: Boolean, default: true },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure only one class_rep and one level_adviser per level+course combination
userSchema.index(
  { role: 1, level: 1, courseOfStudy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      role: { $in: ['class_rep', 'level_adviser'] },
    },
  }
);

export default mongoose.model<IUser>('User', userSchema);
