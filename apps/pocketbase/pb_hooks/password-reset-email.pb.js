/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  // This hook is for password reset email notifications
  // The actual password reset is triggered via pb.collection('users').requestPasswordReset(email)
  // which is handled by PocketBase's built-in password reset flow
  e.next();
}, "users");

// Note: PocketBase automatically sends password reset emails when requestPasswordReset() is called.
// This hook can be extended to customize the email template or add additional logging if needed.
// The password reset email is sent by PocketBase's internal mailer with the reset link.