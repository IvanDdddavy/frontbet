import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_reset_email(to_email: str, reset_url: str, username: str) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Сброс пароля — ТТК Эфирная платформа"
    msg["From"]    = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM}>"
    msg["To"]      = to_email

    text_body = f"""Здравствуйте, {username}!

Вы запросили сброс пароля для вашего аккаунта на ТТК Эфирной платформе.

Перейдите по ссылке для создания нового пароля:
{reset_url}

Ссылка действительна 2 часа.

Если вы не запрашивали сброс пароля — проигнорируйте это письмо.

С уважением,
Команда ТТК Эфирной платформы
"""

    html_body = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F0F0F0;font-family:'PT Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F0F0;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#181818;padding:24px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="display:inline-block;">
              <tr>
                <td style="border:2.5px solid #E3001B;border-radius:5px;padding:4px 8px;transform:rotate(-8deg);display:inline-block;">
                  <span style="font-family:'PT Sans Narrow',Arial,sans-serif;font-weight:700;font-size:16px;color:#E3001B;letter-spacing:-.5px;">ТТК</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="font-family:'PT Sans Narrow',Arial,sans-serif;font-size:14px;color:#ffffff;letter-spacing:.06em;">ТРАНСТЕЛЕКОМ</span><br>
                  <span style="font-size:11px;color:rgba(255,255,255,.4);">Эфирная платформа</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <h1 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 12px;">Сброс пароля</h1>
            <p style="font-size:14px;color:#3D3D3D;line-height:1.6;margin:0 0 8px;">
              Здравствуйте, <strong>{username}</strong>!
            </p>
            <p style="font-size:14px;color:#3D3D3D;line-height:1.6;margin:0 0 24px;">
              Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль.
              Ссылка действительна <strong>2 часа</strong>.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:#E3001B;border-radius:8px;">
                  <a href="{reset_url}"
                     style="display:inline-block;padding:13px 28px;font-family:'PT Sans Narrow',Arial,sans-serif;
                            font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;
                            letter-spacing:.06em;text-transform:uppercase;">
                    Сбросить пароль
                  </a>
                </td>
              </tr>
            </table>

            <!-- Fallback link -->
            <p style="font-size:12px;color:#747474;line-height:1.5;margin:0 0 16px;">
              Если кнопка не работает, скопируйте ссылку в браузер:<br>
              <a href="{reset_url}" style="color:#E3001B;word-break:break-all;">{reset_url}</a>
            </p>

            <hr style="border:none;border-top:1px solid #E2E2E2;margin:20px 0;">
            <p style="font-size:12px;color:#ABABAB;margin:0;">
              Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
              Ваш пароль останется прежним.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F7F7F7;padding:16px 32px;border-top:1px solid #E2E2E2;">
            <p style="font-size:11px;color:#ABABAB;margin:0;text-align:center;">
              © ТТК Эфирная платформа · Письмо отправлено автоматически
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


async def send_reset_email(to_email: str, token: str, username: str) -> bool:
    """
    Send password reset email. Returns True on success.
    Falls back to logging the URL if SMTP is not configured (dev mode).
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        # Dev mode — log URL instead of sending
        logger.warning(
            f"[EMAIL DEV MODE] Reset URL for {username} ({to_email}):\n{reset_url}"
        )
        # Print to stdout so it's visible in Docker logs
        print(f"\n{'='*60}")
        print(f"[DEV] Password reset link for '{username}':")
        print(f"  {reset_url}")
        print(f"{'='*60}\n")
        return True

    try:
        import aiosmtplib
        msg = _build_reset_email(to_email, reset_url, username)
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
            timeout=10,
        )
        logger.info(f"Reset email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send reset email to {to_email}: {e}")
        return False
