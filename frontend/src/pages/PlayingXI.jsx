
import { useEffect, useState } from "react";
import API from "../services/api";

const MAX_PLAYERS = 11;

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    background: "#080d18",
    color: "#f4f7fb",
    fontFamily: "Inter, Arial, sans-serif",
    boxSizing: "border-box",
  },
  title: { margin: 0, fontSize: "30px", fontWeight: 800 },
  subtitle: { color: "#91a0b7", marginTop: "9px", fontSize: "13px" },
  panel: {
    padding: "24px",
    marginBottom: "24px",
    border: "1px solid #253148",
    borderRadius: "16px",
    background: "#101a2b",
  },
  label: {
    display: "block",
    marginBottom: "16px",
    color: "#c7d2e2",
    fontSize: "13px",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    marginTop: "8px",
    padding: "12px",
    border: "1px solid #303d53",
    borderRadius: "9px",
    background: "#0a1220",
    color: "#fff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  player: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "11px",
    borderBottom: "1px solid #253148",
    fontSize: "13px",
  },
  button: {
    padding: "13px 20px",
    border: "none",
    borderRadius: "9px",
    background: "#ff9d32",
    color: "#111827",
    fontWeight: 800,
    cursor: "pointer",
  },
};

function getId(item) {
  return item?.id ?? item?.playerId ?? item?.teamId;
}

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function idStrings(ids) {
  return Array.isArray(ids) ? ids.map(String) : [];
}

// Supports teamIds, teams, teamId, and older response formats.
function playerBelongsToTeam(player, teamId) {
  if (teamId == null || !player) return false;

  const targetId = String(teamId);

  const assignedIds = [
    ...(Array.isArray(player.teamIds) ? player.teamIds : []),
    ...(Array.isArray(player.teams)
      ? player.teams.map((team) => team?.id ?? team?.teamId)
      : []),
    player.teamId,
    player.team_id,
    player.team?.id,
    player.team?.teamId,
  ];

  return assignedIds.some(
    (id) => id != null && String(id) === targetId
  );
}

