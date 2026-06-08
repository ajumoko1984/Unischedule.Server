#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in environment');
  process.exit(1);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/backfillPhones.js path/to/phones.csv');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const data = fs.readFileSync(path.resolve(csvPath), 'utf8');
    const lines = data.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) {
      console.error('CSV is empty');
      process.exit(1);
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIdx = header.indexOf('email');
    const phoneIdx = header.indexOf('phone');
    if (emailIdx === -1 || phoneIdx === -1) {
      console.error('CSV must have headers: email,phone');
      process.exit(1);
    }

    let updated = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const email = (cols[emailIdx] || '').trim().toLowerCase();
      const phone = (cols[phoneIdx] || '').trim();
      if (!email || !phone) continue;

      const res = await mongoose.connection.collection('users').updateOne({ email }, { $set: { phone } });
      if (res.matchedCount > 0) updated++;
    }

    console.log(`Done. Updated phone for ${updated} users.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
