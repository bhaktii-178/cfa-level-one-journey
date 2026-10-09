# Enable private tracker sync (free Firebase Spark plan)

This adds sign-in and sync while the website continues to be hosted as a static GitHub Pages site. It does not use a Replit deployment or a custom server.

**Keep Firebase on the Spark plan.** Firebase documents Spark as a no-cost plan that does not require payment information. Firestore currently includes a small free quota suitable for a personal tracker; if a quota is exceeded while remaining on Spark, syncing can be temporarily unavailable rather than generating a Firebase bill. Check the current [Firebase plan details](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans) and [Firestore quotas](https://firebase.google.com/docs/firestore/pricing).

## 1. Create a Firebase project and web app

1. Open [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Create a project. Google Analytics is not needed for this tracker.
3. Keep the project on **Spark**. Do not attach a billing account or upgrade it to Blaze.
4. In the project, add a **Web app** (the `</>` icon). Copy these four values from the Firebase config shown for that app:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`

These are public web-app configuration values, not service-account credentials. Do not create, download, or add a service-account JSON file or private key.

## 2. Enable email/password sign-in

1. Open **Build → Authentication** in Firebase Console.
2. Select **Get started** if shown.
3. Open **Sign-in method**, choose **Email/Password**, enable it, and save.
4. In Authentication settings, add `bhaktii-178.github.io` to **Authorized domains** if it is not already listed.

## 3. Create the private tracker database

1. Open **Build → Firestore Database** and choose **Create database**.
2. Start in **production mode**.
3. Choose a nearby region. `asia-south1` (Mumbai) is suitable when available; the database location cannot be changed later.
4. Open the Firestore **Rules** tab. Replace the rules with the following, then select **Publish**:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trackerSnapshots/{userId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

Each signed-in account can read and write only its own tracker document. Do not use public read/write rules.

## 4. Add the public Firebase configuration to GitHub

1. Open the repository: [bhaktii-178/cfa-level-one-journey](https://github.com/bhaktii-178/cfa-level-one-journey).
2. Go to **Settings → Secrets and variables → Actions → Variables**.
3. Choose **New repository variable** and add each name exactly as shown. Use the matching value from the Firebase web-app config:

| Variable name | Firebase config value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

These values are included in the public website bundle by design. Firestore security rules and account sign-in protect the tracker data. Never add a Firebase service-account key, private key, or other server credential to GitHub or the website.

## 5. Rebuild the site and connect your devices

1. In GitHub, open **Actions → Deploy CFA study website to GitHub Pages**.
2. Choose **Run workflow**, select `main`, and run it. Wait for both the build and deploy jobs to finish successfully.
3. On the laptop that currently has your progress, open the GitHub Pages site and select **Backup** once as an extra copy. If the progress is still on the old Replit website, use **Backup** there, open the GitHub Pages site, **Import** that JSON backup, and verify it before continuing; browser storage is separate for each website address.
4. Select **Sync → Create an account** and use an email address and password you can use on your phone. The first sign-in uploads or merges that browser's existing progress into your account.
5. Open the same site on your phone, select **Sync → Sign in**, and use the same account. Sessions, confidence ratings, notes, and streaks will load from the shared tracker.

Changes are saved locally first and then synced. Signed-in devices receive updates live while open, and refresh the saved cloud snapshot when reopened or brought back online. Keep using **Backup** occasionally as an independent copy.
