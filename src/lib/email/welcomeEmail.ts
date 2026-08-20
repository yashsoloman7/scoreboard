// src/lib/email/welcomeEmail.ts - Resend Welcome & Role Notification Email Service
import { Resend } from 'resend';
import { AppRole } from '@/types';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface SendWelcomeEmailParams {
  toEmail: string;
  fullName?: string;
  role: AppRole;
  loginUrl?: string;
}

export async function sendWelcomeEmail({
  toEmail,
  fullName,
  role,
  loginUrl,
}: SendWelcomeEmailParams): Promise<{ success: boolean; id?: string; error?: string; simulated?: boolean }> {
  const recipientName = fullName?.trim() || toEmail.split('@')[0];
  const roleDisplay = role.replace('_', ' ').toUpperCase();
  const targetUrl = loginUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://scoreboard-eight-xi.vercel.app/auth/login';

  const roleDescriptions: Record<AppRole, string> = {
    super_admin: 'Full administrative access to manage all competitions, system settings, and user role authorizations.',
    admin: 'Manage competitions, adjudicate results, review tie-breakers, and oversee all live events.',
    event_manager: 'Control live stage execution, manage standby vs live modes, and unlock judge scoring inputs.',
    event_operator: 'Monitor performance countdown timers and assist with stage staging.',
    judge: 'Mobile & touch-optimized scoring console to evaluate live performances with SHA-256 cryptographic signatures.',
    public_viewer: 'Access public real-time scoreboards and official published standings.',
    unauthorized: 'Guest access pending role assignment.',
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to MusicScore</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #020617; color: #f8fafc; margin: 0; padding: 40px 20px;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Bar -->
          <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding: 32px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">MusicScore</h1>
            <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Digital Live Evaluation Suite</p>
          </div>

          <!-- Body Content -->
          <div style="padding: 36px 30px;">
            <p style="font-size: 16px; color: #cbd5e1; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
            
            <p style="font-size: 15px; line-height: 1.6; color: #94a3b8;">
              You have been granted access to the <strong>MusicScore Digital Judging Platform</strong>. Your account has been authorized with the following role:
            </p>

            <!-- Role Highlight Badge Card -->
            <div style="background-color: #020617; border: 1px solid #334155; border-radius: 14px; padding: 20px; margin: 24px 0; text-align: center;">
              <span style="display: inline-block; background-color: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); font-size: 13px; font-weight: 800; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
                ${roleDisplay}
              </span>
              <p style="margin: 12px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                ${roleDescriptions[role]}
              </p>
            </div>

            <!-- Login CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${targetUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #06b6d4); color: #020617; font-size: 14px; font-weight: 900; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">
                Access Evaluation Portal &rarr;
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 20px; margin-bottom: 0;">
              If you didn't expect this invitation or believe this role was assigned in error, please contact your Lead Jury Chair or Event Administrator.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #020617; border-top: 1px solid #1e293b; padding: 20px 30px; text-align: center; font-size: 11px; color: #475569;">
            &copy; ${new Date().getFullYear()} MusicScore Evaluation Engine • Powered by Supabase & Vercel
          </div>
        </div>
      </body>
    </html>
  `;

  // Fallback / Dev mode if RESEND_API_KEY is not configured
  if (!resend) {
    console.log(`[Email Service] RESEND_API_KEY not configured. Simulated Welcome Email to ${toEmail} for role: ${role}`);
    return {
      success: true,
      simulated: true,
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'MusicScore <onboarding@resend.dev>',
      to: [toEmail],
      subject: `Welcome to MusicScore - ${roleDisplay} Access Granted`,
      html: htmlContent,
    });

    if (error) {
      console.error('[Resend Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend Exception]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send email' };
  }
}
