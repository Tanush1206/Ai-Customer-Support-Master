# Resolved Support Tickets — Sync & Technical

This article collects five real, resolved support tickets about sync and technical issues with the Nimbus desktop app. Each entry describes the customer's issue and the resolution our team used, so you can apply the same steps if you run into something similar.

If your problem isn't covered here, you can reach us by email or chat (Free, Plus, and Family plans, typically 24–48 hours), priority support on Business, or phone and a dedicated Customer Success Manager on Enterprise. You can also check current service health at status.nimbus.example.

## Ticket #4812 — A file is stuck on "Syncing"

### Customer issue
The customer reported that a single spreadsheet in their Nimbus folder had been stuck on "Syncing" for hours. Every other file synced normally, but this one would not finish, and the tray icon showed a sync-in-progress spinner that never cleared.

### Resolution
A file stuck on "Syncing" almost always means the file is still open or locked by another application. We walked the customer through the following:

1. Close any app that has the file open (for a spreadsheet, that's typically the editor itself).
2. Open the menu-bar or tray icon and check for a specific error next to the file.
3. Pause sync, wait a few seconds, then resume sync from the same menu.
4. Confirm there's enough free local disk space for the file.
5. If it's still stuck, restart the desktop app.

Once the spreadsheet was closed in the editor, the lock was released and the file finished syncing immediately.

## Ticket #4937 — "(conflicted copy)" files keep appearing

### Customer issue
The customer found several files named "filename (conflicted copy)" in a shared folder and wasn't sure which version was correct or why they were being created.

### Resolution
Conflicted copies are created when two devices edit the same file offline and then both come back online — Nimbus keeps both versions instead of overwriting your work. To resolve them:

1. Open the original file and the "(conflicted copy)" version side by side and compare the contents.
2. Copy any changes you want to keep from the conflicted copy into the original file.
3. Delete the "(conflicted copy)" file once you've merged the changes.

We also reminded the customer that file version history is available (180 days on Plus and Family, 365 days on Business, 30 days on Free) if they need to recover an earlier version. To avoid future conflicts, edit a file on one device at a time and let it finish syncing — watch for the green checkmark in the tray — before editing it elsewhere.

## Ticket #5104 — A folder disappeared after using Selective Sync

### Customer issue
The customer said an entire folder had "vanished" from their Nimbus folder on their laptop. The files were still visible on the web, so nothing was actually deleted — they just weren't on the computer anymore.

### Resolution
This is the expected result of Selective Sync, which lets you choose which folders sync to a particular device. When a folder is excluded, it stays safely in your account and on the web but is removed from that computer's local Nimbus folder. We had the customer:

1. Open the desktop app menu from the tray or menu-bar icon.
2. Go to Selective Sync settings.
3. Re-enable the folder that was missing.
4. Wait for it to download back into the local Nimbus folder.

The folder reappeared once Selective Sync was set to include it again. We noted that Smart Sync (available on Plus and above) is a good alternative when local disk space is the concern, since it keeps files online-only until you open them rather than removing the folder entirely.

## Ticket #5260 — Desktop app won't start

### Customer issue
The customer reported that the Nimbus desktop app wouldn't launch at all. There was no tray icon and no window, and sync had stopped on that machine.

### Resolution
We worked through the standard startup checklist:

1. Confirm the computer is online and that you're signed in.
2. Fully quit any lingering Nimbus process and restart the app.
3. Confirm there's adequate free local disk space.
4. Restart the computer to clear any stuck process.
5. As a last resort, uninstall and reinstall the desktop app — reinstalling does not delete your files, which stay safe in your account.

In this case, a clean reinstall restored the app. After signing back in, the local Nimbus folder re-synced normally.

## Ticket #5388 — Uploads are very slow

### Customer issue
The customer reported that uploads from the desktop app were crawling, even on a connection that was otherwise fast.

### Resolution
We checked a few common causes of slow transfers:

1. Confirm you're online and signed in, and check the tray icon for any errors.
2. Pause and resume sync to restart the transfer queue.
3. Make sure another app isn't saturating your connection.
4. Enable LAN sync, which speeds up transfers between your own devices on the same local network.

We also confirmed there were no illegal characters in the filenames (`< > : " / \ | ? *`) and that file paths on Windows stayed under 260 characters, since either issue can stall syncing. After enabling LAN sync and resuming, transfer speeds returned to normal.

## Related sync troubleshooting tips

If files won't sync in general, this quick checklist resolves most cases:

- Check the tray icon for specific errors.
- Confirm you're online and signed in.
- Pause and resume sync.
- Ensure you have free local disk space.
- Check that Selective Sync isn't excluding the folder.
- Avoid illegal filename characters (`< > : " / \ | ? *`).
- Keep Windows paths under 260 characters.
- Restart the app, and reinstall only as a last resort.

Deleted files can be recovered from Trash within your plan's retention window (30 days on Free, Plus, and Family; 365 days on Business). For anything these steps don't fix, contact support through the channel for your plan.
