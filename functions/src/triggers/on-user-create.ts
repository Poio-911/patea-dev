// onUserCreate: Firebase Auth non-blocking trigger is not available in firebase-functions v7.
// The beforeUserCreated (blocking) trigger requires Google Cloud Identity Platform (GCIP, paid plan).
//
// Atomicity is handled client-side in register/page.tsx:
// - If Firestore batch.commit() fails → user.delete() rolls back the Auth account.
// This file is intentionally left as a placeholder.
export { };
