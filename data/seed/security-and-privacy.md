# Security & Privacy at Nimbus

Nimbus is built to keep your files, Nimbus Paper docs, and Vault safe across every device you use — Web, Desktop (Windows, macOS, Linux), and Mobile (iOS, Android). This guide walks you through the security features you control: two-factor authentication, encryption, single sign-on, active sessions, and remotely signing out or wiping a device.

## How Nimbus protects your data

Nimbus encrypts your data both while it's stored and while it's moving:

- **At rest:** Files are encrypted with **AES-256**.
- **In transit:** Data is protected with **TLS 1.2 or higher** as it travels between your devices and Nimbus.

This protection applies automatically to everything you store, including your files, backups, and Nimbus Paper docs — there's nothing to turn on.

## Set up two-factor authentication (2FA)

Two-factor authentication adds a second step when you sign in, so your account stays protected even if your password is exposed. Nimbus supports three methods:

- **Authenticator app (TOTP)** — generates time-based codes in an app on your phone.
- **SMS** — sends a code to your phone number by text message.
- **Hardware security key (FIDO2)** — a physical key you tap or insert.

### Authenticator app (TOTP)

1. Go to **Settings → Account**.
2. Find the two-factor authentication section and choose **Authenticator app**.
3. Scan the on-screen QR code with your authenticator app.
4. Enter the 6-digit code your app generates to confirm.
5. Save your backup codes (see below).

### SMS

1. Go to **Settings → Account** and choose **SMS** as your 2FA method.
2. Enter the phone number where you want to receive codes.
3. Enter the verification code we text you to confirm the number.
4. Save your backup codes.

### Hardware security key (FIDO2)

1. Go to **Settings → Account** and choose **Security key**.
2. When prompted, insert or tap your FIDO2-compatible key.
3. Follow the prompt to register the key with your account.
4. Save your backup codes.

### Backup codes

When you turn on 2FA, Nimbus gives you a set of **backup codes**. These let you sign in if you ever lose access to your phone or security key.

- Store them somewhere safe and separate from your password (for example, a password manager or a printed copy).
- Each code works once. If you run low, you can regenerate a new set from the two-factor settings.

## Sign in with SSO/SAML

Single sign-on lets your team sign in to Nimbus through your organization's identity provider using **SAML**. SSO/SAML is available on **Business and Enterprise** plans. Enterprise additionally supports **SCIM provisioning** to automatically create and manage user accounts.

If your organization uses SSO, your admin configures it in the Admin console, and you'll sign in through your company's login page rather than entering a separate Nimbus password.

## Manage active sessions and devices

You can see everywhere your account is currently signed in and take action if something looks unfamiliar. From **Settings**, open device management to:

- **View active sessions** — see the devices and browsers signed in to your account.
- **Remote sign-out** — end a session on any device remotely, which is useful if you lose a phone or laptop or forget to sign out on a shared computer.

After a remote sign-out, that device will need to sign in again — and with 2FA enabled, it'll also need a second factor.

### Remote wipe (Business)

On **Business** plans, admins can perform a **remote wipe of the Nimbus folder** on a device. This removes the synced contents of the local Nimbus folder from a device that's been lost, stolen, or is no longer authorized — an important safeguard for company data.

## Account access and recovery

Keeping your sign-in details current is part of good account security.

### Reset your password

1. On the sign-in page, select **Forgot password**.
2. Enter your email address to receive a reset link.
3. Open the link and choose a new password. The reset link is valid for **60 minutes**, so use it promptly. If it expires, request a new one.

### Change your email address

1. Go to **Settings → Account** and update your email.
2. Confirm the change from **both** your old and new email addresses to complete it.

## Restricting integrations (Business)

If your team connects third-party tools such as Slack, Google Workspace, Microsoft 365, Zoom, or Zapier, **Business admins can restrict which integrations are allowed** for the team. You and your team manage your own connections under **Settings → Integrations**.

## Deleting your account

If you decide to leave Nimbus, you can remove your account and data:

1. Go to **Settings → Account → Delete**.
2. Confirm the deletion.

There's a **30-day grace period** before your data is permanently erased, which gives you time to change your mind. Note that accounts **cannot be merged** — if you need to consolidate, transfer files through a shared folder instead.

## Quick security checklist

- Turn on 2FA and save your backup codes somewhere safe.
- Review your active sessions periodically and sign out any device you don't recognize.
- Use a strong, unique password and keep your email address up to date for recovery.
- On Business plans, rely on SSO/SAML, admin-managed integrations, and remote wipe to protect team data.

For service status, visit the status page at **status.nimbus.example**. If you need help, Free, Plus, and Family customers can reach us by email and chat (24–48h), Business customers get priority support, and Enterprise customers have phone support and a dedicated Customer Success Manager.
