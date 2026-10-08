# Free static hosting with GitHub Pages

This site is a client-only React app. The GitHub Actions workflow builds it as static HTML, CSS, JavaScript, PDFs, and extracted reading text. Study progress stays in the visitor's browser `localStorage`; there is no backend or server database.

## Publish

1. Push the project to a GitHub repository on the `main` branch.
2. For GitHub Free, the repository must be public. The deployed site and its bundled Schweser files/text will also be public.
3. In GitHub, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
4. Push to `main` or run **Deploy CFA study website to GitHub Pages** from the Actions tab.

The workflow builds with the repository subpath and includes a `404.html` fallback so direct links to readings continue to work.

## Move existing tracker data

Browser storage is separated by website origin. Before switching from Replit, use **Backup** on the current site. After the GitHub Pages site is live, use **Import** there to restore the JSON backup.

Replit's free Starter publishing has a 30-day expiry and needs republishing. This workflow uses GitHub Pages instead; it does not change or publish the existing Replit deployment.
