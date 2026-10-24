
import { useState } from "react";
import API from "../services/api";
import "./AuthPage.css";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    clearFeedback();
    setPassword("");
    setConfirmPassword("");
  };

  const authenticate = (data) => {
    if (!data?.token) {
      throw new Error("The server did not return an authentication token.");
    }

    const role = String(data.role ?? "USER")
      .replace(/^ROLE_/i, "")
      .toUpperCase();

    const user = {
      id: data.id,
      name: data.name || "Cricket User",
      email: data.email || "",
      mobileNumber: data.mobileNumber || "",
      role,
    };

    localStorage.setItem("criczone-auth-token", data.token);
    onAuthenticated(user);
  };

  const submit = async (event) => {
    event.preventDefault();
    clearFeedback();

    const mobile = mobileNumber.trim();

    if (!/^\+?[0-9\s()-]{7,20}$/.test(mobile)) {
      setError("Enter a valid mobile number.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password.length > 72) {
      setError("Password cannot exceed 72 characters.");
      return;
    }

    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Please enter your full name.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const response = await API.post("/users/mobile-register", {
          name: name.trim(),
          mobileNumber: mobile,
          password,
        });

        setMessage(
          response.data?.message ||
            "Account created successfully. Please sign in."
        );

        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        const response = await API.post("/users/mobile-login", {
          mobileNumber: mobile,
          password,
        });

        authenticate(response.data ?? {});
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cz-auth-page">
      <div className="cz-auth-backdrop" />

      <header className="cz-public-nav">
        <a className="cz-public-brand" href="/" aria-label="Criczone home">
          <span className="cz-public-brand-mark">C</span>
          <span>
            CRIC<span className="cz-green">ZONE</span>
          </span>
        </a>
        <span className="cz-auth-nav-note">
          YOUR GAME. YOUR COMMUNITY.
        </span>
      </header>

      <section className="cz-auth-layout">
        <div className="cz-auth-promo">
          <span className="cz-auth-kicker">THE GAME NEVER STOPS</span>

          <h1>
            Every ball.
            <br />
            Every <span>moment.</span>
          </h1>

          <p>
            Follow your matches, catch every wicket, and stay connected
            to the game you love.
          </p>

          <div className="cz-auth-feature-list">
            <div>
              <span>01</span>
              <div>
                <strong>Live score updates</strong>
                <small>Follow every run and wicket.</small>
              </div>
            </div>

            <div>
              <span>02</span>
              <div>
                <strong>Match scorecards</strong>
                <small>Explore batting and bowling figures.</small>
              </div>
            </div>

            <div>
              <span>03</span>
              <div>
                <strong>Fixtures and results</strong>
                <small>Keep track of every match.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="cz-auth-card">
          <div className="cz-auth-card-heading">
            <span className="cz-auth-card-icon">🏏</span>

            <div className="cz-auth-kicker">WELCOME TO CRICZONE</div>

            <h2>
              {mode === "login" ? "Welcome back" : "Join the game"}
            </h2>

            <p>
              {mode === "login"
                ? "Sign in with your mobile number and password."
                : "Create your cricket account in a few steps."}
            </p>
          </div>

          <div className="cz-auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          <form className="cz-auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Mobile number
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                placeholder="e.g. 9876543210"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                maxLength={72}
                required
              />
            </label>

            {mode === "register" && (
              <label>
                Confirm password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </label>
            )}

            {error && (
              <div className="cz-auth-alert error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="cz-auth-alert success" role="status">
                {message}
              </div>
            )}

            <button
              className="cz-auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in to Criczone →"
                  : "Create my account →"}
            </button>
          </form>

          <p className="cz-auth-terms">
            Your password is securely hashed by the server.
            No SMS charges or OTP are required.
          </p>
        </div>
      </section>

      <footer className="cz-auth-footer">
        <span>© 2026 CRICZONE</span>
        <span>BUILT FOR THE LOVE OF CRICKET</span>
      </footer>
    </main>
  );
}
