
import { useCallback, useEffect, useState } from "react";
import API from "../services/api";

const initialForm = {
  title: "",
  teamOneId: "",
  teamTwoId: "",
  matchFormat: "T20",
  totalOvers: "20",
  matchDate: "",
  venue: "",
  tossWinnerTeamId: "",
  tossDecision: "BAT",
};

const colors = {
  background: "#0b1020",
  card: "#121a2b",
  cardLight: "#182238",
  border: "rgba(255,255,255,0.10)",
  text: "#f4f7fb",
  muted: "#98a5bb",
  accent: "#c6f36a",
  danger: "#ff9999",
};

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.matches)) return data.matches;
  return [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    (typeof error?.response?.data === "string"
      ? error.response.data
      : null) ||
    error?.message ||
    fallback
  );
}

function formatDate(date) {
  if (!date) return "Date not set";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayStatus(status) {
  const value = String(status || "UPCOMING").toUpperCase();

  if (value === "UPCOMING" || value === "SCHEDULED") {
    return "Upcoming";
  }

  if (value === "LIVE") return "Live";
  if (value === "COMPLETED") return "Completed";
  if (value === "ABANDONED") return "Abandoned";

  return value;
}

function toLocalDateTimeInput(value) {
  if (!value) return "";

  // The backend returns LocalDateTime without a timezone suffix.
  return String(value).slice(0, 16);
}

const buttonStyle = {
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "11px 16px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

export default function Matches() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [teamResponse, matchResponse] = await Promise.all([
        API.get("/teams"),
        API.get("/matches"),
      ]);

      setTeams(unwrapList(teamResponse.data));
      setMatches(unwrapList(matchResponse.data));
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load matches. Check that Spring Boot and MySQL are running."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((previous) => {
      const next = {
        ...previous,
        [name]: value,
      };

      if (name === "matchFormat") {
        if (value === "T10") next.totalOvers = "10";
        else if (value === "T20") next.totalOvers = "20";
        else if (value === "ODI") next.totalOvers = "50";
        else if (value === "TEST") next.totalOvers = "90";
        else if (value === "CUSTOM") next.totalOvers = "20";
      }

      if (name === "teamOneId" || name === "teamTwoId") {
        const selectedId = value;
        const otherId =
          name === "teamOneId"
            ? previous.teamTwoId
            : previous.teamOneId;

        if (selectedId && selectedId === otherId) {
          next[
            name === "teamOneId" ? "teamTwoId" : "teamOneId"
          ] = "";
        }

        if (
          next.tossWinnerTeamId &&
          next.tossWinnerTeamId !== next.teamOneId &&
          next.tossWinnerTeamId !== next.teamTwoId
        ) {
          next.tossWinnerTeamId = "";
        }
      }

      return next;
    });
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (teams.length < 2) {
      setError("Create at least two teams before scheduling a match.");
      return;
    }

    if (!form.title.trim()) {
      setError("Enter a match title.");
      return;
    }

    if (!form.teamOneId || !form.teamTwoId) {
      setError("Select both teams.");
      return;
    }

    if (form.teamOneId === form.teamTwoId) {
      setError("Choose two different teams.");
      return;
    }

    if (!form.matchDate) {
      setError("Choose the match date and time.");
      return;
    }

    const overs = Number(form.totalOvers);

    if (!Number.isInteger(overs) || overs < 1 || overs > 450) {
      setError("Overs must be a whole number between 1 and 450.");
      return;
    }

    if (
      form.tossWinnerTeamId &&
      form.tossWinnerTeamId !== form.teamOneId &&
      form.tossWinnerTeamId !== form.teamTwoId
    ) {
      setError("The toss winner must be one of the selected teams.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      teamOneId: Number(form.teamOneId),
      teamTwoId: Number(form.teamTwoId),
      matchFormat: form.matchFormat,
      totalOvers: overs,
      matchDate: form.matchDate,
      venue: form.venue.trim(),
      tossWinnerTeamId: form.tossWinnerTeamId
        ? Number(form.tossWinnerTeamId)
        : null,
      tossDecision: form.tossWinnerTeamId
        ? form.tossDecision
        : null,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await API.put(`/matches/${editingId}`, payload);
        setSuccess("Match updated successfully.");
      } else {
        const response = await API.post("/matches", payload);
        setSuccess("Match scheduled successfully.");

        if (response.data?.id) {
          // Keep the selected match available to the Playing XI page.
          try {
            window.localStorage.setItem(
              "criczone-selected-match-id",
              String(response.data.id)
            );
          } catch {
            // The match is already saved; storage is optional.
          }
        }
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to save the match.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (match) => {
    setEditingId(match.id);

    setForm({
      title: match.title || "",
      teamOneId: String(match.teamOneId ?? ""),
      teamTwoId: String(match.teamTwoId ?? ""),
      matchFormat: match.matchFormat || "T20",
      totalOvers: String(match.totalOvers ?? 20),
      matchDate: toLocalDateTimeInput(match.matchDate),
      venue: match.venue || "",
      tossWinnerTeamId:
        match.tossWinnerTeamId == null
          ? ""
          : String(match.tossWinnerTeamId),
      tossDecision: match.tossDecision || "BAT",
    });

    setError("");
    setSuccess("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (match) => {
    const confirmed = window.confirm(
      `Delete "${match.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(match.id);
    setError("");
    setSuccess("");

    try {
      await API.delete(`/matches/${match.id}`);

      if (editingId === match.id) {
        resetForm();
      }

      setMatches((previous) =>
        previous.filter((item) => item.id !== match.id)
      );

      setSuccess("Match deleted successfully.");
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to delete this match.")
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrepareXI = (match) => {
    try {
      window.localStorage.setItem(
        "criczone-selected-match-id",
        String(match.id)
      );
    } catch {
      // The event can still navigate within the current page.
    }

    window.dispatchEvent(
      new CustomEvent("criczone:open-playing-xi", {
        detail: { matchId: match.id },
      })
    );
  };

  const filteredMatches = matches.filter((match) => {
    const searchText = [
      match.title,
      match.teamOneName,
      match.teamOneShortName,
      match.teamTwoName,
      match.teamTwoShortName,
      match.venue,
      match.matchFormat,
      match.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchText.includes(
      search.trim().toLowerCase()
    );

    const status = String(match.status || "UPCOMING").toUpperCase();

    const matchesStatus =
      statusFilter === "ALL" ||
      status === statusFilter ||
      (statusFilter === "UPCOMING" && status === "SCHEDULED");

    return matchesSearch && matchesStatus;
  });

  const upcomingCount = matches.filter((match) =>
    ["UPCOMING", "SCHEDULED"].includes(
      String(match.status || "UPCOMING").toUpperCase()
    )
  ).length;

  const liveCount = matches.filter(
    (match) => String(match.status).toUpperCase() === "LIVE"
  ).length;

  const completedCount = matches.filter(
    (match) => String(match.status).toUpperCase() === "COMPLETED"
  ).length;

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 45,
    padding: "11px 12px",
    marginTop: 8,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    outline: "none",
    color: colors.text,
    background: "#0b1220",
    fontSize: 13,
  };

  const labelStyle = {
    display: "block",
    color: "#dce4f0",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 17,
  };

  const panelStyle = {
    padding: 22,
    border: `1px solid ${colors.border}`,
    borderRadius: 17,
    background: `linear-gradient(145deg, ${colors.card}, #0f1625)`,
    boxShadow: "0 15px 35px rgba(0,0,0,0.12)",
  };

  return (
    <main
      style={{
        minHeight: "100%",
        padding: "clamp(14px, 3vw, 30px)",
        color: colors.text,
        background: colors.background,
        fontFamily: "Inter, Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .cz-match-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0 18px;
        }

        .cz-match-card-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .cz-match-card {
          transition: transform 160ms ease, border-color 160ms ease;
        }

        .cz-match-card:hover {
          transform: translateY(-2px);
          border-color: rgba(198,243,106,0.38) !important;
        }

        .cz-match-field:focus {
          border-color: ${colors.accent} !important;
          box-shadow: 0 0 0 3px rgba(198,243,106,0.08);
        }

        @media (max-width: 720px) {
          .cz-match-form-grid,
          .cz-match-card-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 18,
          marginBottom: 25,
        }}
      >
        <div>
          <div
            style={{
              color: colors.accent,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 9,
            }}
          >
            CRICKET MANAGEMENT / FIXTURES
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(27px, 4vw, 38px)",
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            Match Center<span style={{ color: colors.accent }}>.</span>
          </h1>

          <p style={{ color: colors.muted, fontSize: 13 }}>
            Schedule fixtures and prepare your teams for match day.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          style={{
            ...buttonStyle,
            color: colors.accent,
            background: colors.cardLight,
            borderColor: colors.border,
          }}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </header>

      {(error || success) && (
        <div
          role={error ? "alert" : "status"}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "13px 15px",
            marginBottom: 20,
            border: `1px solid ${
              error ? "rgba(255,130,130,.3)" : "rgba(198,243,106,.25)"
            }`,
            borderRadius: 11,
            color: error ? colors.danger : colors.accent,
            background: error
              ? "rgba(120,30,30,.13)"
              : "rgba(198,243,106,.05)",
            fontSize: 13,
          }}
        >
          <span>{error || success}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
            }}
            style={{
              border: 0,
              color: "inherit",
              background: "transparent",
              cursor: "pointer",
              fontSize: 19,
            }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 13,
          marginBottom: 25,
        }}
      >
        {[
          { label: "Total Matches", value: matches.length, icon: "🏏" },
          { label: "Upcoming", value: upcomingCount, icon: "◷" },
          { label: "Live Matches", value: liveCount, icon: "●" },
          { label: "Completed", value: completedCount, icon: "✓" },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              ...panelStyle,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                color: colors.muted,
                fontSize: 12,
              }}
            >
              {item.label}
              <span style={{ color: colors.accent }}>{item.icon}</span>
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 29,
                fontWeight: 900,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <section style={{ ...panelStyle, marginBottom: 25 }}>
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              color: colors.accent,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            MATCH SETUP
          </div>

          <h2 style={{ margin: 0, fontSize: 21 }}>
            {editingId !== null ? "Edit Match" : "Schedule a Match"}
          </h2>

          <p style={{ color: colors.muted, fontSize: 12, lineHeight: 1.6 }}>
            Choose teams, format, venue and toss details.
          </p>
        </div>

        {teams.length < 2 && !loading ? (
          <div
            style={{
              padding: 18,
              borderRadius: 12,
              color: colors.muted,
              background: "#0b1220",
              fontSize: 13,
            }}
          >
            Create at least two teams in the Teams page before scheduling
            a match.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="cz-match-form-grid">
              <label style={labelStyle}>
                Match Title *
                <input
                  className="cz-match-field"
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  placeholder="e.g. Weekend League Final"
                  maxLength={150}
                  required
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Match Format *
                <select
                  className="cz-match-field"
                  name="matchFormat"
                  value={form.matchFormat}
                  onChange={updateField}
                  style={fieldStyle}
                >
                  <option value="T10">T10 — 10 overs</option>
                  <option value="T20">T20 — 20 overs</option>
                  <option value="ODI">ODI — 50 overs</option>
                  <option value="TEST">Test Match</option>
                  <option value="CUSTOM">Custom Format</option>
                </select>
              </label>

              <label style={labelStyle}>
                First Team *
                <select
                  className="cz-match-field"
                  name="teamOneId"
                  value={form.teamOneId}
                  onChange={updateField}
                  required
                  style={fieldStyle}
                >
                  <option value="">Select first team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.shortName || "TEAM"})
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                Second Team *
                <select
                  className="cz-match-field"
                  name="teamTwoId"
                  value={form.teamTwoId}
                  onChange={updateField}
                  required
                  style={fieldStyle}
                >
                  <option value="">Select second team</option>
                  {teams
                    .filter(
                      (team) => String(team.id) !== form.teamOneId
                    )
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.shortName || "TEAM"})
                      </option>
                    ))}
                </select>
              </label>

              <label style={labelStyle}>
                Overs *
                <input
                  className="cz-match-field"
                  type="number"
                  name="totalOvers"
                  min="1"
                  max="450"
                  step="1"
                  value={form.totalOvers}
                  onChange={updateField}
                  required
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Match Date & Time *
                <input
                  className="cz-match-field"
                  type="datetime-local"
                  name="matchDate"
                  value={form.matchDate}
                  onChange={updateField}
                  required
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Venue / Ground
                <input
                  className="cz-match-field"
                  name="venue"
                  value={form.venue}
                  onChange={updateField}
                  placeholder="e.g. Hyderabad Cricket Ground"
                  maxLength={200}
                  style={fieldStyle}
                />
              </label>

              <label style={labelStyle}>
                Toss Winner (optional)
                <select
                  className="cz-match-field"
                  name="tossWinnerTeamId"
                  value={form.tossWinnerTeamId}
                  onChange={updateField}
                  style={fieldStyle}
                >
                  <option value="">Not decided yet</option>
                  {teams
                    .filter(
                      (team) =>
                        String(team.id) === form.teamOneId ||
                        String(team.id) === form.teamTwoId
                    )
                    .map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                </select>
              </label>

              {form.tossWinnerTeamId && (
                <label style={labelStyle}>
                  Toss Decision *
                  <select
                    className="cz-match-field"
                    name="tossDecision"
                    value={form.tossDecision}
                    onChange={updateField}
                    style={fieldStyle}
                  >
                    <option value="BAT">Bat First</option>
                    <option value="BOWL">Bowl First</option>
                  </select>
                </label>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 5,
              }}
            >
              <button
                type="submit"
                disabled={saving || loading}
                style={{
                  ...buttonStyle,
                  color: "#10170a",
                  background: colors.accent,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                    ? "Save Changes"
                    : "Schedule Match"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setError("");
                    setSuccess("");
                  }}
                  style={{
                    ...buttonStyle,
                    color: colors.text,
                    background: colors.cardLight,
                    borderColor: colors.border,
                  }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 21 }}>All Matches</h2>
            <p style={{ color: colors.muted, fontSize: 12 }}>
              {filteredMatches.length} fixture
              {filteredMatches.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(135px, 190px)",
            gap: 10,
            marginBottom: 17,
          }}
        >
          <input
            className="cz-match-field"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, teams or venue..."
            aria-label="Search matches"
            style={{ ...fieldStyle, marginTop: 0 }}
          />

          <select
            className="cz-match-field"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter matches by status"
            style={{ ...fieldStyle, marginTop: 0 }}
          >
            <option value="ALL">All Statuses</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="LIVE">Live</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {loading ? (
          <div style={{ ...panelStyle, color: colors.muted }}>
            Loading matches...
          </div>
        ) : filteredMatches.length === 0 ? (
          <div
            style={{
              ...panelStyle,
              textAlign: "center",
              padding: "38px 20px",
            }}
          >
            <div style={{ fontSize: 35 }}>🏏</div>
            <h3>
              {matches.length === 0
                ? "No matches scheduled yet"
                : "No matches found"}
            </h3>
            <p style={{ color: colors.muted, fontSize: 13 }}>
              {matches.length === 0
                ? "Create your first match using the form above."
                : "Change your search or status filter."}
            </p>
          </div>
        ) : (
          <div className="cz-match-card-grid">
            {filteredMatches.map((match) => {
              const status = String(
                match.status || "UPCOMING"
              ).toUpperCase();

              const statusColor =
                status === "LIVE"
                  ? "#ffb68a"
                  : status === "COMPLETED"
                    ? "#a9e89b"
                    : colors.accent;

              return (
                <article
                  key={match.id}
                  className="cz-match-card"
                  style={{
                    ...panelStyle,
                    minWidth: 0,
                    padding: 19,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        color: colors.accent,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {match.matchFormat} · {match.totalOvers} overs
                    </span>

                    <span
                      style={{
                        padding: "6px 9px",
                        borderRadius: 30,
                        color: statusColor,
                        background: "rgba(255,255,255,0.04)",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      {displayStatus(match.status)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1fr) auto minmax(0, 1fr)",
                      alignItems: "center",
                      gap: 10,
                      padding: "25px 0",
                    }}
                  >
                    <div style={{ textAlign: "center", minWidth: 0 }}>
                      <div
                        style={{
                          color: colors.accent,
                          fontSize: 23,
                          fontWeight: 900,
                        }}
                      >
                        {match.teamOneShortName ||
                          match.teamOneName?.slice(0, 3).toUpperCase()}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 12,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {match.teamOneName}
                      </div>
                      <small style={{ color: colors.muted }}>
                        {match.teamOneScore ?? 0}/
                        {match.teamOneWickets ?? 0}
                      </small>
                    </div>

                    <span
                      style={{
                        color: colors.muted,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      VS
                    </span>

                    <div style={{ textAlign: "center", minWidth: 0 }}>
                      <div style={{ fontSize: 23, fontWeight: 900 }}>
                        {match.teamTwoShortName ||
                          match.teamTwoName?.slice(0, 3).toUpperCase()}
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 12,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {match.teamTwoName}
                      </div>
                      <small style={{ color: colors.muted }}>
                        {match.teamTwoScore ?? 0}/
                        {match.teamTwoWickets ?? 0}
                      </small>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: `1px solid ${colors.border}`,
                      paddingTop: 13,
                      color: colors.muted,
                      fontSize: 12,
                      lineHeight: 1.8,
                    }}
                  >
                    <div>📍 {match.venue || "Venue not specified"}</div>
                    <div>◷ {formatDate(match.matchDate)}</div>
                    {match.tossWinnerName && (
                      <div>
                        🪙 Toss: {match.tossWinnerName} chose{" "}
                        {match.tossDecision === "BAT" ? "to bat" : "to bowl"}
                      </div>
                    )}
                    {match.result && (
                      <div style={{ color: colors.accent }}>
                        {match.result}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 16,
                    }}
                  >
                    {status !== "LIVE" && status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => handleEdit(match)}
                        style={{
                          ...buttonStyle,
                          flex: 1,
                          color: colors.accent,
                          background: colors.cardLight,
                          borderColor: colors.border,
                        }}
                      >
                        Edit
                      </button>
                    )}

                    {status === "UPCOMING" ||
                    status === "SCHEDULED" ? (
                      <button
                        type="button"
                        onClick={() => handlePrepareXI(match)}
                        style={{
                          ...buttonStyle,
                          flex: 1,
                          color: "#10170a",
                          background: colors.accent,
                        }}
                      >
                        Prepare XI →
                      </button>
                    ) : null}

                    {status !== "LIVE" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(match)}
                        disabled={deletingId === match.id}
                        style={{
                          ...buttonStyle,
                          color: colors.danger,
                          background: "rgba(160,40,40,0.12)",
                          borderColor: "rgba(255,120,120,0.2)",
                        }}
                      >
                        {deletingId === match.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
