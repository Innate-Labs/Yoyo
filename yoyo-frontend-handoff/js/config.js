/**
 * Runtime configuration.
 *
 * The backend integrator may override this object before api.js loads.
 * Keep useMocks=true while reviewing the standalone prototype.
 */
window.__YOYO_CONFIG__ = window.__YOYO_CONFIG__ || {
  apiBaseUrl: "",
  useMocks: true,
  requestTimeoutMs: 15000,
};
