export const ALLOWED_EMAIL_DOMAIN = "greyorange.com";

export function isFirebaseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_FIREBASE === "true";
}

export function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

export function isFirebaseConfigValid(): boolean {
  const cfg = getFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
