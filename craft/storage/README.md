# Craft Storage Manager

**URL:** https://princejona.me/craft/storage/

## Implemented

- Browser storage usage/quota and OPFS inventory, with counts by editor.
- Persistent-storage permission request where available.
- Google Identity Services OAuth 2.0 *token* flow with **drive.file** only.
- Manually create versioned Google Drive snapshots under **Craft Studio Backups**.
- Chunked/resumable transfer for large media files (8 MiB transfer chunks).
- Separate manifest file uploaded LAST, so interrupted snapshots never appear as restorable.
- Browse completed snapshots and restore each recorded file back into OPFS.
- Streaming restoration with file-size validation; no automatic deletion or bulk wipe.
- Back up matching namespaced localStorage preferences where found.
- Google tokens live only in page memory (not localStorage, cookies or repository).
- Reserved UI for R2 and Supabase; neither provider is connected yet.

### Exactly what is backed up

| Tool | Browser OPFS folders |
| --- | --- |
| LightCraft | `library/`, `originals/`, `thumbs/` |
| FilmCraft | `recovery/`, `media/` |
| EffectCraft | `config/`, `files/` |

All apps use the **same site origin**, so those directories are recognized by name. Other origin directories, including unrelated project data, are not intentionally included. Changes to the upstream apps' persistence layout require updating the folder allowlist in `app.js`.

**Limitations of v1:** The automatic manager covers *OPFS only*. If an editor stores its files using its IndexedDB fallback or in-memory mode, this manager will not back them up. Use the editor's built-in export/backup facility for those browsers. OS-native file handles and reconnect permissions cannot be restored through OPFS. Close all editor windows before backing up and restoring. Restoring overwrites matching local files; it does not delete unmatched old files. Not a continuous sync service.

## Activate Google Drive on princejona.me

The website **cannot connect until an OAuth Web client ID exists**. The client ID is a public identifier; there should never be a client **secret** in the GitHub Pages repository.

1. In [Google Cloud Console](https://console.cloud.google.com/), select the project that should own the site's OAuth integration.
2. [Enable Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com).
3. Configure Google Auth Platform branding, audience and the non-sensitive `https://www.googleapis.com/auth/drive.file` scope. Add Google accounts to the test-user list while in testing mode. Publish/verify as Google requires for broader access.
4. Create an **OAuth Client ID → Web application** with an **Authorized JavaScript origin** of `https://princejona.me`. Optional local testing origin: `http://localhost:8765`. GIS token flow doesn't need a redirect endpoint.
5. Put the public client ID in `craft/storage/config.js` as `googleOAuthClientId`, commit and let GitHub Pages deploy. For testing on a single browser, paste the ID into the Storage Manager's settings input; it saves a **client ID only**, not a token.
6. Visit https://princejona.me/craft/storage/, choose **Connect Google Drive**, authorize, create a small test project, back it up, then test restoration in a fresh browser profile.

### Operational model

- Backups are manually initiated; OAuth user interaction is required when the token expires. Static GitHub Pages has no secure token exchange or refresh-token server. **No unattended daily sync is promised**.
- Drive creates one root folder `Craft Studio Backups` and one child folder per timestamped snapshot. The last file in each snapshot is `manifest.json`, which contains logical file paths, Drive IDs, sizes, editor membership, and optional namespaced preferences.
- If a backup fails, its incomplete Drive folder may remain (consuming some Drive space). It is deliberately excluded from the restore list because it lacks a complete manifest; the user may delete it from Google Drive.
- Imported photos and videos count toward the user's Google Drive quota. No content is uploaded anywhere else.
- Selecting **Disconnect** revokes the current token when possible and hides backup history. It never deletes backup files.
- Users can restore on a second computer by signing in with the **same Google account and same website OAuth client** and selecting a snapshot.
- Cloudflare R2 and Supabase are **planned**, not configured, and have no credentials in the repository.

## Test checklist

- Open each standalone editor and confirm the `☁ Storage` link opens a new tab.
- Add a photo in LightCraft, video in FilmCraft, and save a project in EffectCraft; confirm expected OPFS directories and sizes after closing editor tabs.
- Refresh the Storage Manager; request persistent-storage protection where available.
- Sign in to Google Drive and back up each tool. Check that completed snapshots appear.
- Restore in a *fresh browser profile*, check imported media and project state after reopening each app, and confirm old unmatched files were not deleted.
- Try failed connection, popup blocked, expired token, interrupted upload, and partially filled snapshot folder.
- Confirm there are no OAuth secrets/tokens in source control or browser persistent storage.
