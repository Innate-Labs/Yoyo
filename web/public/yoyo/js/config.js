/**
 * Runtime configuration.
 *
 * The backend integrator may override this object before api.js loads.
 * The integrated application always uses the existing Next.js backend.
 */
window.__YOYO_CONFIG__ = window.__YOYO_CONFIG__ || {
  apiBaseUrl: "",
  useMocks: false,
  requestTimeoutMs: 65000,
};
