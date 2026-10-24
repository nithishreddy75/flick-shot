
import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import API from "./services/api";
import "./App.css";

const USER_KEY = "criczone-auth-user";
const TOKEN_KEY = "criczone-auth-token";

function readSavedUser() {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function getUserRole(user) {
  return String(user?.role ?? user?.authority ?? "USER")
    .replace(/^ROLE_/i, "")
    .toUpperCase();
}

function normalizeUser(userData) {
  return {
    ...userData,
    name:
      userData?.name ??
      userData?.fullName ??
      userData?.username ??
      userData?.email?.split("@")[0] ??
      userData?.mobileNumber ??
      "Cricket User",
    email: userData?.email ?? "",
    role: getUserRole(userData),
  };
}

function getMobileCandidates(mobileNumber) {
  if (!mobileNumber) return [];

  const digits = String(mobileNumber).replace(/\D/g, "");
  const candidates = [digits];

  if (digits.length === 12 && digits.startsWith("91")) {
    candidates.push(digits.slice(2));
  } else if (digits.length === 10) {
    candidates.push(`91${digits}`);
  }

  return [...new Set(candidates)];
}

async function syncPlayerName(userData) {
  const name = String(
    userData?.name ?? userData?.fullName ?? ""
  ).trim();

  const mobileCandidates = getMobileCandidates(
    userData?.mobileNumber
  );

  if (name.length < 2 || mobileCandidates.length === 0) return;

  let player = null;

  for (const mobileNumber of mobileCandidates) {
    try {
      const response = await API.get("/players/by-mobile", {
        params: { mobileNumber },
      });

      if (response.data?.id) {
        player = response.data;
        break;
      }
    } catch (error) {
      if (error?.response?.status !== 404) {
        console.warn("Player profile lookup failed.", error);
      }
    }
  }

  if (!player?.id || String(player.name ?? "").trim() === name) {
    return;
  }

  try {
    await API.put(`/players/${player.id}`, {
      name,
      role: player.role || "Batsman",
      mobileNumber: player.mobileNumber || mobileCandidates[0],
      battingStyle: player.battingStyle ?? "",
      bowlingStyle: player.bowlingStyle ?? "",
    });
  } catch (error) {
    console.error("Player profile synchronization failed.", error);
  }
}

export default function App() {
  const [user, setUser] = useState(readSavedUser);

  useEffect(() => {
    if (!user) return;

    const normalizedUser = normalizeUser(user);

    if (JSON.stringify(normalizedUser) !== JSON.stringify(user)) {
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
    }
  }, [user]);

  const handleAuthenticated = async (userData) => {
    const normalizedUser = normalizeUser(userData);

    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));

    if (userData?.token) {
      localStorage.setItem(TOKEN_KEY, userData.token);
    }

    setUser(normalizedUser);

    await syncPlayerName({
      ...userData,
      ...normalizedUser,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  if (!user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flickshot-app-shell">
      <header className="fs-topbar">
        <a className="fs-brand" href="/" aria-label="FLICK SHOT home">
          <img
            className="fs-brand-logo"
            src="/flick-shot-logo.jpeg"
            alt=""
          />
          <span className="fs-brand-name">
            FLICK <strong>SHOT</strong>
          </span>
        </a>

        <div className="fs-topbar-right">
          <div className="fs-live-indicator">
            <span className="fs-status-dot" />
            CRICKET HUB
          </div>

          <div className="fs-user-block">
            <div className="fs-user-avatar">
              {String(user.name || "C").charAt(0).toUpperCase()}
            </div>
            <div className="fs-user-details">
              <span className="fs-user-greeting">WELCOME BACK</span>
              <strong>{user.name}</strong>
            </div>
            <span className="fs-role-pill">{user.role}</span>
          </div>

          <button
            type="button"
            className="fs-logout-button"
            onClick={handleLogout}
          >
            <span aria-hidden="true">↗</span>
            Sign out
          </button>
        </div>
      </header>

      <main className="fs-main-content">
        <Dashboard />
      </main>

      <footer className="fs-footer">
        <span>FLICK SHOT</span>
        <span>BUILT FOR THE LOVE OF CRICKET</span>
      </footer>
    </div>
  );
}
