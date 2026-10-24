
import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "./UserPortal.css";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.players)) return data.players;
  return [];
};

const getId = (item) => item?.id ?? item?.matchId ?? item?.playerId ?? "";

const getTeam = (match, side) => {
  const candidates =
    side === 1
      ? [
          match?.team1,
          match?.teamA,
          match?.homeTeam,
          match?.firstTeam,
          match?.team1Name,
          match?.teamAName,
        ]
      : [
          match?.team2,
          match?.teamB,
          match?.awayTeam,
          match?.secondTeam,
          match?.team2Name,
          match?.teamBName,
        ];

  const value = candidates.find(
    (candidate) => candidate !== undefined && candidate !== null
  );

  if (typeof value === "object") {
    return value?.name ?? value?.teamName ?? "Team";
  }

  return value || "Team";
};

const getTeamName = (team) => {
  if (typeof team === "object") {
    return team?.name ?? team?.teamName ?? "Unknown team";
  }
  return team || "Unknown team";
};

const getMatchDate = (match) =>
  match?.matchDate ??
  match?.dateTime ??
  match?.scheduledAt ??
  match?.startTime ??
  match?.date ??
  null;

const getStatus = (match) =>
  String(match?.status ?? match?.matchStatus ?? "SCHEDULED")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

const isLive = (match) => {
  const status = getStatus(match);
  return ["LIVE", "IN_PROGRESS", "INPROGRESS", "ONGOING"].includes(status);
};

const isCompleted = (match) => {
  const status = getStatus(match);
  return [
    "COMPLETED",
    "FINISHED",
    "RESULT",
    "RESULT_DECLARED",
    "ENDED",
  ].includes(status);
};

const isUpcoming = (match) => !isLive(match) && !isCompleted(match);

