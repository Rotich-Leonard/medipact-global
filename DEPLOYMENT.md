# Deployment checklist — MedImpact Global

This is a Node.js + Express + MongoDB application. Deploy it as a **Node web service**, not as a static-only site.

## Before deployment

1. Create a MongoDB Atlas database and a dedicated database user. Allow network access only from your hosting provider's outbound IPs when available; avoid `0.0.0.0/0` unless you understand the risk and have compensating controls.
2. In the hosting provider's environment-variable settings, configure:
   - `NODE_ENV=production`
   - `PORT` (usually supplied by the host)
   - `MONGODB_URI` (Atlas connection string)
   - `JWT_SECRET` (unique random value; at least 48 random bytes recommended)
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD` (unique, strong password, 10+ characters)
   - `APP_URL` (public HTTPS URL, no trailing slash)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` if email sending is needed
   - `MAIL_TO` if desired
3. Do not upload `.env` to GitHub. Enter production values directly into the host's secret/environment settings.
4. Build/start command: `npm install` / `npm start`. Node.js 18+ is required.
5. After deployment, run `npm run seed` once from the host's shell or a one-off job if the database is empty. Do not run `npm run seed:reset` against production unless you intentionally want to replace seeded content.
6. Test the public website, `/api/site`, admin login at `/admin/`, contact form, password reset/invitations, and SMTP delivery.

## Persistent uploads

Uploaded media is deliberately excluded from this GitHub source package. The `.gitignore` excludes runtime files in `uploads/`. Many hosts use temporary filesystems, so configure a persistent disk/volume mounted at the app's `uploads` directory, or update the application to use object storage such as S3 or Cloudinary. Without persistent storage, admin-uploaded media may disappear on redeploy/restart.

## Security

- Use HTTPS.
- Use a unique production `JWT_SECRET` and strong initial admin password.
- Rotate any credentials that were ever placed in a shared ZIP, Git commit, screenshot, or public repository.
- Keep environment secrets in the hosting provider's secret settings.
- Do not commit database exports, private keys, `.env` files, or user/customer data.
- Restrict the MongoDB database user's permissions and network access.
