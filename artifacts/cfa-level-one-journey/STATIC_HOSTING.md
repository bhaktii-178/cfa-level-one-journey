# Free static hosting with GitHub Pages

This site is a client-only React app. The GitHub Actions workflow builds it as static HTML, CSS, JavaScript, PDFs, and extracted reading text. By default, study progress stays in the visitor's browser `localStorage`. Optional Firebase Authentication + Cloud Firestore sync shares one private tracker snapshot across signed-in devices; no custom server or paid Replit deployment is required.

## Publish

1. Push the project to a GitHub repository on the `main` branch.
2. For GitHub Free, the repository must be public. The deployed site and its bundled Schweser files/text will also be public.
3. In GitHub, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
4. Push to `main` or run **Deploy CFA study website to GitHub Pages** from the Actions tab.

The workflow builds with the repository subpath and includes a `404.html` fallback so direct links to readings continue to work.

## Move existing tracker data

Browser storage is separated by website origin. Before switching from Replit, use **Backup** on the current site. After the GitHub Pages site is live, use **Import** there to restore the JSON backup. Once Firebase sync is configured, sign in on the device that has the progress first; its current tracker data is uploaded to the private account.

For Firebase setup and the per-user Firestore rules, see [CLOUD_SYNC_SETUP.md](./CLOUD_SYNC_SETUP.md).

Replit's free Starter publishing has a 30-day expiry and needs republishing. This workflow uses GitHub Pages instead; it does not change or publish the existing Replit deployment.