export default function PlayingXI() {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(
    localStorage.getItem("criczone-selected-match-id") || ""
  );
  const [tossWinner, setTossWinner] = useState("");
  const [tossDecision, setTossDecision] = useState("BAT");
  const [team1XI, setTeam1XI] = useState([]);
  const [team2XI, setTeam2XI] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [matchResponse, playerResponse] = await Promise.all([
          API.get("/matches"),
          API.get("/players"),
        ]);

        if (cancelled) return;

        const matchList = unwrapList(matchResponse.data);
        const playerList = unwrapList(playerResponse.data);

        setMatches(matchList);
        setPlayers(playerList);

        const savedId = localStorage.getItem(
          "criczone-selected-match-id"
        );

        const initialMatch =
          matchList.find(
            (item) => String(getId(item)) === String(savedId)
          ) || matchList[0];

        setSelectedMatch(
          initialMatch ? String(getId(initialMatch)) : ""
        );
      } catch (err) {
        console.error("Unable to load matches and players:", err);

        if (!cancelled) {
          setError(
            "Unable to load matches or players. Check the backend and API response."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const match = matches.find(
    (item) => String(getId(item)) === String(selectedMatch)
  );

  const team1Id =
    match?.teamOne?.id ??
    match?.team1?.id ??
    match?.teamOneId ??
    match?.team1Id ??
    match?.team_one_id;

  const team2Id =
    match?.teamTwo?.id ??
    match?.team2?.id ??
    match?.teamTwoId ??
    match?.team2Id ??
    match?.team_two_id;

  useEffect(() => {
    if (!match) {
      setTossWinner("");
      setTossDecision("BAT");
      setTeam1XI([]);
      setTeam2XI([]);
      return;
    }

    let cancelled = false;

    async function loadSelection() {
      setLoadingSelection(true);
      setError("");
      setSuccess("");

      try {
        const response = await API.get(
          `/playing-xi/${getId(match)}`
        );

        if (cancelled) return;

        const saved = response.data || {};
        const savedOne = idStrings(saved.teamOnePlayerIds);
        const savedTwo = idStrings(saved.teamTwoPlayerIds);

        if (savedOne.length || savedTwo.length) {
          setTossWinner(
            saved.tossWinnerTeamId == null
              ? ""
              : String(saved.tossWinnerTeamId)
          );

          setTossDecision(
            String(saved.tossDecision || "BAT").toUpperCase()
          );

          setTeam1XI(savedOne);
          setTeam2XI(savedTwo);
        } else {
          // Support selections saved by the older frontend.
          const localSaved = JSON.parse(
            localStorage.getItem(`playingXI_${getId(match)}`) ||
              "null"
          );

          if (localSaved) {
            setTossWinner(String(localSaved.tossWinner || ""));

            setTossDecision(
              String(localSaved.tossDecision || "BAT").toUpperCase()
            );

            setTeam1XI(idStrings(localSaved.team1XI));
            setTeam2XI(idStrings(localSaved.team2XI));
          } else {
            setTossWinner(
              saved.tossWinnerTeamId == null
                ? ""
                : String(saved.tossWinnerTeamId)
            );

            setTossDecision(
              String(saved.tossDecision || "BAT").toUpperCase()
            );

            setTeam1XI([]);
            setTeam2XI([]);
          }
        }
      } catch (err) {
        console.error("Unable to load saved Playing XI:", err);

        if (!cancelled) {
          setError(
            "Unable to load the saved Playing XI. Check the backend and Playing XI API."
          );
        }
      } finally {
        if (!cancelled) setLoadingSelection(false);
      }
    }

    loadSelection();

    return () => {
      cancelled = true;
    };
  }, [selectedMatch, match]);

  // Filter using the new teamIds array as well as legacy team fields.
  const team1Players = players.filter((player) =>
    playerBelongsToTeam(player, team1Id)
  );

  const team2Players = players.filter((player) =>
    playerBelongsToTeam(player, team2Id)
  );

  function togglePlayer(teamNumber, playerId) {
    setError("");
    setSuccess("");

    const id = String(playerId);
    const current = teamNumber === 1 ? team1XI : team2XI;
    const other = teamNumber === 1 ? team2XI : team1XI;
    const update = teamNumber === 1 ? setTeam1XI : setTeam2XI;

    if (current.includes(id)) {
      update(current.filter((value) => value !== id));
      return;
    }

    if (other.includes(id)) {
      setError("A player cannot be selected for both teams.");
      return;
    }

    if (current.length >= MAX_PLAYERS) {
      setError("Each team can have a maximum of 11 players.");
      return;
    }

    update([...current, id]);
  }

  async function saveSelection() {
    setError("");
    setSuccess("");

    if (!match) {
      setError("Please select a match.");
      return;
    }

    if (!tossWinner) {
      setError("Please select the toss winner.");
      return;
    }

    if (
      String(tossWinner) !== String(team1Id) &&
      String(tossWinner) !== String(team2Id)
    ) {
      setError("The toss winner must be one of the teams in this match.");
      return;
    }

    if (
      team1XI.length !== MAX_PLAYERS ||
      team2XI.length !== MAX_PLAYERS
    ) {
      setError(
        `Select exactly 11 players per team. Team 1: ${team1XI.length}/11, Team 2: ${team2XI.length}/11.`
      );
      return;
    }

    if (new Set([...team1XI, ...team2XI]).size !== 22) {
      setError("A player cannot appear in both Playing XIs.");
      return;
    }

    const payload = {
      tossWinnerTeamId: Number(tossWinner),
      tossDecision: tossDecision.toUpperCase(),
      teamOnePlayerIds: team1XI.map(Number),
      teamTwoPlayerIds: team2XI.map(Number),
    };

    setSaving(true);

    try {
      const response = await API.put(
        `/playing-xi/${getId(match)}`,
        payload
      );

      const saved = response.data || payload;

      setTossWinner(String(saved.tossWinnerTeamId));
      setTossDecision(
        String(saved.tossDecision || payload.tossDecision).toUpperCase()
      );
      setTeam1XI(idStrings(saved.teamOnePlayerIds));
      setTeam2XI(idStrings(saved.teamTwoPlayerIds));

      localStorage.setItem(
        "criczone-selected-match-id",
        String(getId(match))
      );

      // Keep compatibility with existing frontend components.
      localStorage.setItem(
        `playingXI_${getId(match)}`,
        JSON.stringify({
          matchId: getId(match),
          tossWinner: String(saved.tossWinnerTeamId),
          tossDecision: saved.tossDecision || payload.tossDecision,
          team1XI: idStrings(saved.teamOnePlayerIds),
          team2XI: idStrings(saved.teamTwoPlayerIds),
        })
      );

      setSuccess("Toss and Playing XI saved to the database successfully.");

      window.dispatchEvent(
        new CustomEvent("criczone:playing-xi-saved", {
          detail: { matchId: getId(match) },
        })
      );

      window.dispatchEvent(
        new CustomEvent("criczone:open-opening-players", {
          detail: { matchId: getId(match) },
        })
      );
    } catch (err) {
      console.error("Playing XI save failed:", err);

      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Unable to save Playing XI. Check the backend terminal."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderTeamPlayers(team, selected, teamNumber, teamPlayers) {
    const teamName =
      team?.name ||
      (teamNumber === 1
        ? match?.teamOneName || match?.team1Name
        : match?.teamTwoName || match?.team2Name) ||
      `Team ${teamNumber}`;

    return (
      <section key={teamNumber} style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>{teamName} — Playing XI</h2>

        <p style={{ color: "#91a0b7", fontSize: "12px" }}>
          Selected: {selected.length}/11
        </p>

        {teamPlayers.length === 0 ? (
          <p>
            No players assigned to this team. Check the match team IDs and
            the Players API response.
          </p>
        ) : (
          teamPlayers.map((player) => {
            const id = String(getId(player));
            const checked = selected.includes(id);
            const other = teamNumber === 1 ? team2XI : team1XI;

            return (
              <label key={id} style={styles.player}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={
                    loadingSelection ||
                    saving ||
                    (!checked &&
                      (selected.length >= MAX_PLAYERS ||
                        other.includes(id)))
                  }
                  onChange={() => togglePlayer(teamNumber, id)}
                />

                <span style={{ flex: 1 }}>
                  {player.name || player.playerName}
                  <span style={{ color: "#91a0b7" }}>
                    {" "}· {player.role || "Player"}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </section>
    );
  }

  return (
    <main style={styles.page}>
      <header style={{ marginBottom: "28px" }}>
        <h1 style={styles.title}>Toss & Playing XI</h1>
        <p style={styles.subtitle}>
          Choose a match, record the toss and select eleven players for
          each team. Saved selections are shared through the backend.
        </p>
      </header>

      {loading ? (
        <section style={styles.panel}>Loading matches and players...</section>
      ) : (
        <>
          <section style={styles.panel}>
            <h2 style={{ marginTop: 0 }}>Match & Toss Details</h2>

            <label style={styles.label}>
              Select Match
              <select
                style={styles.input}
                value={selectedMatch}
                disabled={saving}
                onChange={(event) => {
                  const id = event.target.value;
                  setSelectedMatch(id);

                  if (id) {
                    localStorage.setItem(
                      "criczone-selected-match-id",
                      id
                    );
                  }

                  setError("");
                  setSuccess("");
                }}
              >
                <option value="">Choose a match</option>
                {matches.map((item) => (
                  <option key={getId(item)} value={getId(item)}>
                    {item.teamOne?.name ||
                      item.team1?.name ||
                      item.teamOneName ||
                      item.team1Name ||
                      "Team 1"}{" "}
                    vs{" "}
                    {item.teamTwo?.name ||
                      item.team2?.name ||
                      item.teamTwoName ||
                      item.team2Name ||
                      "Team 2"}{" "}
                    — {item.matchFormat || item.matchType || "Match"}
                  </option>
                ))}
              </select>
            </label>

            {match && (
              <div style={styles.grid}>
                <label style={styles.label}>
                  Toss Winner
                  <select
                    style={styles.input}
                    value={tossWinner}
                    disabled={loadingSelection || saving}
                    onChange={(event) =>
                      setTossWinner(event.target.value)
                    }
                  >
                    <option value="">Select toss winner</option>
                    <option value={String(team1Id)}>
                      {match.teamOne?.name ||
                        match.team1?.name ||
                        match.teamOneName ||
                        match.team1Name ||
                        "Team 1"}
                    </option>
                    <option value={String(team2Id)}>
                      {match.teamTwo?.name ||
                        match.team2?.name ||
                        match.teamTwoName ||
                        match.team2Name ||
                        "Team 2"}
                    </option>
                  </select>
                </label>

                <label style={styles.label}>
                  Toss Decision
                  <select
                    style={styles.input}
                    value={tossDecision}
                    disabled={loadingSelection || saving}
                    onChange={(event) =>
                      setTossDecision(event.target.value)
                    }
                  >
                    <option value="BAT">Bat first</option>
                    <option value="BOWL">Bowl first</option>
                  </select>
                </label>
              </div>
            )}
          </section>

          {loadingSelection && (
            <section style={styles.panel}>
              Loading saved toss and Playing XI...
            </section>
          )}

          {match && !loadingSelection && (
            <div style={styles.grid}>
              {renderTeamPlayers(
                match.teamOne || match.team1,
                team1XI,
                1,
                team1Players
              )}

              {renderTeamPlayers(
                match.teamTwo || match.team2,
                team2XI,
                2,
                team2Players
              )}
            </div>
          )}

          {matches.length === 0 && (
            <section style={styles.panel}>
              No matches found. Create a match in Match Center first.
            </section>
          )}

          {error && (
            <p role="alert" style={{ color: "#ff7777" }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ color: "#62e6a0" }}>{success}</p>
          )}

          {match && (
            <button
              style={{
                ...styles.button,
                opacity: saving || loadingSelection ? 0.65 : 1,
              }}
              disabled={saving || loadingSelection}
              onClick={saveSelection}
            >
              {saving
                ? "Saving..."
                : "Save Toss & Playing XI → Live Scoring"}
            </button>
          )}
        </>
      )}
    </main>
  );
}
