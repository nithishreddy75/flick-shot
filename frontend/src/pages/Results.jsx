import { useEffect, useMemo, useState } from "react";
import API from "../services/api";

const idOf = (value) =>
  value == null ? "" : String(typeof value === "object" ? value.id ?? "" : value);

const teamName = (match, side) =>
  match?.[`${side}Name`] ||
  match?.[side]?.name ||
  match?.[side === "teamOne" ? "teamOneShortName" : "teamTwoShortName"] ||
  "Team";

const playerName = (value) =>
  value?.name || value?.fullName || (value?.id ? `Player ${value.id}` : "—");

const extraType = (delivery) =>
  String(delivery?.extraType || "NONE").toUpperCase();

const isLegal = (delivery) =>
  !["WIDE", "NO_BALL"].includes(extraType(delivery));

const totalRuns = (delivery) =>
  Number(delivery?.runsScored || 0) + Number(delivery?.extraRuns || 0);

function scoreFor(deliveries, innings) {
  const list = deliveries.filter(
    (delivery) => Number(delivery.inningsNumber) === innings
  );

  const runs = list.reduce((sum, delivery) => sum + totalRuns(delivery), 0);
  const wickets = list.filter((delivery) => delivery.wicket === true).length;
  const legalBalls = list.filter(isLegal).length;

  return {
    runs,
    wickets,
    legalBalls,
    overs: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`,
    deliveries: list,
  };
}

function topBatter(deliveries, innings) {
  const stats = new Map();

  deliveries
    .filter((delivery) => Number(delivery.inningsNumber) === innings)
    .forEach((delivery) => {
      const batterId = idOf(delivery.striker);
      if (!batterId) return;

      const current = stats.get(batterId) || {
        name: playerName(delivery.striker),
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      };

      const batRuns = Number(delivery.runsScored || 0);
      current.runs += batRuns;

      if (isLegal(delivery)) current.balls += 1;
      if (batRuns === 4) current.fours += 1;
      if (batRuns === 6) current.sixes += 1;

      stats.set(batterId, current);
    });

  return [...stats.values()].sort((a, b) => b.runs - a.runs)[0] || null;
}

function topBowler(deliveries, innings) {
  const stats = new Map();

  deliveries
    .filter((delivery) => Number(delivery.inningsNumber) === innings)
    .forEach((delivery) => {
      const bowlerId = idOf(delivery.bowler);
      if (!bowlerId) return;

      const current = stats.get(bowlerId) || {
        name: playerName(delivery.bowler),
        runs: 0,
        wickets: 0,
        balls: 0,
      };

      current.runs += totalRuns(delivery);
      if (isLegal(delivery)) current.balls += 1;
      if (delivery.wicket === true) current.wickets += 1;

      stats.set(bowlerId, current);
    });

  return [...stats.values()].sort(
    (a, b) => b.wickets - a.wickets || a.runs - b.runs
  )[0] || null;
}

function matchStatus(match) {
  return String(match?.status || "UPCOMING").toUpperCase();
}

export default function Results() {
  const [matches, setMatches] = useState([]);
  const [deliveryMap, setDeliveryMap] = useState({});
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResults() {
      try {
        setLoading(true);
        setError("");

        const response = await API.get("/matches");
        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.content || [];

        const results = await Promise.all(
          list.map(async (match) => {
            try {
              const deliveryResponse = await API.get(
                `/live-scoring/${match.id}`
              );

              return [
                idOf(match.id),
                Array.isArray(deliveryResponse.data)
                  ? deliveryResponse.data
                  : [],
              ];
            } catch {
              return [idOf(match.id), []];
            }
          })
        );

        if (active) {
          setMatches(list);
          setDeliveryMap(Object.fromEntries(results));
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.error ||
              err.response?.data?.message ||
              "Unable to load match results. Check that the backend is running."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadResults();
    return () => {
      active = false;
    };
  }, []);

  const filteredMatches = useMemo(() => {
    const term = search.trim().toLowerCase();

    return matches.filter((match) => {
      const status = matchStatus(match);
      const firstName = teamName(match, "teamOne");
      const secondName = teamName(match, "teamTwo");

      const matchesFilter =
        filter === "ALL" ||
        (filter === "RESULT" && status === "COMPLETED") ||
        (filter === "LIVE" && status === "LIVE") ||
        (filter === "UPCOMING" &&
          !["LIVE", "COMPLETED"].includes(status));

      const matchesSearch =
        !term ||
        `${match.title || ""} ${firstName} ${secondName} ${match.venue || ""}`
          .toLowerCase()
          .includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [matches, filter, search]);

  const styles = {
    page: {
      minHeight: "100vh",
      padding: "28px",
      color: "#edf7f1",
      background:
        "radial-gradient(circle at top right, #123d32, #071b17 50%, #06110f)",
      fontFamily: "Inter, system-ui, sans-serif",
    },
    panel: {
      background: "rgba(15, 39, 32, .95)",
      border: "1px solid #285747",
      borderRadius: 18,
      padding: 20,
      marginBottom: 18,
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      background: "#102c24",
      color: "#f3fff8",
      border: "1px solid #386956",
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
    },
    button: (active) => ({
      background: active ? "#c6f36a" : "#173c30",
      color: active ? "#122015" : "#f3fff8",
      border: "1px solid #3e715a",
      borderRadius: 10,
      padding: "10px 14px",
      fontWeight: 800,
      margin: "4px",
      cursor: "pointer",
    }),
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 16,
    },
  };

  return (
    <main style={styles.page}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ color: "#c6f36a", fontWeight: 900, letterSpacing: 3 }}>
          FLICK SHOT
        </div>
        <h1 style={{ margin: "8px 0" }}>Match Results</h1>
        <p style={{ color: "#b7d4c5" }}>
          Scorecards, top performers and completed match history.
        </p>
      </header>

      {error && (
        <section style={{ ...styles.panel, color: "#ffc3c3" }}>{error}</section>
      )}

      <section style={styles.panel}>
        <input
          style={styles.input}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search teams, match title or venue..."
        />

        <div style={{ marginTop: 14 }}>
          {["ALL", "LIVE", "UPCOMING", "RESULT"].map((value) => (
            <button
              key={value}
              style={styles.button(filter === value)}
              onClick={() => setFilter(value)}
            >
              {value === "RESULT" ? "COMPLETED" : value}
            </button>
          ))}
        </div>

        <p style={{ color: "#b7d4c5" }}>
          {filteredMatches.length} match
          {filteredMatches.length === 1 ? "" : "es"}
        </p>
      </section>

      {loading && <p>Loading results…</p>}

      {!loading && filteredMatches.length === 0 && (
        <section style={styles.panel}>
          No matches found for this filter.
        </section>
      )}

      <div style={styles.grid}>
        {filteredMatches.map((match) => {
          const deliveries = deliveryMap[idOf(match.id)] || [];
          const first = scoreFor(deliveries, 1);
          const second = scoreFor(deliveries, 2);
          const status = matchStatus(match);

          const firstBattingId = idOf(
            match.tossWinnerTeamId ??
              match.tossWinner?.id ??
              match.tossWinner
          );

          const firstName = teamName(match, "teamOne");
          const secondName = teamName(match, "teamTwo");

          const firstTeamScore =
            firstBattingId && firstBattingId === idOf(match.teamTwoId ?? match.teamTwo?.id)
              ? second
              : first;

          const secondTeamScore =
            firstTeamScore === first ? second : first;

          const firstBatter = topBatter(deliveries, 1);
          const secondBatter = topBatter(deliveries, 2);
          const firstBowler = topBowler(deliveries, 1);
          const secondBowler = topBowler(deliveries, 2);

          const savedResult =
            typeof match.result === "string" && match.result.trim()
              ? match.result
              : "";

          const computedResult =
            first.runs === second.runs && second.deliveries.length > 0
              ? "Match tied"
              : second.runs > first.runs
                ? "Second innings team won"
                : first.runs > second.runs && second.deliveries.length > 0
                  ? "First innings team won"
                  : "Result pending";

          return (
            <article key={match.id} style={styles.panel}>
              <div
                style={{
                  color: "#c6f36a",
                  fontWeight: 900,
                  fontSize: 12,
                  letterSpacing: 1,
                }}
              >
                {status}
              </div>

              <h2>{match.title || `${firstName} vs ${secondName}`}</h2>
              <p style={{ color: "#b7d4c5" }}>
                {match.venue || "Venue not set"}
                {match.totalOvers || match.overs
                  ? ` · ${match.totalOvers || match.overs} overs`
                  : ""}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                  borderTop: "1px solid #285747",
                  paddingTop: 14,
                }}
              >
                <strong>{firstName}</strong>
                <strong style={{ fontSize: 20 }}>
                  {first.runs}/{first.wickets}
                </strong>
                <span style={{ color: "#b7d4c5" }}>
                  {first.overs} overs
                </span>
                <span />
                <strong>{secondName}</strong>
                <strong style={{ fontSize: 20 }}>
                  {second.runs}/{second.wickets}
                </strong>
                <span style={{ color: "#b7d4c5" }}>
                  {second.overs} overs
                </span>
              </div>

              {status === "COMPLETED" && (
                <h3 style={{ color: "#c6f36a", marginTop: 18 }}>
                  {savedResult || computedResult}
                </h3>
              )}

              <div style={{ marginTop: 18 }}>
                <h3>Top performers</h3>
                <p>
                  <strong>Innings 1 batter:</strong>{" "}
                  {firstBatter
                    ? `${firstBatter.name} — ${firstBatter.runs} runs (${firstBatter.balls} balls)`
                    : "—"}
                </p>
                <p>
                  <strong>Innings 1 bowler:</strong>{" "}
                  {firstBowler
                    ? `${firstBowler.name} — ${firstBowler.wickets} wicket(s)`
                    : "—"}
                </p>
                <p>
                  <strong>Innings 2 batter:</strong>{" "}
                  {secondBatter
                    ? `${secondBatter.name} — ${secondBatter.runs} runs (${secondBatter.balls} balls)`
                    : "—"}
                </p>
                <p>
                  <strong>Innings 2 bowler:</strong>{" "}
                  {secondBowler
                    ? `${secondBowler.name} — ${secondBowler.wickets} wicket(s)`
                    : "—"}
                </p>
              </div>

              <details style={{ marginTop: 18 }}>
                <summary style={{ cursor: "pointer", color: "#c6f36a" }}>
                  View delivery history ({deliveries.length})
                </summary>

                {deliveries.length === 0 ? (
                  <p>No deliveries recorded.</p>
                ) : (
                  <div style={{ overflowX: "auto", marginTop: 12 }}>
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr style={{ color: "#c6f36a", textAlign: "left" }}>
                          <th style={{ padding: 8 }}>Inn.</th>
                          <th style={{ padding: 8 }}>Over.ball</th>
                          <th style={{ padding: 8 }}>Batter</th>
                          <th style={{ padding: 8 }}>Bowler</th>
                          <th style={{ padding: 8 }}>Runs</th>
                          <th style={{ padding: 8 }}>Event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((delivery) => (
                          <tr key={delivery.id}>
                            <td style={{ padding: 8 }}>
                              {delivery.inningsNumber}
                            </td>
                            <td style={{ padding: 8 }}>
                              {Number(delivery.overNumber || 0) + 1}.
                              {delivery.ballNumber}
                            </td>
                            <td style={{ padding: 8 }}>
                              {playerName(delivery.striker)}
                            </td>
                            <td style={{ padding: 8 }}>
                              {playerName(delivery.bowler)}
                            </td>
                            <td style={{ padding: 8 }}>
                              {totalRuns(delivery)}
                            </td>
                            <td style={{ padding: 8 }}>
                              {delivery.wicket
                                ? `WICKET (${delivery.dismissalType || "OUT"})`
                                : extraType(delivery)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            </article>
          );
        })}
      </div>
    </main>
  );
}