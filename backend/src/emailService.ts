/**
 * emailService.ts
 *
 * Resend-based email service for Qlarity.
 * Set RESEND_API_KEY in .env to enable.
 * Falls back to console logging in dev when key is missing.
 *
 * SWAP GUIDE (future — company SMTP):
 *   Replace the `sendEmail` internals with nodemailer.
 *   All template functions below stay exactly the same.
 */

import { logger } from './logger';

// Env vars are read lazily at call time (NOT at module load). This is required
// because route modules — which transitively import this file — may be loaded
// before dotenv.config() runs (ESM import hoisting under tsx/esbuild). Reading
// at call time guarantees dotenv has already populated process.env.
const appUrl = () => process.env.APP_URL || 'http://localhost:5173';

// ─── Base send ────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Qlarity <onboarding@resend.dev>';

  if (!apiKey) {
    logger.info(`[EMAIL — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error({ err }, '[emailService] Resend error');
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(content: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px">Qlarity</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">QA Asset Management Platform</p>
        </div>

        <!-- Body -->
        <div style="padding:32px">
          ${content}
        </div>

        <!-- Footer -->
        <div style="background:#f1f5f9;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">
            This is an automated message from Qlarity. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function button(href: string, label: string) {
  return `
    <div style="text-align:center;margin:28px 0">
      <a href="${href}"
         style="display:inline-block;background:#f59e0b;color:#ffffff;text-decoration:none;
                padding:13px 28px;border-radius:8px;font-weight:600;font-size:14px">
        ${label}
      </a>
    </div>
  `;
}

function statusBadge(label: string, color: string) {
  return `
    <div style="background:${color}15;border:1px solid ${color}40;border-radius:8px;
                padding:14px;text-align:center;margin:20px 0">
      <span style="font-size:18px;font-weight:700;color:${color}">${label}</span>
    </div>
  `;
}

// ─── 1. Welcome / Registration ────────────────────────────────────────────────
// Trigger: backoffice.ts → POST /organizations (after admin user row inserted)

export async function sendWelcomeEmail(to: string, name: string, orgName: string) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Welcome to Qlarity, ${name}! 👋</h2>
    <p style="color:#475569;line-height:1.6">
      You've been added to <strong>${orgName}</strong> on Qlarity — your team's QA asset management platform.
    </p>
    <p style="color:#475569;line-height:1.6">
      You can now upload files, collaborate on test data, and track approvals all in one place.
    </p>
    ${button(`${appUrl()}/dashboard`, 'Go to Dashboard')}
    <p style="color:#94a3b8;font-size:13px">
      If you weren't expecting this invite, you can safely ignore this email.
    </p>
  `);
  await sendEmail(to, `Welcome to Qlarity — ${orgName}`, html);
}

// ─── 2. File Submitted for Review ─────────────────────────────────────────────
// Trigger: files.ts → POST /:id/submit  AND  POST /bulk-submit
// Recipients: all leads + admins in the org

export async function sendFileSubmittedEmail(
  to: string,
  reviewerName: string,
  submitterName: string,
  fileName: string,
  fileId: number,
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">New file pending your review</h2>
    <p style="color:#475569;line-height:1.6">
      Hi ${reviewerName},
    </p>
    <p style="color:#475569;line-height:1.6">
      <strong>${submitterName}</strong> submitted the following file for review:
    </p>
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:600;color:#92400e;font-size:15px">📄 ${fileName}</p>
    </div>
    <p style="color:#475569;line-height:1.6">
      Please review and approve or return it to draft.
    </p>
    ${button(`${appUrl()}/files/${fileId}`, 'Review File')}
  `);
  await sendEmail(to, `Review requested: "${fileName}" — Qlarity`, html);
}

// ─── 3. File Approved ─────────────────────────────────────────────────────────
// Trigger: files.ts → POST /:id/approve  (when effectiveStatus === 'approved')
// Recipient: file owner

export async function sendFileApprovedEmail(
  to: string,
  ownerName: string,
  fileName: string,
  fileId: number,
  approverName: string,
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your file has been approved ✅</h2>
    <p style="color:#475569;line-height:1.6">Hi ${ownerName},</p>
    <p style="color:#475569;line-height:1.6">
      Great news! <strong>${approverName}</strong> approved your file:
    </p>
    ${statusBadge('✅ Approved', '#10b981')}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:600;color:#166534;font-size:15px">📄 ${fileName}</p>
    </div>
    ${button(`${appUrl()}/files/${fileId}`, 'View File')}
  `);
  await sendEmail(to, `Approved: "${fileName}" — Qlarity`, html);
}

