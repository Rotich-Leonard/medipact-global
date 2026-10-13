# MedImpact Global – Website + Admin (Node.js · Express · MongoDB)

A full-stack build of the "Clinical Drama Broadcast" design you supplied.

- **Public website** – `/` (Tailwind, same design tokens/fonts as the mock-up, rendered from MongoDB)
- **REST API** – `GET /api/site`, `POST /api/contact`
- **Web admin** – `/admin/` (login, edit all page text, manage events / board / crew / gallery / values / disciplines / pillars / stages, upload images, read contact-form messages, change password)

## 1. Requirements
- Node.js 18+
- A MongoDB database (local install, Docker, or a free MongoDB Atlas cluster)

## 2. Setup
```bash
npm install
cp .env.example .env        # then edit .env
```
Edit `.env`:
| Variable | Meaning |
|---|---|
| `MONGODB_URI` | e.g. `mongodb://127.0.0.1:27017/medimpact` or your Atlas string |
| `JWT_SECRET` | long random string – generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin login (password ≥ 10 chars) |

Local MongoDB with Docker: `docker run -d -p 27017:27017 --name mongo mongo:7`

### Contact-form email (SMTP)
When a visitor presses **Send Message**, the enquiry is saved in MongoDB **and** emailed to your chosen inbox.
1. Set the recipient in **Admin → Page text → Contact & footer → "Send contact-form messages to this email"** (falls back to `MAIL_TO`, then the public contact email).
2. Fill in `SMTP_USER` and `SMTP_PASS` in `.env`. For Gmail use an **App Password** (not your normal password): Google Account → Security → 2-Step Verification → App passwords. Other providers (Zoho, Outlook, SendGrid, Mailgun…) work with their SMTP host/port.
3. Restart the server. The Messages page in the admin shows whether each message was forwarded. Replying to the email goes straight to the sender (Reply-To).

## 3. Load the starter content + create the admin
```bash
npm run seed
```
This imports all text/images from your design into MongoDB and creates the admin account from `.env`.
(`npm run seed:reset` wipes the content collections and re-imports.)

## 4. Run
```bash
npm start        # or: npm run dev  (auto-restart)
```
- Website → http://localhost:3000
- Admin → http://localhost:3000/admin/

## Using the admin
- **Company logo** – *Page text → Brand → Company logo* (PNG/WEBP/JPG). It replaces the header icon, the footer and the browser-tab icon.
- **Hero slideshow** – *Page text → Hero → Background slideshow photos*: add as many photos as you like; they fade and slowly zoom in sequence.
- **Social links** – *Page text → Contact & footer → Social links*: paste each page URL (e.g. `https://instagram.com/yourhandle`); the button opens it in a new tab. Empty URLs stay greyed out.
- **Page text** (sidebar) – hero, about, flagship, contact details, footer, SEO title/description, WhatsApp number, social links.
- **Content** – add / edit / delete / hide (unpublish) items and set their display order. Events with the same *Filter category* share a filter button on the site.
- **Images** – paste a URL or press *Upload image* (JPG/PNG/WEBP/GIF/AVIF, max 6 MB). Uploads are saved in `/uploads`.
- **Messages** – everything submitted through the website contact form.

> The starter images are hot-linked from the original design export (Google-hosted). Replace them with your own uploads for production.

## Project layout
```
server.js            Express app, security headers, static hosting
models/index.js      Mongoose models (Admin, Setting, Message, Event, Team, Crew, Media, …)
routes/public.js     Public API (site content, contact form)
routes/auth.js       Admin login / logout / change password
routes/admin.js      Admin CRUD, settings, messages, uploads
middleware/auth.js   JWT cookie auth + CSRF header check
seed/                Starter content (seed-data.json) + seed script
public/              Website (index.html, js/app.js) and admin SPA (admin/)
uploads/             Uploaded images
```

## Security notes
- Passwords hashed with bcrypt; session is a JWT in an **httpOnly, SameSite=Strict** cookie (`Secure` in production).
- Login is rate-limited (10 / 15 min); contact form is rate-limited and has a honeypot field.
- Admin write requests require an `X-Requested-With` header (CSRF defence in depth).
- Helmet security headers + Content-Security-Policy; all dynamic content is HTML-escaped; link URLs are scheme-checked.
- Uploads: image MIME types only, random file names, 6 MB limit.
- **Deploying:** use HTTPS, set `NODE_ENV=production`, use a strong `JWT_SECRET`, and put the app behind a reverse proxy (Nginx, Render, Railway, etc.). For a persistent host, mount `/uploads` on a volume (or swap multer's disk storage for S3/Cloudinary).
- The design loads Tailwind from its CDN (as in your mock-up). For a high-traffic production site, compile Tailwind locally and drop the CDN script.


---
## Update notes – events media, admin accounts, SMTP

### Events & Highlights: photos, video clips and live streams
Admin → Content → **Events & Highlights** → *Edit / Add*. Pick the **Event type**:
- **photo** – cover photo plus optional *Extra photos*. Clicking the card opens a full-screen slideshow (arrow keys / swipe buttons).
- **video** – *Upload a video clip* (MP4 recommended, up to `MAX_VIDEO_MB`, default 150 MB) **or** paste a YouTube / Vimeo / Facebook link. It plays in a pop-up player on the site.
- **live** – paste the link of a stream you started on **YouTube Live, Facebook Live or Vimeo** and set **Live status**: `upcoming` → `live` (pulsing LIVE NOW badge, card moves to the front) → `ended` (REPLAY badge).
  *The site embeds streams; it does not itself receive camera/RTMP feeds.*
Visitors also get "Videos" and "Live" filter buttons automatically.

### Admin accounts
- **Admin → Account → Admin users**: add a new admin. Leave the password blank to email them an invitation link (valid 48 h) so they choose their own password. You can also *Send reset link* to anyone, or delete an admin (you cannot delete yourself or the last admin).
- **Forgot password?** on the login page: enter the email on the admin profile and a single-use reset link (valid 1 h) is emailed. Resetting signs out all other sessions.
- **My profile**: change your name/email (the email receives reset links; changing it needs your current password).
- Set `APP_URL` in `.env` so the emailed links point to your real domain. Email requires SMTP (below).

### SMTP (email) settings
**Admin → Inbox → Email (SMTP)**: pick a preset (Gmail, Outlook/365, Zoho, SendGrid, Mailgun) or enter your own host, port, username and password, then press **Send test email**. The password is stored AES-encrypted in MongoDB and never sent back to the browser. Values saved here override the `SMTP_*` lines in `.env` (which still work as a fallback).
Contact-form submissions are emailed to the address in *Page text → Contact & footer → "Send contact-form messages to this email"*.
