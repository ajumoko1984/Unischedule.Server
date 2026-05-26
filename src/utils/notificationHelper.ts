import CourseFormModel from '../models/CourseForm.model';
import User from '../models/User.model';
import { normalizeCourseCode } from './examHelper';
import { AuthRequest } from '../middleware/auth.middleware';

export interface NotificationScope {
  faculty?: string;
  level?: string;
  courseOfStudy?: string;
  courseCode?: string;
}

export const resolveNotificationScope = (req: AuthRequest): NotificationScope => {
  return {
    faculty: req.body.faculty || req.user?.faculty,
    level: req.body.level || req.user?.level,
    courseOfStudy: req.body.courseOfStudy || req.user?.courseOfStudy,
    courseCode: req.body.courseCode ? normalizeCourseCode(req.body.courseCode) : undefined,
  };
};

export const getNotificationRecipientEmails = async (scope: NotificationScope): Promise<string[]> => {
  const emails = new Set<string>();

  if (scope.courseCode) {
    // Find all course forms containing this course code
    const formFilter: any = {
      'courses.courseCode': scope.courseCode,
      status: 'approved',
    };
    if (scope.faculty) formFilter.faculty = { $regex: new RegExp(`^${scope.faculty}$`, 'i') };
    if (scope.level) formFilter.level = { $regex: new RegExp(`^${scope.level}$`, 'i') };
    if (scope.courseOfStudy) formFilter.courseOfStudy = { $regex: new RegExp(`^${scope.courseOfStudy}$`, 'i') };

    const courseForms = await CourseFormModel.find(formFilter).select('faculty level courseOfStudy');
    if (courseForms.length === 0) return [];

    // For each matching course form, find students with that exact faculty/level/courseOfStudy
    for (const form of courseForms) {
      const students = await User.find({
        role: 'student',
        isActive: true,
        faculty: { $regex: new RegExp(`^${form.faculty}$`, 'i') },
        level: { $regex: new RegExp(`^${form.level}$`, 'i') },
        courseOfStudy: { $regex: new RegExp(`^${form.courseOfStudy}$`, 'i') },
      }).select('email');

      students.forEach(student => emails.add(student.email));
    }
  } else {
    const filter: any = {
      role: 'student',
      isActive: true,
    };
    if (scope.faculty) filter.faculty = { $regex: new RegExp(`^${scope.faculty}$`, 'i') };
    if (scope.level) filter.level = { $regex: new RegExp(`^${scope.level}$`, 'i') };
    if (scope.courseOfStudy) filter.courseOfStudy = { $regex: new RegExp(`^${scope.courseOfStudy}$`, 'i') };

    const students = await User.find(filter).select('email');
    students.forEach(student => emails.add(student.email));
  }

  return Array.from(emails);
};