// ─── 4. File Rejected / Returned to Draft ────────────────────────────────────
// Trigger: files.ts → POST /:id/approve  (when effectiveStatus === 'draft')
// Recipient: file owner

export async function sendFileRejectedEmail(
  to: string,
  ownerName: string,
  fileName: string,
  fileId: number,
  reviewerName: string,
  comment?: string,
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">File returned to draft</h2>
    <p style="color:#475569;line-height:1.6">Hi ${ownerName},</p>
    <p style="color:#475569;line-height:1.6">
      <strong>${reviewerName}</strong> returned your file to draft for revisions:
    </p>
    ${statusBadge('↩️ Returned to Draft', '#f59e0b')}
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:600;color:#92400e;font-size:15px">📄 ${fileName}</p>
    </div>
    ${comment ? `
      <div style="background:#fef2f2;border-left:3px solid #f87171;padding:12px 16px;margin:16px 0;border-radius:4px">
        <p style="margin:0;color:#7f1d1d;font-size:14px;font-style:italic">"${comment}"</p>
      </div>
    ` : ''}
    <p style="color:#475569;line-height:1.6">
      Please make the necessary changes and resubmit when ready.
    </p>
    ${button(`${appUrl()}/files/${fileId}`, 'Edit File')}
  `);
  await sendEmail(to, `Revision needed: "${fileName}" — Qlarity`, html);
}

// ─── 5. File Published ────────────────────────────────────────────────────────
// Trigger: files.ts → POST /:id/approve  (when effectiveStatus === 'published')
// Recipient: file owner

export async function sendFilePublishedEmail(
  to: string,
  ownerName: string,
  fileName: string,
  fileId: number,
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your file is now published 🚀</h2>
    <p style="color:#475569;line-height:1.6">Hi ${ownerName},</p>
    <p style="color:#475569;line-height:1.6">
      Your file has completed the approval workflow and is now published and available to your team:
    </p>
    ${statusBadge('🚀 Published', '#3b82f6')}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:600;color:#1e3a8a;font-size:15px">📄 ${fileName}</p>
    </div>
    ${button(`${appUrl()}/files/${fileId}`, 'View Published File')}
  `);
  await sendEmail(to, `Published: "${fileName}" — Qlarity`, html);
}

// ─── 6. Role Changed ──────────────────────────────────────────────────────────
// Trigger: users.ts → PUT /:id  (when role field is updated)
// Recipient: the user whose role changed

export async function sendRoleChangedEmail(
  to: string,
  userName: string,
  oldRole: string,
  newRole: string,
  orgName: string,
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Your role has been updated</h2>
    <p style="color:#475569;line-height:1.6">Hi ${userName},</p>
    <p style="color:#475569;line-height:1.6">
      Your role in <strong>${orgName}</strong> has been changed:
    </p>
    <div style="display:flex;gap:12px;margin:20px 0;align-items:center">
      <div style="flex:1;background:#f1f5f9;border-radius:8px;padding:12px;text-align:center">
        <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Previous</p>
        <p style="margin:4px 0 0;color:#0f172a;font-weight:600;font-size:15px;text-transform:capitalize">${oldRole}</p>
      </div>
      <span style="color:#94a3b8;font-size:20px">→</span>
      <div style="flex:1;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px;text-align:center">
        <p style="margin:0;color:#92400e;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">New Role</p>
        <p style="margin:4px 0 0;color:#92400e;font-weight:700;font-size:15px;text-transform:capitalize">${newRole}</p>
      </div>
    </div>
    <p style="color:#475569;line-height:1.6">
      Your permissions may have changed. Log in to see what you can access.
    </p>
    ${button(`${appUrl()}/dashboard`, 'Go to Dashboard')}
  `);
  await sendEmail(to, `Your Qlarity role changed to ${newRole}`, html);
}

// ─── 7. Password Reset ────────────────────────────────────────────────────────
// Trigger: auth.ts → POST /forgot-password

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${token}`;
  const html = layout(`
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px">Reset your password</h2>
    <p style="color:#475569;line-height:1.6">Hi ${name},</p>
    <p style="color:#475569;line-height:1.6">
      You requested a password reset. Click the button below — this link expires in <strong>1 hour</strong>.
    </p>
    ${button(link, 'Reset Password')}
    <p style="color:#94a3b8;font-size:13px">
      If you didn't request this, ignore this email. Your password won't change.
    </p>
    <p style="color:#94a3b8;font-size:12px;word-break:break-all">
      Or copy: <a href="${link}" style="color:#f59e0b">${link}</a>
    </p>
  `);
  await sendEmail(to, 'Reset your Qlarity password', html);
}
