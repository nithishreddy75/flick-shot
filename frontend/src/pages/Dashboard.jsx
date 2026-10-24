
import { useCallback, useEffect, useState } from "react";
import API from "../services/api";
import "../Dashboard.css";

import Teams from "./Teams";
import Matches from "./Matches";
import PlayingXI from "./PlayingXI";
import LiveScoring from "./LiveScoring";
import Results from "./Results";

const navigation = [
  { label: "Overview", icon: "⌂" },
  { label: "Matches", icon: "◷" },
  { label: "Teams", icon: "♧" },
  { label: "Playing XI", icon: "☷" },
  { label: "Live Scoring", icon: "●" },
  { label: "Results", icon: "🏆" },
];

const getList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

function getTeamPlayers(team) {
  return (
    team?.players ??
    team?.members ??
    team?.teamPlayers ??
    []
  );
}

function Dashboard() {
  const [activePage, setActivePage] = useState("Overview");
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setDashboardError("");

    const results = await Promise.allSettled([
      API.get("/teams"),
      API.get("/matches"),
    ]);

    const [teamsResult, matchesResult] = results;

    if (teamsResult.status === "fulfilled") {
      setTeams(getList(teamsResult.value.data));
    }

    if (matchesResult.status === "fulfilled") {
      setMatches(getList(matchesResult.value.data));
    }

    if (results.every((result) => result.status === "rejected")) {
      setDashboardError(
        "Unable to connect to the backend. Check that Spring Boot is running."
      );
    } else if (
      teamsResult.status === "rejected" ||
      matchesResult.status === "rejected"
    ) {
      setDashboardError(
        "Some dashboard information could not be loaded. Try refreshing."
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const openPlayingXI = () => setActivePage("Playing XI");
    const openLiveScoring = () => setActivePage("Live Scoring");

    window.addEventListener(
      "criczone:open-playing-xi",
      openPlayingXI
    );

    window.addEventListener(
      "criczone:open-opening-players",
      openLiveScoring
    );

    return () => {
      window.removeEventListener(
        "criczone:open-playing-xi",
        openPlayingXI
      );

      window.removeEventListener(
        "criczone:open-opening-players",
        openLiveScoring
      );
    };
  }, []);

  const openPage = (page) => {
    setActivePage(page);
    setDashboardError("");
  };

  const totalPlayers = teams.reduce(
    (total, team) => total + getTeamPlayers(team).length,
    0
  );

  const liveMatches = matches.filter((match) =>
    /live|in.progress|ongoing/i.test(
      String(match.status ?? "")
    )
  ).length;

  const renderOverview = () => (
    <div className="cz-dashboard-content">
      <section className="cz-dashboard-hero">
        <div>
          <span className="cz-dashboard-eyebrow">
            <span className="cz-dashboard-live-dot" />
            YOUR CRICKET. YOUR GAME. YOUR LEGACY.
          </span>

          <h2>
            Welcome to <span>FLICK SHOT.</span>
          </h2>

          <p>
            Your cricket command center. Manage teams, schedule
            matches, select your Playing XI and keep every run
            recorded.
          </p>

          <div className="fs-dashboard-hero-actions">
            <button
              type="button"
              className="fs-primary-action"
              onClick={() => openPage("Matches")}
            >
              + Match Center
            </button>

            <button
              type="button"
              className="fs-secondary-action"
              onClick={() => openPage("Teams")}
            >
              Manage Teams ↗
            </button>
          </div>
        </div>

        <div
          className="cz-dashboard-hero-mark fs-dashboard-hero-mark"
          aria-hidden="true"
        >
          <span>FLICK</span>
          <strong>SHOT</strong>
          <i>PLAY EVERY BALL</i>
        </div>
      </section>

      {dashboardError && (
        <div className="cz-dashboard-error" role="alert">
          <span>{dashboardError}</span>
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
          >
            Retry
          </button>
        </div>
      )}

      <section className="cz-dashboard-section">
        <div className="cz-dashboard-section-heading">
          <div>
            <span>YOUR CRICKET AT A GLANCE</span>
            <h3>Workspace overview</h3>
          </div>

          <button
            type="button"
            className="cz-dashboard-refresh"
            onClick={loadDashboardData}
            disabled={loading}
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>

        <div className="cz-dashboard-stats">
          <button
            type="button"
            className="cz-dashboard-stat"
            onClick={() => openPage("Teams")}
          >
            <span className="cz-dashboard-stat-top">
              <span>REGISTERED TEAMS</span>
              <i>♧</i>
            </span>

            <strong>{loading ? "—" : teams.length}</strong>

            <span className="cz-dashboard-stat-bottom">
              Explore your teams <b>↗</b>
            </span>
          </button>

          <button
            type="button"
            className="cz-dashboard-stat"
            onClick={() => openPage("Teams")}
          >
            <span className="cz-dashboard-stat-top">
              <span>PLAYERS IN SQUADS</span>
              <i>♙</i>
            </span>

            <strong>{loading ? "—" : totalPlayers}</strong>

            <span className="cz-dashboard-stat-bottom">
              Manage your squads <b>↗</b>
            </span>
          </button>

          <button
            type="button"
            className="cz-dashboard-stat"
            onClick={() => openPage("Matches")}
          >
            <span className="cz-dashboard-stat-top">
              <span>TOTAL MATCHES</span>
              <i>◷</i>
            </span>

            <strong>{loading ? "—" : matches.length}</strong>

            <span className="cz-dashboard-stat-bottom">
              Open match center <b>↗</b>
            </span>
          </button>

          <button
            type="button"
            className="cz-dashboard-stat"
            onClick={() => openPage("Live Scoring")}
          >
            <span className="cz-dashboard-stat-top">
              <span>LIVE MATCHES</span>
              <i>●</i>
            </span>

            <strong>{loading ? "—" : liveMatches}</strong>

            <span className="cz-dashboard-stat-bottom">
              Open live scoring <b>↗</b>
            </span>
          </button>
        </div>
      </section>

      <section className="cz-dashboard-section cz-dashboard-quick-section">
        <div className="cz-dashboard-section-heading">
          <div>
            <span>READY WHEN YOU ARE</span>
            <h3>Quick actions</h3>
          </div>
        </div>

        <div className="cz-dashboard-quick-grid">
          {[
            {
              title: "Manage teams",
              description: "Create teams and manage player squads.",
              icon: "♧",
              page: "Teams",
            },
            {
              title: "Schedule matches",
              description: "Open your match center and fixtures.",
              icon: "◷",
              page: "Matches",
            },
            {
              title: "Choose Playing XI",
              description: "Prepare the starting lineup.",
              icon: "☷",
              page: "Playing XI",
            },
            {
              title: "Live scoring",
              description: "Record runs, wickets and extras.",
              icon: "●",
              page: "Live Scoring",
            },
            {
              title: "Results & scorecards",
              description: "Review match results and performances.",
              icon: "🏆",
              page: "Results",
            },
          ].map((action) => (
            <button
              type="button"
              className="cz-dashboard-action"
              key={action.page}
              onClick={() => openPage(action.page)}
            >
              <span className="cz-dashboard-action-icon">
                {action.icon}
              </span>

              <span className="cz-dashboard-action-copy">
                <strong>{action.title}</strong>
                <small>{action.description}</small>
              </span>

              <span className="cz-dashboard-action-arrow">
                ↗
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="cz-dashboard-section">
        <div className="cz-dashboard-section-heading">
          <div>
            <span>YOUR CLUB DIRECTORY</span>
            <h3>Registered teams</h3>
          </div>

          <button
            type="button"
            className="cz-dashboard-text-button"
            onClick={() => openPage("Teams")}
          >
            View all ↗
          </button>
        </div>

        {loading ? (
          <div className="cz-dashboard-empty">
            Loading your teams...
          </div>
        ) : teams.length === 0 ? (
          <div className="cz-dashboard-empty">
            <strong>Your cricket journey starts here.</strong>
            <p>Create your first team to get started.</p>
            <button
              type="button"
              onClick={() => openPage("Teams")}
            >
              + Create a team
            </button>
          </div>
        ) : (
          <div className="cz-dashboard-team-list">
            {teams.slice(0, 5).map((team) => (
              <div
                className="cz-dashboard-team-row"
                key={team.id}
              >
                <div className="cz-dashboard-team-logo">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt={`${team.name} logo`}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span>
                      {(team.shortName || team.name || "?")
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="cz-dashboard-team-info">
                  <strong>{team.name}</strong>
                  <span>
                    {team.shortName || "Cricket team"}
                  </span>
                </div>

                <span className="cz-dashboard-team-status">
                  REGISTERED
                </span>
              </div>
            ))}

            {teams.length > 5 && (
              <button
                type="button"
                className="cz-dashboard-text-button cz-dashboard-more-teams"
                onClick={() => openPage("Teams")}
              >
                View {teams.length - 5} more teams ↗
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "Teams":
        return <Teams />;
      case "Matches":
        return <Matches />;
      case "Playing XI":
        return <PlayingXI />;
      case "Live Scoring":
        return <LiveScoring />;
      case "Results":
        return <Results />;
      default:
        return renderOverview();
    }
  };

  return (
    <div className="cz-dashboard">
      <aside className="cz-dashboard-sidebar">
        <button
          type="button"
          className="cz-dashboard-brand"
          onClick={() => openPage("Overview")}
          aria-label="FLICK SHOT home"
        >
          <span className="cz-dashboard-brand-icon">F</span>
          <span className="cz-dashboard-brand-text">
            <strong>FLICK SHOT</strong>
            <small>CRICKET MANAGEMENT</small>
          </span>
        </button>

        <div className="cz-dashboard-nav-label">
          MAIN MENU
        </div>

        <nav
          className="cz-dashboard-nav"
          aria-label="Main navigation"
        >
          {navigation.map((item) => (
            <button
              type="button"
              key={item.label}
              className={
                activePage === item.label
                  ? "cz-dashboard-nav-item active"
                  : "cz-dashboard-nav-item"
              }
              onClick={() => openPage(item.label)}
              aria-current={
                activePage === item.label ? "page" : undefined
              }
            >
              <span className="cz-dashboard-nav-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>

              {activePage === item.label && (
                <span className="cz-dashboard-nav-indicator" />
              )}
            </button>
          ))}
        </nav>

        <div className="cz-dashboard-sidebar-bottom">
          <div className="cz-dashboard-sidebar-status">
            <span className="cz-dashboard-live-dot" />
            <span>
              <strong>Cricket workspace</strong>
              <small>Manage every match</small>
            </span>
          </div>

          <div className="cz-dashboard-version">
            FLICK SHOT · V1.0
          </div>
        </div>
      </aside>

      <main className="cz-dashboard-main">
        <header className="cz-dashboard-topbar">
          <div className="cz-dashboard-breadcrumb">
            <span>FLICK SHOT</span>
            <span>/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="cz-dashboard-topbar-right">
            <span className="cz-dashboard-status-pill">
              <i />
              WORKSPACE
            </span>

            <div className="cz-dashboard-profile">
              <span className="cz-dashboard-profile-avatar">
                F
              </span>
              <span>
                <strong>FLICK SHOT</strong>
                <small>Cricket hub</small>
              </span>
            </div>
          </div>
        </header>

        <div className="cz-dashboard-page">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
