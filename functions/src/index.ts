import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all functions
export { resetMonthlyCredits } from './scheduled/reset-monthly-credits';
