const mongoose = require('mongoose');
const { Schema } = mongoose;

const opts = { timestamps: true };
const str = (extra = {}) => ({ type: String, trim: true, default: '', ...extra });

/* ---------- Admin user ---------- */
const Admin = mongoose.model('Admin', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: str({ default: 'Administrator' }),
  passwordHash: { type: String, required: true },
  lastLoginAt: Date,
  tokenVersion: { type: Number, default: 0 },   // bump to sign out every session of this admin
  resetTokenHash: { type: String, default: '' }, // sha256 of the emailed reset/invite token
  resetExpires: Date,
}, opts));

/* ---------- Single-document site settings (hero text, about, contact, footer …) ---------- */
const Setting = mongoose.model('Setting', new Schema({
  key: { type: String, required: true, unique: true },
  data: { type: Schema.Types.Mixed, default: {} },
}, opts));

/* ---------- Contact form submissions ---------- */
const Message = mongoose.model('Message', new Schema({
  firstName: str({ required: true, maxlength: 80 }),
  lastName: str({ required: true, maxlength: 80 }),
  email: str({ required: true, maxlength: 160 }),
  phone: str({ required: true, maxlength: 40 }),
  category: str({ maxlength: 160 }),
  message: str({ required: true, maxlength: 4000 }),
  read: { type: Boolean, default: false },
  emailed: { type: Boolean, default: false },
  emailError: str(),
  ip: str(),
}, opts));

/* ---------- Content collections (managed from the admin) ---------- */
const withOrder = (fields) => new Schema({
  ...fields,
  order: { type: Number, default: 0 },
  published: { type: Boolean, default: true },
}, opts);

const Event = mongoose.model('Event', withOrder({
  title: str({ required: true }),
  category: str(),            // used for the filter buttons
  tag: str(),                 // e.g. TRAILER 01
  duration: str(),            // e.g. 03:45 MIN
  series: str(),
  date: str(),
  description: str(),
  ctaLabel: str(),
  ctaUrl: str(),
  stage: str(),
  image: str(),                 // cover / poster photo
  type: { type: String, enum: ['photo', 'video', 'live'], default: 'photo' },
  gallery: { type: [new Schema({ url: String }, { _id: false })], default: [] }, // extra photos (type = photo)
  videoFile: str(),             // uploaded clip (/uploads/…mp4)
  videoUrl: str(),              // or a YouTube / Vimeo / Facebook link
  liveUrl: str(),               // live-stream link (YouTube Live, Facebook Live, Vimeo)
  liveStatus: { type: String, enum: ['upcoming', 'live', 'ended'], default: 'upcoming' },
}));

const Value = mongoose.model('Value', withOrder({
  title: str({ required: true }), description: str(),
}));

const Service = mongoose.model('Service', withOrder({
  icon: str({ default: 'movie' }), label: str(), title: str({ required: true }),
  description: str(), footerTag: str(),
}));

const Pillar = mongoose.model('Pillar', withOrder({
  icon: str({ default: 'public' }), title: str({ required: true }), description: str(),
}));

const Approach = mongoose.model('Approach', withOrder({
  stageLabel: str(), title: str({ required: true }), description: str(), footerTag: str(),
}));

const Why = mongoose.model('Why', withOrder({
  title: str({ required: true }), description: str(),
}));

const Team = mongoose.model('Team', withOrder({
  badge: str(), name: str({ required: true }), role: str(), profession: str(),
  message: str(), boardId: str(), image: str(),
}));

const Crew = mongoose.model('Crew', withOrder({
  memberId: str(), name: str({ required: true }), stageName: str(), profession: str(), role: str(), department: str(), image: str(),
}));

const Media = mongoose.model('Media', withOrder({
  label: str(), caption: str({ required: true }), image: str(),
  type: { type: String, enum: ['image', 'video'], default: 'image' },
  videoUrl: str(),
}));

module.exports = { Admin, Setting, Message, Event, Value, Service, Pillar, Approach, Why, Team, Crew, Media };
