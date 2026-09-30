import axios from "axios";

export const TOKEN_KEY = "smart-prop.access-token";
export const REFRESH_TOKEN_KEY = "smart-prop.refresh-token";
export const USER_HINT_KEY = "smart-prop.user-hint";
export const IDENTITY_KEY = "smart-prop.identity";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  throw new Error("VITE_API_BASE_URL must be set before starting Smart-Prop.");
}

export const api = axios.create({
  baseURL: baseURL.replace(/\/+$/, ""),
  headers: { "Content-Type": "application/json" },
});

let refreshInFlight = null;

function readTokenExpiry(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const claims = JSON.parse(window.atob(padded));
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_HINT_KEY);
  localStorage.removeItem(IDENTITY_KEY);
  window.dispatchEvent(new Event("smartprop:unauthorized"));
}

export function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return Promise.reject(new Error("There is no refresh token for this session."));

  refreshInFlight = api.post(
    "/auth/refresh",
    { refresh_token: refreshToken },
    { skipAuthorization: true, skipAuthRefresh: true },
  )
    .then(({ data }) => {
      if (!data.access_token || !data.refresh_token) {
        throw new Error("The refresh endpoint returned an incomplete token response.");
      }
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      return data.access_token;
    })
    .catch((error) => {
      if ([401, 403].includes(error.response?.status)) clearStoredSession();
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

api.interceptors.request.use(async (config) => {
  if (config.skipAuthorization) return config;

  let token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = token ? readTokenExpiry(token) : null;
  if (expiresAt && expiresAt <= Date.now() + 30_000 && localStorage.getItem(REFRESH_TOKEN_KEY)) {
    token = await refreshAccessToken();
  }

  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.skipAuthRefresh &&
      !originalRequest._authRetry &&
      localStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      originalRequest._authRetry = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api.request(originalRequest);
      } catch (refreshError) {
        if ([401, 403].includes(refreshError.response?.status)) {
          return Promise.reject(refreshError);
        }
        return Promise.reject(error);
      }
    }
    if (error.response?.status === 401 && !originalRequest?.skipAuthRefresh) {
      clearStoredSession();
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error, fallback = "Something went wrong.") {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(", ") || fallback;
  }
  return fallback;
}
