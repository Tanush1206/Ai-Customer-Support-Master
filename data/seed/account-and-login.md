# Account & Login Help

Trouble getting into your Nimbus account, or need to update your sign-in details? This guide walks through resetting your password, changing your email, fixing sign-in problems, deleting your account, and explains why accounts can't be merged.

## Reset or forgot your password

If you can't remember your password, you can reset it from the sign-in screen.

1. On the Nimbus sign-in page, select **Forgot password**.
2. Enter the email address associated with your account.
3. Check your inbox for the password-reset email and open the link inside it.
4. Choose a new password and confirm it.
5. Sign in with your new password.

A few things to know:

- The reset link is valid for **60 minutes**. If it expires, return to the sign-in page and request a new one.
- If the email doesn't arrive, check your spam or junk folder and confirm you entered the correct address.
- For extra protection, consider turning on two-factor authentication (2FA) once you're back in. Nimbus supports an authenticator app (TOTP), SMS, or a hardware security key (FIDO2), and provides backup codes you can store safely.

## Change your email address

You can update the email tied to your Nimbus account from your settings. For security, the change must be confirmed from **both** your old and new addresses.

1. Go to **Settings → Account**.
2. Find your email address and select the option to change it.
3. Enter your new email address.
4. Open the confirmation message sent to your **old** address and confirm the change.
5. Open the confirmation message sent to your **new** address and confirm it as well.

Once both confirmations are complete, your new email becomes your sign-in address. Be sure you have access to both inboxes before you start.

## Can't sign in?

If you're having trouble signing in, work through these checks:

- **Double-check your email and password.** Confirm there are no typos and that Caps Lock is off. Passwords are case-sensitive.
- **Reset your password** if you're unsure it's correct. See the steps above. Remember the reset link is only valid for 60 minutes.
- **Have your 2FA method ready.** If you've enabled two-factor authentication, you'll need your authenticator app code, SMS code, or hardware security key. If you can't access your usual method, use one of your **backup codes**.
- **Try another platform.** Nimbus works on the web, the desktop app (Windows, macOS, Linux), and mobile (iOS, Android). If one isn't loading, try signing in through the web to narrow down the issue.
- **Check active sessions and devices.** Once signed in elsewhere, you can review active sessions and remotely sign out of devices from your account settings.

### Single sign-on (SSO)

If your organization uses SSO/SAML, available on Business and Enterprise plans, sign in through your organization's identity provider rather than with a Nimbus password. If SSO isn't working, contact your Nimbus administrator.

### Still stuck?

If none of the above gets you in, reach out to support:

- **Free, Plus, and Family** plans include email and chat support, with responses typically in 24-48 hours.
- **Business** plans include priority support.
- **Enterprise** plans include phone support and a dedicated Customer Success Manager.

You can also check the Nimbus status page at **status.nimbus.example** to confirm there are no ongoing service issues.

## Delete your account

If you no longer want a Nimbus account, you can delete it from your settings.

1. Go to **Settings → Account**.
2. Select **Delete**.
3. Follow the prompts to confirm.

### The 30-day grace period

After you request deletion, your account enters a **30-day grace period** before it is permanently erased. This window gives you time to change your mind. If you sign back in during those 30 days, you can recover your account before erasure takes place.

Before you delete, keep in mind:

- Make sure you've saved or moved anything you want to keep, including files, backups, and Nimbus Paper docs, since storage is shared across all of them.
- Once the 30-day grace period ends, erasure is permanent and your data cannot be recovered.

## Why accounts can't be merged

A common request is to combine two Nimbus accounts into one. **Accounts cannot be merged.** There's no way to consolidate the files, settings, or history from two separate accounts into a single account.

If you have content spread across two accounts and want it in one place, move the files using a shared folder instead:

1. From the account that has the files, create a shared folder and add the files you want to move.
2. Share that folder with the email address of the account you want to keep.
3. From the receiving account, accept the share and copy the files into your own Nimbus folder.
4. You can also **transfer ownership** of a folder to the other account from **Manage access**.

This lets you bring everything together in the account you plan to keep without needing to merge the accounts themselves.

## Keeping your account secure

A few habits help protect your account going forward:

- Turn on two-factor authentication and store your backup codes somewhere safe.
- Review your active sessions periodically and remotely sign out of any devices you no longer use.
- Use a strong, unique password that you don't reuse elsewhere.

Your data is protected with AES-256 encryption at rest and TLS 1.2+ in transit, so your files stay secure while stored and while syncing.