const formatDate = (value) => {
  if (!value) return "Date not announced";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatOvers = (legalBalls) =>
  `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

const deliveryType = (delivery) =>
  String(delivery?.extraType ?? "NONE").toUpperCase();

const isLegalDelivery = (delivery) =>
  !["WIDE", "NO_BALL"].includes(deliveryType(delivery));

const deliveryRuns = (delivery) =>
  Number(delivery?.runsScored ?? delivery?.batterRuns ?? 0);

const extraRuns = (delivery) => Number(delivery?.extraRuns ?? 0);

const totalRunsFromDelivery = (delivery) =>
  deliveryRuns(delivery) + extraRuns(delivery);

const countWickets = (deliveries) =>
  deliveries.filter((delivery) => Boolean(delivery?.wicket)).length;

const calculateInnings = (deliveries) => {
  const runs = deliveries.reduce(
    (sum, delivery) => sum + totalRunsFromDelivery(delivery),
    0
  );

  const wickets = countWickets(deliveries);

  const legalBalls = deliveries.filter(isLegalDelivery).length;

  return {
    runs,
    wickets,
    legalBalls,
    overs: formatOvers(legalBalls),
  };
};

const matchFormat = (match) =>
  String(match?.format ?? match?.matchFormat ?? match?.type ?? "Cricket")
    .replaceAll("_", " ")
    .toUpperCase();

const getPlayerName = (player) =>
  player?.name ??
  player?.playerName ??
  [player?.firstName, player?.lastName].filter(Boolean).join(" ") ??
  "Unknown player";

function getInitials(name) {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function MatchScorecard({ match, deliveries, onView }) {
  const innings = useMemo(() => {
    const groups = new Map();

    deliveries.forEach((delivery) => {
      const number = Number(delivery?.inningsNumber ?? 1);
      if (!groups.has(number)) groups.set(number, []);
      groups.get(number).push(delivery);
    });

    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, rows]) => ({
        number,
        ...calculateInnings(rows),
      }));
  }, [deliveries]);

  const team1 = getTeamName(getTeam(match, 1));
  const team2 = getTeamName(getTeam(match, 2));

  return (
    <article className="cz-user-match-card cz-user-live-card">
      <div className="cz-user-match-top">
        <span className="cz-user-format">{matchFormat(match)}</span>
        <span className="cz-user-live-badge">
          <i /> LIVE
        </span>
      </div>

      <div className="cz-user-versus">
        <div className="cz-user-team">
          <span className="cz-user-team-mark">{getInitials(team1)}</span>
          <strong>{team1}</strong>
        </div>
        <span className="cz-user-vs">VS</span>
        <div className="cz-user-team">
          <span className="cz-user-team-mark">{getInitials(team2)}</span>
          <strong>{team2}</strong>
        </div>
      </div>

      <div className="cz-user-innings-scores">
        {innings.length ? (
          innings.map((item) => (
            <div className="cz-user-innings-line" key={item.number}>
              <span>Innings {item.number}</span>
              <strong>
                {item.runs}/{item.wickets}
              </strong>
              <span>{item.overs} overs</span>
            </div>
          ))
        ) : (
          <p className="cz-user-muted">
            No deliveries recorded yet.
          </p>
        )}
      </div>

      <div className="cz-user-card-footer">
        <span>{match?.venue ?? match?.ground ?? "Venue not announced"}</span>
        <button className="cz-user-text-button" onClick={onView}>
          View scorecard <span>→</span>
        </button>
      </div>
    </article>
  );
}

function FixtureCard({ match, completed = false, onView }) {
  const team1 = getTeamName(getTeam(match, 1));
  const team2 = getTeamName(getTeam(match, 2));

  return (
    <article className="cz-user-fixture-card">
      <div className="cz-user-fixture-heading">
        <span className="cz-user-format">{matchFormat(match)}</span>
        <span className={completed ? "cz-user-status-done" : "cz-user-status-upcoming"}>
          {completed ? "COMPLETED" : "UPCOMING"}
        </span>
      </div>

      <div className="cz-user-fixture-teams">
        <div className="cz-user-fixture-team">
          <span className="cz-user-team-mark">{getInitials(team1)}</span>
          <strong>{team1}</strong>
        </div>
        <span className="cz-user-vs">VS</span>
        <div className="cz-user-fixture-team">
          <span className="cz-user-team-mark">{getInitials(team2)}</span>
          <strong>{team2}</strong>
        </div>
      </div>

      <div className="cz-user-fixture-info">
        <span>◷ {formatDate(getMatchDate(match))}</span>
        <span>⌖ {match?.venue ?? match?.ground ?? "Venue to be announced"}</span>
      </div>

      {completed && match?.result && (
        <p className="cz-user-result-text">{match.result}</p>
      )}

      <button className="cz-user-outline-button" onClick={onView}>
        {completed ? "View match details" : "View fixture"}
      </button>
    </article>
  );
}

export default function UserPortal({ user, onLogout }) {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [deliveriesByMatch, setDeliveriesByMatch] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState("ALL");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadPortalData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const [matchesResponse, playersResponse] = await Promise.all([
        API.get("/matches"),
        API.get("/players"),
      ]);

      const matchList = unwrapList(matchesResponse.data);
      const playerList = unwrapList(playersResponse.data);

      setMatches(matchList);
      setPlayers(playerList);

      const scoringResults = await Promise.allSettled(
        matchList.map(async (match) => {
          const id = getId(match);
          if (!id) return { id: "", deliveries: [] };

          const response = await API.get(`/live-scoring/${id}`);
          return {
            id: String(id),
            deliveries: unwrapList(response.data),
          };
        })
      );

      const scoringMap = {};
      scoringResults.forEach((result) => {
        if (result.status === "fulfilled" && result.value.id) {
          scoringMap[result.value.id] = result.value.deliveries;
        }
      });

      setDeliveriesByMatch(scoringMap);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "Could not load Criczone data. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortalData(true);

    // Refresh scores and fixtures every 15 seconds.
    const timer = setInterval(() => {
      loadPortalData(false);
    }, 15000);

    return () => clearInterval(timer);
  }, [loadPortalData]);

  const liveMatches = useMemo(
    () => matches.filter(isLive),
    [matches]
  );

  const upcomingMatches = useMemo(
    () => matches.filter(isUpcoming),
    [matches]
  );

  const completedMatches = useMemo(
    () => matches.filter(isCompleted),
    [matches]
  );

  const formats = useMemo(() => {
    const values = new Set(matches.map(matchFormat));
    return [...values].filter((value) => value && value !== "CRICKET");
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return matches.filter((match) => {
      const team1 = getTeamName(getTeam(match, 1));
      const team2 = getTeamName(getTeam(match, 2));
      const venue = String(match?.venue ?? match?.ground ?? "");
      const format = matchFormat(match);
      const status = getStatus(match);

      const matchesSearch =
        !term ||
        [team1, team2, venue, format, status, match?.result]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "LIVE" && isLive(match)) ||
        (statusFilter === "UPCOMING" && isUpcoming(match)) ||
        (statusFilter === "COMPLETED" && isCompleted(match));

      const matchesFormat =
        formatFilter === "ALL" || format === formatFilter;

      const matchesTab =
        activeTab === "ALL" ||
        (activeTab === "LIVE" && isLive(match)) ||
        (activeTab === "UPCOMING" && isUpcoming(match)) ||
        (activeTab === "COMPLETED" && isCompleted(match));

      return matchesSearch && matchesStatus && matchesFormat && matchesTab;
    });
  }, [matches, search, statusFilter, formatFilter, activeTab]);

  const playerStatistics = useMemo(() => {
    const stats = new Map();

    players.forEach((player) => {
      const id = String(getId(player));
      if (!id) return;

      stats.set(id, {
        id,
        name: getPlayerName(player),
        team: getTeamName(player?.team ?? player?.teamName),
        role: player?.role ?? player?.playingRole ?? "Player",
        runs: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
      });
    });

    Object.values(deliveriesByMatch).flat().forEach((delivery) => {
      const batterId =
        delivery?.striker?.id ??
        delivery?.batter?.id ??
        delivery?.strikerId ??
        delivery?.batterId;

      const bowlerId =
        delivery?.bowler?.id ?? delivery?.bowlerId;

      const batter = stats.get(String(batterId));
      const bowler = stats.get(String(bowlerId));
      const runs = deliveryRuns(delivery);
      const type = deliveryType(delivery);

      if (batter) {
        batter.runs += runs;

        if (!["WIDE", "BYE", "LEG_BYE"].includes(type)) {
          batter.ballsFaced += 1;
        }

        if (runs === 4) batter.fours += 1;
        if (runs === 6) batter.sixes += 1;
      }

      if (bowler) {
        if (isLegalDelivery(delivery)) bowler.ballsBowled += 1;

        if (!["BYE", "LEG_BYE"].includes(type)) {
          bowler.runsConceded += runs + extraRuns(delivery);
        }

        if (
          delivery?.wicket &&
          !["RUN_OUT", "RETIRED_OUT", "OBSTRUCTING_THE_FIELD"].includes(
            String(delivery?.dismissalType ?? "").toUpperCase()
          )
        ) {
          bowler.wickets += 1;
        }
      }
    });

    return [...stats.values()]
      .map((player) => ({
        ...player,
        strikeRate: player.ballsFaced
          ? ((player.runs / player.ballsFaced) * 100).toFixed(1)
          : "0.0",
        economy: player.ballsBowled
          ? (player.runsConceded / (player.ballsBowled / 6)).toFixed(2)
          : "0.00",
      }))
      .sort((a, b) => b.runs - a.runs);
  }, [players, deliveriesByMatch]);

  const openMatch = (match) => {
    setSelectedMatch(match);
  };

  const closeMatch = () => setSelectedMatch(null);

  const displayName =
    user?.name ??
    user?.fullName ??
    user?.username ??
    user?.email?.split("@")[0] ??
    "Cricket Fan";

  return (
    <div className="cz-user-app">
      <aside className="cz-user-sidebar">
        <div className="cz-user-brand">
          <span className="cz-user-brand-icon">C</span>
          <span>
            <strong>CRICZONE</strong>
            <small>THE GAME. LIVE.</small>
          </span>
        </div>

        <div className="cz-user-sidebar-label">YOUR CRICKET HUB</div>

        <nav className="cz-user-nav">
          {[
            ["ALL", "⌂", "Home"],
            ["LIVE", "◉", "Live matches"],
            ["UPCOMING", "▦", "Upcoming fixtures"],
            ["COMPLETED", "✓", "Results"],
          ].map(([value, icon, label]) => (
            <button
              key={value}
              className={`cz-user-nav-item ${activeTab === value ? "active" : ""}`}
              onClick={() => {
                setActiveTab(value);
                document
                  .getElementById("cz-user-matches")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span>{icon}</span>
              {label}
              {value === "LIVE" && liveMatches.length > 0 && (
                <b>{liveMatches.length}</b>
              )}
            </button>
          ))}
        </nav>

        <div className="cz-user-sidebar-bottom">
          <div className="cz-user-online">
            <span className="cz-user-online-dot" />
            <span>
              <strong>Scoring service</strong>
              <small>Auto-refresh enabled</small>
            </span>
          </div>

          <button
            className="cz-user-logout"
            onClick={() => {
              if (onLogout) onLogout();
              else {
                localStorage.removeItem("user");
                localStorage.removeItem("criczone-user");
                window.location.reload();
              }
            }}
          >
            ↪ Sign out
          </button>
        </div>
      </aside>

      <main className="cz-user-main">
        <header className="cz-user-topbar">
          <div>
            <span className="cz-user-breadcrumb">CRICZONE / FAN ZONE</span>
            <h1>Cricket, at a glance.</h1>
          </div>

          <div className="cz-user-profile">
            <div className="cz-user-profile-avatar">
              {getInitials(displayName)}
            </div>
            <div>
              <strong>{displayName}</strong>
              <small>Cricket fan</small>
            </div>
            <span className="cz-user-profile-chevron">⌄</span>
          </div>
        </header>

        <section className="cz-user-hero">
          <div className="cz-user-hero-content">
            <span className="cz-user-hero-eyebrow">
              <i /> YOUR HOME FOR CRICKET
            </span>
            <h2>
              Every run.
              <br />
              <span>Every moment.</span>
            </h2>
            <p>
              Follow live action, discover upcoming fixtures, and relive
              completed matches — all in one place.
            </p>
            <button
              className="cz-user-hero-button"
              onClick={() =>
                document
                  .getElementById("cz-user-matches")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Explore matches <span>→</span>
            </button>
          </div>

          <div className="cz-user-hero-art" aria-hidden="true">
            <div className="cz-user-orbit cz-user-orbit-one" />
            <div className="cz-user-orbit cz-user-orbit-two" />
            <div className="cz-user-hero-ball">C</div>
            <div className="cz-user-hero-wordmark">
              <span>PLAY</span>
              <strong>YOUR</strong>
              <span>GAME</span>
            </div>
          </div>
        </section>

        {error && (
          <div className="cz-user-error" role="alert">
            <span>{error}</span>
            <button onClick={() => loadPortalData(true)}>Try again</button>
          </div>
        )}

        <section className="cz-user-stat-grid">
          <div className="cz-user-stat-card">
            <span className="cz-user-stat-icon live">◉</span>
            <span className="cz-user-stat-label">Live now</span>
            <strong>{liveMatches.length}</strong>
            <small>Matches in progress</small>
          </div>
          <div className="cz-user-stat-card">
            <span className="cz-user-stat-icon fixtures">▦</span>
            <span className="cz-user-stat-label">Coming up</span>
            <strong>{upcomingMatches.length}</strong>
            <small>Upcoming fixtures</small>
          </div>
          <div className="cz-user-stat-card">
            <span className="cz-user-stat-icon results">✓</span>
            <span className="cz-user-stat-label">Completed</span>
            <strong>{completedMatches.length}</strong>
            <small>Finished matches</small>
          </div>
          <div className="cz-user-stat-card">
            <span className="cz-user-stat-icon players">♙</span>
            <span className="cz-user-stat-label">Players</span>
            <strong>{players.length}</strong>
            <small>In your cricket hub</small>
          </div>
        </section>

        <section className="cz-user-section">
          <div className="cz-user-section-heading">
            <div>
              <span className="cz-user-section-kicker">RIGHT NOW</span>
              <h2><i className="cz-user-heading-live-dot" /> Live scorecards</h2>
              <p>Follow the action as deliveries are recorded.</p>
            </div>
            <button
              className="cz-user-refresh-button"
              onClick={() => loadPortalData(true)}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>

          {loading && matches.length === 0 ? (
            <div className="cz-user-empty">
              <span className="cz-user-spinner" />
              Loading live matches...
            </div>
          ) : liveMatches.length ? (
            <div className="cz-user-match-grid">
              {liveMatches.map((match) => (
                <MatchScorecard
                  key={getId(match)}
                  match={match}
                  deliveries={deliveriesByMatch[String(getId(match))] ?? []}
                  onView={() => openMatch(match)}
                />
              ))}
            </div>
          ) : (
            <div className="cz-user-empty">
              <span className="cz-user-empty-icon">🏏</span>
              <strong>No live matches right now</strong>
              <p>Check the upcoming fixtures below and come back for live action.</p>
            </div>
          )}
        </section>

        <section className="cz-user-section" id="cz-user-matches">
          <div className="cz-user-section-heading">
            <div>
              <span className="cz-user-section-kicker">THE FIXTURES</span>
              <h2>Find your match</h2>
              <p>Search teams, venues and formats, or filter by status.</p>
            </div>
          </div>

          <div className="cz-user-filter-panel">
            <label className="cz-user-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search teams, venue or format..."
                aria-label="Search matches"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  ×
                </button>
              )}
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by match status"
            >
              <option value="ALL">All statuses</option>
              <option value="LIVE">Live</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <select
              value={formatFilter}
              onChange={(event) => setFormatFilter(event.target.value)}
              aria-label="Filter by match format"
            >
              <option value="ALL">All formats</option>
              {formats.map((format) => (
                <option value={format} key={format}>{format}</option>
              ))}
            </select>
          </div>

          <div className="cz-user-match-tabs">
            {[
              ["ALL", "All matches"],
              ["LIVE", "Live"],
              ["UPCOMING", "Upcoming"],
              ["COMPLETED", "Results"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={activeTab === value ? "active" : ""}
                onClick={() => setActiveTab(value)}
              >
                {label}
              </button>
            ))}
            <span>{filteredMatches.length} matches</span>
          </div>

          {loading && matches.length === 0 ? (
            <div className="cz-user-empty">Loading fixtures...</div>
          ) : filteredMatches.length ? (
            <div className="cz-user-fixture-grid">
              {filteredMatches.map((match) => (
                <FixtureCard
                  key={getId(match)}
                  match={match}
                  completed={isCompleted(match)}
                  onView={() => openMatch(match)}
                />
              ))}
            </div>
          ) : (
            <div className="cz-user-empty">
              <strong>No matches found</strong>
              <p>Try a different search term or change the filters.</p>
              <button
                className="cz-user-outline-button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setFormatFilter("ALL");
                  setActiveTab("ALL");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        
<section className="cz-user-section cz-player-performance">
  <div className="cz-user-section-heading">
    <div>
      <span className="cz-user-section-kicker">PLAYER WATCH</span>
      <h2>Player performance</h2>
      <p>Batting and bowling numbers calculated from recorded deliveries.</p>
    </div>
    <span className="cz-player-count">
      {playerStatistics.length} players
    </span>
  </div>

  {playerStatistics.length > 0 ? (
    <>
      <div className="cz-player-highlight-grid">
        {[
          {
            label: "TOP RUN SCORER",
            icon: "🏏",
            metric: "runs",
            suffix: "runs",
            player: [...playerStatistics].sort((a, b) => b.runs - a.runs)[0],
          },
          {
            label: "MOST WICKETS",
            icon: "🎯",
            metric: "wickets",
            suffix: "wickets",
            player: [...playerStatistics].sort((a, b) => b.wickets - a.wickets)[0],
          },
          {
            label: "BEST STRIKE RATE",
            icon: "⚡",
            metric: "strikeRate",
            suffix: "SR",
            player: [...playerStatistics]
              .filter((p) => p.ballsFaced >= 5)
              .sort((a, b) => Number(b.strikeRate) - Number(a.strikeRate))[0],
          },
          {
            label: "BEST ECONOMY",
            icon: "📊",
            metric: "economy",
            suffix: "runs/over",
            player: [...playerStatistics]
              .filter((p) => p.ballsBowled >= 6)
              .sort((a, b) => Number(a.economy) - Number(b.economy))[0],
          },
        ].map((item) => (
          <article className="cz-player-highlight" key={item.label}>
            <div className="cz-player-highlight-top">
              <span className="cz-player-highlight-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>

            {item.player ? (
              <>
                <div className="cz-player-highlight-value">
                  {item.player[item.metric]}
                  <small>{item.suffix}</small>
                </div>
                <div className="cz-player-highlight-person">
                  <span className="cz-user-player-avatar">
                    {getInitials(item.player.name)}
                  </span>
                  <span>
                    <strong>{item.player.name}</strong>
                    <small>{item.player.team}</small>
                  </span>
                </div>
              </>
            ) : (
              <div className="cz-player-highlight-empty">
                <strong>—</strong>
                <small>Not enough match data</small>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="cz-player-leaderboard">
        <div className="cz-player-leaderboard-heading">
          <div>
            <span className="cz-user-section-kicker">SEASON OVERVIEW</span>
            <h3>Player leaderboard</h3>
          </div>
          <span className="cz-player-ranking-note">Ranked by runs</span>
        </div>

        <div className="cz-user-table-wrap">
          <table className="cz-user-player-table">
            <thead>
              <tr>
                <th>RANK / PLAYER</th>
                <th>TEAM</th>
                <th>RUNS</th>
                <th>BALLS</th>
                <th>4s / 6s</th>
                <th>STRIKE RATE</th>
                <th>WICKETS</th>
                <th>ECONOMY</th>
              </tr>
            </thead>
            <tbody>
              {playerStatistics.slice(0, 10).map((player, index) => (
                <tr key={player.id}>
                  <td>
                    <div className="cz-user-player-cell">
                      <span className={`cz-user-player-rank ${index < 3 ? "top-rank" : ""}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="cz-user-player-avatar">
                        {getInitials(player.name)}
                      </span>
                      <span>
                        <strong>{player.name}</strong>
                        <small>{player.role}</small>
                      </span>
                    </div>
                  </td>
                  <td>{player.team}</td>
                  <td>
                    <strong className="cz-player-runs">{player.runs}</strong>
                  </td>
                  <td>{player.ballsFaced}</td>
                  <td>
                    <span className="cz-player-boundaries">
                      {player.fours} <small>4s</small>
                      <span>/</span>
                      {player.sixes} <small>6s</small>
                    </span>
                  </td>
                  <td>
                    <span className="cz-player-stat-pill">{player.strikeRate}</span>
                  </td>
                  <td>
                    <strong>{player.wickets}</strong>
                  </td>
                  <td>{player.economy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="cz-user-table-note">
          Stats update automatically from recorded deliveries. Strike rate highlights
          require at least 5 balls faced; economy highlights require at least 6 balls bowled.
        </p>
      </div>
    </>
  ) : (
    <div className="cz-user-empty">
      <strong>No player data available yet</strong>
      <p>Add players in the Admin Dashboard to see their performance here.</p>
    </div>
  )}
