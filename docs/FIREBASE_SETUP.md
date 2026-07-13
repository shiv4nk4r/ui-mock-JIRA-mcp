# Firebase setup for Mock Studio

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project (e.g. `mock-studio-greyorange`)
3. Enable **Authentication** → Sign-in method → **Google**
4. Enable **Firestore Database** (production mode, pick a region)
5. Enable **Storage** (default bucket)

## 2. Register a web app

1. Project settings → Your apps → Add web app
2. Copy the `firebaseConfig` values into `.env.local`:

```env
NEXT_PUBLIC_USE_FIREBASE=true
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 3. Restrict auth to @greyorange.com

The app enforces `@greyorange.com` on sign-in (client-side) and in security rules.

In Firebase Console → Authentication → Settings → **Authorized domains**, add your dev host (`localhost`) and production domain.

For Google OAuth, users must sign in with a GreyOrange Google Workspace account.

## 4. Deploy security rules

Install Firebase CLI and deploy rules from the repo root:

```bash
npm install -g firebase-tools
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules,firestore:indexes,storage
```

## 5. Firestore collections

| Collection   | Purpose                                      |
|-------------|----------------------------------------------|
| `users`     | Profile + role per Firebase uid              |
| `sessions`  | Mockup workspace sessions                    |
| `reviews`   | Engineering review queue                     |
| `shares`    | Public share links                           |
| `comments`  | Review/share threads                         |
| `engagement`| Feedback, testimonials, feature requests     |

Large HTML mockups are stored in **Firebase Storage** under `mockups/`, `reviews/`, and `shares/`.

## 6. Roles

On first sign-in a `users/{uid}` document is created. Default role is `internal` (engineering).

To assign roles explicitly, set `role` in Firestore:

- `internal` — engineering (reviews queue, effort estimates)
- `external` — product (mockups, sharing)

Or use `NEXT_PUBLIC_INTERNAL_EMAILS` for first-login role assignment.

## 7. Local development without Firebase

Leave `NEXT_PUBLIC_USE_FIREBASE=false` (default). The app uses mock persona sign-in and `localStorage`.

## 8. Migrating existing localStorage data

When a user first signs in with Firebase enabled, `migrateLegacySessions` copies their local sessions and reviews into Firestore automatically.
