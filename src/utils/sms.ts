export const sendBulkSms = async (recipients: string[], message: string): Promise<void> => {
  if (!recipients || recipients.length === 0) return;

  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    console.warn('TWILIO not configured - SMS will not be sent. Recipients:', recipients.length);
    // Fallback: log each recipient and message for debugging
    recipients.forEach((r) => console.log(`SMS to ${r}: ${message}`));
    return;
  }

  try {
    // Try to load Twilio at runtime. Use require() to avoid static type dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio');
    const client = twilio(sid, token) as any;

    for (const to of recipients) {
      try {
        await client.messages.create({ body: message, from, to });
      } catch (err: any) {
        console.error('Failed sending SMS to', to, err?.message || err);
      }
    }
  } catch (err: any) {
    console.error('Error initializing Twilio client:', err?.message || err);
  }
};
