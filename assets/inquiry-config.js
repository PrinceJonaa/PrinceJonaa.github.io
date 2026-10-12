// Set an HTTPS endpoint only after the deployed intake passes the activation gate.
// This static file must never contain credentials.
export const inquiryConfig = Object.freeze({
  endpoint: null,
  email: 'contact@intervised.com',
  consentVersion: '2026-10-12'
});
