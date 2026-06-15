# Fixing Sync Problems

When the Nimbus desktop app is working correctly, the files in your local **Nimbus** folder stay in step with your account across every device. If a file isn't showing up, gets stuck part-way, or turns into a "conflicted copy," this guide walks you through the fixes in the order most likely to help.

Before you start, glance at the **tray icon** (Windows/Linux) or **menu-bar icon** (macOS). It shows the current sync status and surfaces specific error messages that often point straight to the cause.

## Files Won't Sync

If one or more files aren't reaching your other devices or the web, work through these steps in order. Most sync problems are resolved within the first few.

1. **Check the tray (or menu-bar) icon for errors.** Open the Nimbus menu and read any error or warning shown. The message frequently names the exact file or reason.
2. **Confirm you're online and signed in.** Verify your internet connection, then make sure you're still signed in to the desktop app with the correct account.
3. **Pause and resume sync.** From the tray/menu-bar icon, pause sync, wait a moment, then resume it. This restarts the sync engine and clears many temporary stalls.
4. **Make sure you have free local disk space.** Sync needs room to write files to the **Nimbus** folder. If your drive is nearly full, free up space and try again.
5. **Check Selective Sync.** Confirm the folder you're expecting isn't excluded. Open Selective Sync settings and ensure the folder is selected to sync locally.
6. **Look for illegal filename characters** (see below).
7. **Check the path length on Windows** (see below).
8. **Restart the app.** Quit Nimbus completely and reopen it.
9. **Reinstall as a last resort** (see below).

### Stuck on "Syncing"

If a single file sits at **"Syncing"** and never finishes, the file is usually **open or locked by another application**. For example, a spreadsheet or document held open by another program can't be uploaded until it's released.

To clear it:

1. Close any application that may have the file open.
2. Give Nimbus a moment to finish uploading.
3. If it's still stuck, pause and resume sync, then restart the app.

## Conflicted Copies

A **conflicted copy** is created when the same file is edited offline on two different devices at the same time. Because Nimbus can't safely merge those independent changes, it keeps both versions instead of overwriting one. The extra file is named with **"(conflicted copy)"** added to the filename.

When you see a conflicted copy:

1. Open both the original file and the version labeled **"(conflicted copy)"**.
2. Compare them and decide which changes you want to keep. You may need to copy edits from one into the other to combine them.
3. Once the correct version is complete, delete the copy you no longer need.

To reduce future conflicts, let a file finish syncing before opening and editing it on another device, especially after working offline.

## Illegal Filename Characters

Some characters can't be used in filenames and will stop a file from syncing. Avoid these characters in file and folder names:

```
< > : " / \ | ? *
```

If a file won't sync, check its name (and the names of the folders it lives in) for any of these characters. Rename the file to remove them, then let sync run again.

## Windows Path Length

On Windows, the full path to a file — the drive, every folder name, and the filename combined — **must stay under 260 characters**. If a file is buried deep in nested folders with long names, it can exceed this limit and fail to sync.

To fix this:

1. Shorten long folder or file names along the path.
2. Move the file (or its parent folder) closer to the top of your **Nimbus** folder so the overall path is shorter.
3. Let sync run again.

## Reinstalling the Desktop App

Reinstalling is a **last resort** for sync problems that none of the steps above resolve. Your files live in your Nimbus account in the cloud, so removing and reinstalling the app does not delete them — they download again after you sign back in.

1. Sign out of the Nimbus desktop app if you can.
2. Uninstall the app for your operating system.
3. Download and install the latest version of the Nimbus desktop app.
4. Sign in with your account.
5. Reconfigure **Selective Sync** if you only want certain folders stored locally.

After reinstalling, allow time for your files to download and sync fully before checking whether the problem is resolved.

## A Few Things That Help

- **Selective Sync** lets you choose exactly which folders sync to this computer, which is useful if you only need a subset of your files locally.
- **Smart Sync** (available on Plus and higher) keeps files online-only until you open them, saving local disk space.
- **LAN sync** speeds up transfers between your devices on the same local network.
- You can **pause and resume sync** at any time from the tray or menu-bar icon.

## Still Need Help?

If sync problems continue after working through this guide, reach out to support. Free, Plus, and Family plans include email and chat support (typical response 24–48 hours); Business plans include priority support; Enterprise plans include phone support and a dedicated Customer Success Manager.

You can also check current service status at **status.nimbus.example** to confirm there are no ongoing issues affecting sync.
