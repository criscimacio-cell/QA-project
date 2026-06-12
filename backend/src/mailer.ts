import nodemailer from 'nodemailer';

const {
  SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
  EMAIL_FROM = 'Qlarity <noreply@qtamp.local>',
  APP_URL = 'http://localhost:5173',
  NODE_ENV = 'development',
} = process.env;

const hasSmtp = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

async function send(to: string, subject: string, html: string) {
  if (!hasSmtp || NODE_ENV === 'test') {
    console.log(`\n📧 [EMAIL — dev mode, no SMTP configured]\nTo: ${to}\nSubject: ${subject}\n`);
    return;
  }
  await transporter!.sendMail({ from: EMAIL_FROM, to, subject, html });
}

export async function sendPasswordReset(to: string, name: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  console.log(`\n🔑 Password Reset Link (dev): ${link}\n`);
  await send(to, 'Reset your Qlarity password', `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:linear-gradient(135deg,#08a49c,#06b6d4);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:22px">Qlarity</h1>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0">QA Asset Platform</p>
      </div>
      <h2 style="color:#0f172a">Hi ${name},</h2>
      <p style="color:#475569">You requested a password reset. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#08a49c,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px">
          Reset Password
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px">
        Or copy this link: <a href="${link}" style="color:#08a49c">${link}</a>
      </p>
    </div>
  `);
}

export async function sendApprovalNotification(to: string, name: string, fileName: string, status: string) {
  const statusLabel: Record<string, string> = {
    approved: '✅ Approved', published: '🚀 Published',
    under_review: '👀 Under Review', draft: '↩️ Returned to Draft',
  };
  await send(to, `File ${statusLabel[status] || status} — Qlarity`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:linear-gradient(135deg,#08a49c,#06b6d4);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:22px">Qlarity</h1>
      </div>
      <h2 style="color:#0f172a">Hi ${name},</h2>
      <p style="color:#475569">Your file <strong>"${fileName}"</strong> status has been updated to:</p>
      <div style="background:#f0fdfc;border:1px solid #99f6e4;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
        <span style="font-size:20px;font-weight:700;color:#0d9488">${statusLabel[status] || status}</span>
      </div>
      <p style="color:#94a3b8;font-size:13px">Log in to Qlarity to view the full details.</p>
    </div>
  `);
}

export async function sendUploadNotification(to: string, reviewerName: string, uploaderName: string, fileName: string) {
  await send(to, `New file pending review — Qlarity`, `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <div style="background:linear-gradient(135deg,#08a49c,#06b6d4);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:#fff;margin:0;font-size:22px">Qlarity</h1>
      </div>
      <h2 style="color:#0f172a">Hi ${reviewerName},</h2>
      <p style="color:#475569"><strong>${uploaderName}</strong> submitted <strong>"${fileName}"</strong> for your review.</p>
      <p style="color:#94a3b8;font-size:13px">Log in to Qlarity to review and approve.</p>
    </div>
  `);
}
