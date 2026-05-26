# Email System Troubleshooting Guide

## Common Issues & Solutions

### 1. **ETIMEDOUT Error (connect ETIMEDOUT)**
```
Error: connect ETIMEDOUT 1.179.115.1:587
```

**Causes:**
- Incorrect MAIL_HOST configuration
- Mail server is down or unreachable
- Firewall/network blocking port 587
- Wrong port number

**Solutions:**
1. Check your `.env` file has correct MAIL_HOST:
```bash
# Gmail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587

# Brevo
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587

# AWS SES
MAIL_HOST=email-smtp.region.amazonaws.com
MAIL_PORT=587
```

2. Test connection manually:
```bash
# From terminal, test if port is open
ping smtp.gmail.com

# Or use telnet (if available)
telnet smtp.gmail.com 587
```

3. Verify environment variables are loaded:
```bash
# Check .env file exists
ls -la .env

# In code, console.log will show if env vars loaded
# Look for "MAIL CONFIGURATION DEBUG" in startup logs
```

### 2. **Authentication Failed**
```
Error: Invalid login or MAIL_PASS incorrect
```

**Solutions:**
1. For Gmail with 2FA enabled:
   - Go to: https://myaccount.google.com/apppasswords
   - Generate an App Password
   - Use that password, NOT your Gmail password

2. For other providers:
   - Use correct credentials
   - Some providers require API keys instead of passwords
   - Check SendGrid/Brevo documentation

3. Check credentials in `.env`:
```bash
MAIL_USER=your-actual-email@gmail.com
MAIL_PASS=your-16-digit-app-password
```

### 3. **"Mail transporter verification failed" at startup**
This means environment variables are loaded but credentials are invalid.

**Solutions:**
```bash
# Restart the app after updating .env
npm run dev

# Watch for startup logs showing:
# ✅ Mail transporter verified successfully
```

### 4. **Emails Not Sending (No Error)**
The most common issue - debug logs will help identify why.

**Check logs for:**
```
📧 Sending venue change email to 5 recipients...
❌ Error sending venue change email: getaddrinfo ENOTFOUND ...
```

**Common causes:**
- No recipients list
- Empty email addresses
- MAIL_FROM not configured
- Firewall blocking outbound emails

### 5. **Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Kill process using port 5000
# On Windows:
netstat -ano | findstr :5000
taskkill /PID <process-id> /F

# On Mac/Linux:
lsof -i :5000
kill -9 <process-id>
```

## Debug Mode

### Enable Full Debugging

1. Add this to your `.env`:
```
DEBUG=*
NODE_ENV=development
```

2. Watch the server startup - you should see:
```
🔧 MAIL CONFIGURATION DEBUG:
  MAIL_HOST: smtp.gmail.com
  MAIL_PORT: 587
  MAIL_USER: ✓ SET
  MAIL_PASS: ✓ SET
  MAIL_FROM: noreply@unischedule.com

✅ Mail transporter verified successfully
```

3. When emails are sent, you'll see detailed logs:
```
📧 Sending event reminder email to 15 recipients for CS101...
✅ Event reminder email sent successfully. Message ID: <msg-id>
```

4. If there's an error:
```
❌ Error sending event reminder email: connect ETIMEDOUT
   Code: ETIMEDOUT
   Recipients: ['student1@unilorin.edu.ng', 'student2@unilorin.edu.ng']
   Course: CS101
```

## Recommended Email Providers for Production

### 1. **Gmail (Small Scale)**
- Free up to 500 emails/day
- Easy setup with App Passwords
- Good for testing & small deployments

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASS=app-password-from-security-settings
MAIL_FROM=noreply@your-domain.com
```

### 2. **Brevo/Sendinblue (Recommended)**
- Free: 300 emails/day
- Paid: $20/month for 20,000/month
- Good bounce rate & deliverability

```env
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USER=your-brevo-sender@email.com
MAIL_PASS=your-smtp-key
MAIL_FROM=noreply@unischedule.com
```

### 3. **SendGrid**
- Free: 100 emails/day
- Paid: Starts at $14.95/month
- Excellent documentation

```env
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USER=apikey
MAIL_PASS=SG.your-api-key
MAIL_FROM=noreply@unischedule.com
```

### 4. **AWS SES**
- Pay per email sent (very cheap)
- Must verify domain
- Good for large scale

```env
MAIL_HOST=email-smtp.us-east-1.amazonaws.com
MAIL_PORT=587
MAIL_USER=your-ses-smtp-user
MAIL_PASS=your-ses-smtp-password
MAIL_FROM=noreply@verified-domain.com
```

## Testing Email Manually

### Test from Terminal
```bash
# Send test email using curl
curl --url "smtp://smtp.gmail.com:587" \
  --ssl-reqd \
  --mail-from "your-email@gmail.com" \
  --mail-rcpt "recipient@example.com" \
  --user "your-email@gmail.com:your-app-password" \
  -T <(cat << EOF
From: <your-email@gmail.com>
To: <recipient@example.com>
Subject: Test Email

This is a test email from UniSchedule.
EOF
)
```

### Test Cron Jobs Manually
```bash
# In Node REPL or API test tool
const { sendEventReminderEmail } = require('./src/utils/mailer');

sendEventReminderEmail(['test@example.com'], {
  title: 'Test Event',
  courseCode: 'TEST101',
  courseTitle: 'Test Course',
  category: 'exam',
  date: '2026-05-20',
  time: '09:00 AM',
  venue: 'Test Hall',
  faculty: 'Test Faculty',
  level: '400',
  courseOfStudy: 'Test Department'
});
```

## Quick Checklist

- [ ] `.env` file created with MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS
- [ ] Email provider account created and verified
- [ ] App Password generated (if using Gmail with 2FA)
- [ ] Server restarted after `.env` changes
- [ ] Startup logs show "✅ Mail transporter verified successfully"
- [ ] Test email sent successfully
- [ ] All recipient email addresses are valid
- [ ] MAIL_FROM domain matches your provider's verified domain (for production)

## Still Having Issues?

Check the logs for these patterns:

| Log | Meaning |
|-----|---------|
| `ETIMEDOUT` | Mail server unreachable (wrong host/port) |
| `ENOTFOUND` | Host/domain doesn't exist (check MAIL_HOST) |
| `Invalid login` | Wrong credentials (MAIL_USER/MAIL_PASS) |
| `Message rejected` | Domain not verified (for some providers) |
| `Connection refused` | Firewall blocking port (less common) |

Each email sent will show detailed logs with Message ID - save these for provider support tickets if needed.
