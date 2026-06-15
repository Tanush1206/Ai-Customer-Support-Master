# Sync & the Nimbus Desktop App

The Nimbus desktop app keeps a folder on your computer in sync with your Nimbus account, so your files are always up to date across every device. This guide covers installing the app, working with the local Nimbus folder, and the sync features that give you control over what lives on your computer.

## Install the desktop app

The desktop app is available for Windows, macOS, and Linux.

1. Sign in to Nimbus on the web and download the installer for your operating system.
2. Run the installer and follow the prompts.
3. Open the app and sign in with your Nimbus account.
4. Complete the setup steps to choose where your local Nimbus folder lives.

Once setup finishes, the app runs in the background and adds an icon to your menu bar (macOS) or system tray (Windows and Linux). Use that icon to check sync status, open settings, and pause or resume sync.

## The local Nimbus folder

After installation, the app creates a folder named **Nimbus** on your computer. Anything you add to this folder is uploaded to the cloud and synced to your other devices automatically. Likewise, files you add from the web or another device appear here.

A few things to keep in mind:

- Work with files in the Nimbus folder just as you would any other folder on your computer.
- Edits, renames, moves, and deletions all sync automatically when you're online and signed in.
- Storage is shared across all your files, backups, and Nimbus Paper docs, so the Nimbus folder draws from your overall plan storage.

## Selective Sync

Selective Sync lets you choose which folders are downloaded to your computer. This is useful when you have more in the cloud than you want stored locally, or when you only need certain projects on a particular device.

To configure it:

1. Open Nimbus settings from the menu-bar or tray icon.
2. Go to the Selective Sync settings.
3. Clear the checkbox next to any folder you don't want stored on this computer.
4. Save your changes.

Folders you exclude stay safe in the cloud and remain accessible from the web and your other devices. They simply won't take up space on this computer. If a folder you expect to see is missing locally, check that Selective Sync isn't excluding it.

## Smart Sync (online-only)

Smart Sync is available on Plus and higher plans. It keeps files **online-only** until you open them, so you can see every file in your Nimbus folder without using local disk space.

- Online-only files appear in the Nimbus folder but live in the cloud until you need them.
- When you open an online-only file, Nimbus downloads it automatically.
- This lets you browse your entire account from your computer even if it wouldn't all fit on the local drive.

Smart Sync is a good complement to Selective Sync: use Selective Sync to hide folders entirely, and Smart Sync to keep files visible but lightweight.

## Pause and resume sync

You can temporarily stop syncing at any time, for example to save bandwidth during a call or a large download.

1. Click the Nimbus icon in your menu bar or system tray.
2. Choose **Pause sync**.
3. When you're ready, open the menu again and choose **Resume sync**.

Pausing and resuming is also a quick first step when something seems stuck. Toggling sync off and back on often clears up transient issues.

## LAN sync

LAN sync speeds up transfers between devices on the same local network. Instead of always routing data through the cloud, Nimbus can copy files directly between your devices over the LAN, which is typically faster for large files and shared local connections.

## Conflicted copies

When two devices edit the same file while offline, Nimbus can't automatically decide which version to keep. To avoid losing any work, it saves both versions and adds **(conflicted copy)** to one of the filenames, for example:

> `Budget.xlsx (conflicted copy)`

To resolve a conflict:

1. Open both files and compare the changes.
2. Decide which version is correct, or merge the changes into a single file.
3. Delete the copy you no longer need.

Keeping a file open in only one place at a time, and letting sync finish before switching devices, reduces how often conflicted copies appear.

## Troubleshooting sync

If files won't sync, work through these steps in order:

1. Check the tray or menu-bar icon for error messages.
2. Confirm you're online and signed in.
3. Pause sync, then resume it.
4. Make sure you have free local disk space.
5. Verify Selective Sync isn't excluding the folder.
6. Avoid illegal characters in filenames: `< > : " / \ | ? *`.
7. On Windows, keep the full file path under 260 characters.
8. Restart the app.
9. As a last resort, reinstall the app.

If a single file is stuck on **Syncing**, it's usually open or locked by another application. Close the file in any other program and let sync continue.

For current service information, check the status page at status.nimbus.example.