</section>


        <footer className="cz-user-footer">
          <span><strong>CRICZONE</strong> · THE GAME. LIVE.</span>
          <span>
            {lastUpdated
              ? `Last synced ${lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Connecting to scoring service..."}
          </span>
        </footer>
      </main>

      {selectedMatch && (
        <div className="cz-user-modal-backdrop" onClick={closeMatch}>
          <section
            className="cz-user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cz-user-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cz-user-modal-header">
              <div>
                <span className="cz-user-section-kicker">MATCH CENTRE</span>
                <h2 id="cz-user-modal-title">
                  {getTeamName(getTeam(selectedMatch, 1))} vs{" "}
                  {getTeamName(getTeam(selectedMatch, 2))}
                </h2>
              </div>
              <button onClick={closeMatch} aria-label="Close match details">×</button>
            </div>

            <p className="cz-user-modal-meta">
              {matchFormat(selectedMatch)} · {formatDate(getMatchDate(selectedMatch))}
            </p>

            <div className="cz-user-modal-score-grid">
              {(deliveriesByMatch[String(getId(selectedMatch))] ?? [])
                .reduce((groups, delivery) => {
                  const number = Number(delivery?.inningsNumber ?? 1);
                  if (!groups[number]) groups[number] = [];
                  groups[number].push(delivery);
                  return groups;
                }, {})
                && Object.entries(
                  (deliveriesByMatch[String(getId(selectedMatch))] ?? [])
                    .reduce((groups, delivery) => {
                      const number = Number(delivery?.inningsNumber ?? 1);
                      if (!groups[number]) groups[number] = [];
                      groups[number].push(delivery);
                      return groups;
                    }, {})
                )
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([number, rows]) => {
                  const score = calculateInnings(rows);
                  return (
                    <div className="cz-user-modal-score" key={number}>
                      <span>Innings {number}</span>
                      <strong>{score.runs}/{score.wickets}</strong>
                      <small>{score.overs} overs</small>
                    </div>
                  );
                })}
            </div>

            {!(deliveriesByMatch[String(getId(selectedMatch))] ?? []).length && (
              <div className="cz-user-empty">
                No scoring deliveries have been recorded for this match yet.
              </div>
            )}

            <div className="cz-user-modal-details">
              <p><strong>Venue</strong><span>{selectedMatch?.venue ?? selectedMatch?.ground ?? "Not announced"}</span></p>
              <p><strong>Status</strong><span>{getStatus(selectedMatch).replaceAll("_", " ")}</span></p>
              <p><strong>Result</strong><span>{selectedMatch?.result ?? selectedMatch?.resultSummary ?? "Result not available"}</span></p>
            </div>

            <button className="cz-user-hero-button cz-user-modal-close" onClick={closeMatch}>
              Close match centre
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
