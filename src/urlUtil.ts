// Helper to parse hash as query parameters
// Converts #id=123&debug=1 to URLSearchParams
export function getHashParams(): URLSearchParams {
  const hash = window.location.hash.slice(1); // Remove the '#'
  return new URLSearchParams(hash);
}
