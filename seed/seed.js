/* Usage:  npm run seed          → fills empty collections + creates the first admin
 *         npm run seed:reset    → WIPES all content collections and re-seeds them   */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const M = require('../models');
const data = require('./seed-data.json');

const RESET = process.argv.includes('--reset');

const collections = {
  events: M.Event, values: M.Value, services: M.Service, pillars: M.Pillar,
  approach: M.Approach, why: M.Why, team: M.Team, crew: M.Crew, media: M.Media,
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const [key, Model] of Object.entries(collections)) {
    if (RESET) await Model.deleteMany({});
    if ((await Model.countDocuments()) === 0) {
      await Model.insertMany(data[key]);
      console.log(`✓ seeded ${key} (${data[key].length})`);
    } else {
      console.log(`– ${key} already has content, skipped`);
    }
  }

  if (RESET || !(await M.Setting.findOne({ key: 'site' }))) {
    await M.Setting.findOneAndUpdate({ key: 'site' }, { data: data.site }, { upsert: true });
    console.log('✓ seeded site settings');
  }

  if ((await M.Admin.countDocuments()) === 0) {
    const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || password.length < 10) {
      console.error('✗ Set ADMIN_EMAIL and an ADMIN_PASSWORD of 10+ characters in .env, then re-run.');
    } else {
      await M.Admin.create({ email, name: 'Administrator', passwordHash: await bcrypt.hash(password, 12) });
      console.log(`✓ created admin ${email}`);
    }
  } else {
    console.log('– admin account already exists');
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
