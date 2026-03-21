import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const baseTemplate = (content: string, preheader = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UniSchedule</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:24px 32px;text-align:left;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.2);border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="color:#ffffff;font-size:18px;font-weight:700;">U</span>
                </td>
                <td style="padding-left:12px;">
                  <div style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:0.3px;">UniSchedule</div>
                  <div style="color:rgba(255,255,255,0.75);font-size:12px;">University Timetable System</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              This is an automated message from UniSchedule. Do not reply to this email.<br>
              University of Ilorin &nbsp;|&nbsp; faculty Timetable Management System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const sendVenueChangeEmail = async (
  recipients: string[],
  data: {
    courseCode: string;
    courseTitle: string;
    oldVenue: string;
    newVenue: string;
    day: string;
    time: string;
    changedBy: string;
    reason?: string;
    faculty?: string;
    level?: string;
    courseOfStudy?: string;
  }
): Promise<void> => {
  const content = `
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:#f59e0b;font-size:18px;">⚠️</span>
        <strong style="color:#92400e;font-size:14px;">Venue Change Notice</strong>
      </div>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Class Venue Updated</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">The venue for the following class has been changed. Please take note.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;width:40%;">Course</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;font-weight:500;">${data.courseCode} – ${data.courseTitle}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Day & Time</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;">${data.day} &nbsp;|&nbsp; ${data.time}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Previous Venue</td><td style="padding:12px 16px;color:#ef4444;font-size:13px;font-weight:500;border-top:1px solid #e2e8f0;text-decoration:line-through;">${data.oldVenue}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">New Venue</td><td style="padding:12px 16px;color:#16a34a;font-size:13px;font-weight:600;border-top:1px solid #e2e8f0;">${data.newVenue}</td></tr>
      ${data.reason ? `<tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Reason</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;">${data.reason}</td></tr>` : ''}
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Updated by</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;">${data.changedBy}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin:0;">Please update your schedule accordingly and inform your classmates.</p>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_FROM || recipients[0],
    bcc: recipients,
    subject: `⚠️ Venue Change: ${data.courseCode} – ${data.day}`,
    html: baseTemplate(content, `Venue changed for ${data.courseCode} on ${data.day}`),
  });
};

export const sendEventReminderEmail = async (
  recipients: string[],
  data: {
    title: string;
    courseCode: string;
    courseTitle: string;
    category: string;
    date: string;
    time: string;
    venue: string;
    description?: string;
    faculty?: string;
    level?: string;
    courseOfStudy?: string;
  }
): Promise<void> => {
  const categoryEmoji: Record<string, string> = { test: '📝', exam: '📋', assignment: '📌', project: '🗂️', other: '📅' };
  const emoji = categoryEmoji[data.category] || '📅';
  const categoryColor: Record<string, string> = { test: '#f59e0b', exam: '#ef4444', assignment: '#3b82f6', project: '#8b5cf6', other: '#6b7280' };
  const color = categoryColor[data.category] || '#6b7280';

  const content = `
    <div style="background:${color}15;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
      <strong style="color:${color};font-size:14px;">${emoji} ${data.category.toUpperCase()} REMINDER</strong>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">${data.title}</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">This is a reminder about your upcoming ${data.category}. Please prepare accordingly.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;width:40%;">Course</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;font-weight:500;">${data.courseCode} – ${data.courseTitle}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Date</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;font-weight:600;">${data.date}</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Time</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;">${data.time}</td></tr>
      <tr><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Venue</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;font-weight:500;border-top:1px solid #e2e8f0;">${data.venue}</td></tr>
      ${data.description ? `<tr style="background:#f8fafc;"><td style="padding:12px 16px;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;">Notes</td><td style="padding:12px 16px;color:#1e293b;font-size:13px;border-top:1px solid #e2e8f0;">${data.description}</td></tr>` : ''}
    </table>
    <div style="background:#eff6ff;border-radius:8px;padding:16px 20px;">
      <p style="color:#1e40af;font-size:13px;margin:0;">💡 <strong>Tip:</strong> Log in to UniSchedule to view your full timetable and all upcoming events.</p>
    </div>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_FROM || recipients[0],
    bcc: recipients,
    subject: `${emoji} Reminder: ${data.title} – ${data.date}`,
    html: baseTemplate(content, `${data.category} reminder for ${data.courseCode}`),
  });
};

export const sendAnnouncementEmail = async (
  recipients: string[],
  data: { subject: string; message: string; sentBy: string; faculty: string; level: string , courseOfStudy: string }
): Promise<void> => {
  const content = `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <strong style="color:#1d4ed8;font-size:14px;">📢 Announcement from ${data.faculty} – ${data.level} Level</strong>
    </div>
    <h2 style="color:#1e293b;font-size:20px;margin:0 0 16px;">${data.subject}</h2>
    <div style="color:#475569;font-size:14px;line-height:1.7;margin-bottom:24px;white-space:pre-wrap;">${data.message}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">Sent by: ${data.sentBy}</p>`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.MAIL_FROM || recipients[0],
    bcc: recipients,
    subject: `📢 ${data.subject}`,
    html: baseTemplate(content, data.subject),
  });
};

export default transporter;
