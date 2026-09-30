import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  getErrorMessage,
  IDENTITY_KEY,
  refreshAccessToken,
  REFRESH_TOKEN_KEY,
  TOKEN_KEY,
  USER_HINT_KEY,
} from "../api/client";

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const bytes = Uint8Array.from(window.atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function loadIdentity(token, userHint = null) {
  const claims = decodeToken(token);
  if (!claims?.sub || claims.role_id == null) {
    throw new Error("The API token does not include the expected user and role claims.");
  }
  if (claims.exp != null && Number(claims.exp) * 1000 <= Date.now()) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (userHint?.user_id != null && String(userHint.user_id) !== String(claims.sub)) {
    throw new Error("The registered account does not match the identity in the API token.");
  }
  const { data: role } = await api.get(`/roles/${encodeURIComponent(claims.role_id)}`);
  if (!role || String(role.role_id) !== String(claims.role_id)) {
    throw new Error("Your account's role could not be found. Contact your administrator.");
  }
  const user = {
    ...userHint,
    user_id: claims.sub,
    role_id: claims.role_id,
    full_name: userHint?.full_name || userHint?.email || `User ${claims.sub}`,
    email: userHint?.email || "",
  };
  return { user, role, claims };
}

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState("");
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_HINT_KEY);
    localStorage.removeItem(IDENTITY_KEY);
    setIdentity(null);
  }, []);

  const establishSession = useCallback(async (token, refreshToken, userHint = null) => {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (userHint) localStorage.setItem(USER_HINT_KEY, JSON.stringify(userHint));
    try {
      const nextIdentity = await loadIdentity(token, userHint);
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
      setStartupError("");
      setIdentity(nextIdentity);
      return nextIdentity;
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) clearSession();
      throw error;
    }
  }, [clearSession]);

  const login = useCallback(async (credentials, registeredUser = null) => {
    setStartupError("");
    const response = await api.post("/auth/login", credentials);
    const userHint = registeredUser ?? {
      email: credentials.email.trim(),
      full_name: credentials.email.trim(),
    };
    return establishSession(response.data.access_token, response.data.refresh_token, userHint);
  }, [establishSession]);

  const register = useCallback(async (details) => {
    setStartupError("");
    const { data: user } = await api.post("/auth/register", details);
    return login({ email: user.email, password: details.password }, user);
  }, [login]);

  useEffect(() => {
    const onUnauthorized = () => {
      setIdentity(null);
      navigate("/login", { replace: true });
    };
    const onStorageChange = (event) => {
      if (event.key === TOKEN_KEY && !event.newValue) {
        setIdentity(null);
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("smartprop:unauthorized", onUnauthorized);
    window.addEventListener("storage", onStorageChange);

    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return () => {
        window.removeEventListener("smartprop:unauthorized", onUnauthorized);
        window.removeEventListener("storage", onStorageChange);
      };
    }

    let userHint = null;
    let cachedIdentity = null;
    try {
      userHint = JSON.parse(localStorage.getItem(USER_HINT_KEY) || "null");
    } catch {
      localStorage.removeItem(USER_HINT_KEY);
    }
    try {
      cachedIdentity = JSON.parse(localStorage.getItem(IDENTITY_KEY) || "null");
    } catch {
      localStorage.removeItem(IDENTITY_KEY);
    }

    const claims = decodeToken(token);
    if (claims?.exp != null && Number(claims.exp) * 1000 <= Date.now()) {
      refreshAccessToken()
        .then((newToken) => {
          token = newToken;
          return claims;
        })
        .then((refreshedClaims) => {
          if (
            cachedIdentity?.role &&
            String(cachedIdentity.claims?.sub) === String(refreshedClaims.sub) &&
            String(cachedIdentity.claims?.role_id) === String(refreshedClaims.role_id)
          ) {
            setIdentity({ ...cachedIdentity, claims: refreshedClaims });
            setStartupError("");
            return null;
          }
          return loadIdentity(token, userHint);
        })
        .then((nextIdentity) => {
          if (nextIdentity) {
            localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
            setIdentity(nextIdentity);
          }
        })
        .catch((error) => {
          if ([401, 403].includes(error.response?.status)) {
            clearSession();
            setStartupError("Your session has expired. Please sign in again.");
          } else {
            setStartupError("Could not restore your session because the API is unavailable. Your sign-in is saved; try again shortly.");
          }
        })
        .finally(() => setLoading(false));

      return () => {
        window.removeEventListener("smartprop:unauthorized", onUnauthorized);
        window.removeEventListener("storage", onStorageChange);
      };
    }

    if (
      cachedIdentity?.role &&
      String(cachedIdentity.claims?.sub) === String(claims?.sub) &&
      String(cachedIdentity.claims?.role_id) === String(claims?.role_id)
    ) {
      setIdentity(cachedIdentity);
      setLoading(false);
      return () => {
        window.removeEventListener("smartprop:unauthorized", onUnauthorized);
        window.removeEventListener("storage", onStorageChange);
      };
    }

    loadIdentity(token, userHint)
      .then((nextIdentity) => {
        localStorage.setItem(IDENTITY_KEY, JSON.stringify(nextIdentity));
        setIdentity(nextIdentity);
      })
      .catch((error) => {
        if ([401, 403].includes(error.response?.status)) {
          clearSession();
        } else {
          setStartupError(getErrorMessage(error, "Could not restore your session. Please sign in again."));
        }
      })
      .finally(() => setLoading(false));

    return () => {
      window.removeEventListener("smartprop:unauthorized", onUnauthorized);
      window.removeEventListener("storage", onStorageChange);
    };
  }, [clearSession, navigate]);

  const value = useMemo(() => ({
    identity,
    user: identity?.user ?? null,
    role: identity?.role ?? null,
    loading,
    startupError,
    dismissStartupError: () => setStartupError(""),
    login,
    register,
    logout: clearSession,
    errorMessage: getErrorMessage,
  }), [identity, loading, startupError, login, register, clearSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
