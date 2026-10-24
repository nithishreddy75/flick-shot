
import { useCallback, useEffect, useState } from "react";
import API from "../services/api";
import "../Players.css";

const emptyForm = {
  name: "",
  mobileNumber: "",
  role: "Batsman",
  battingStyle: "",
  bowlingStyle: "",
  teamIds: [],
};

const roles = ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"];

function normalizeMobile(value) {
  return value.replace(/[\s()-]/g, "");
}

function getPlayerTeams(player) {
  if (Array.isArray(player.teams)) return player.teams;
  if (player.team) return [player.team];
  if (player.teamId && player.teamName) {
    return [{ id: player.teamId, name: player.teamName }];
  }
  return [];
}

function Players() {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [playersResponse, teamsResponse] = await Promise.all([
        API.get("/players"),
        API.get("/teams"),
      ]);

      setPlayers(
        Array.isArray(playersResponse.data) ? playersResponse.data : []
      );
      setTeams(
        Array.isArray(teamsResponse.data) ? teamsResponse.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load players and teams. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setNotice("");
  };

  const handleTeamChange = (event) => {
    const selectedIds = Array.from(
      event.target.selectedOptions,
      (option) => option.value
    );

    setForm((current) => ({ ...current, teamIds: selectedIds }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.name.trim()) {
      setError("Enter the player's name.");
      return;
    }

    const mobileNumber = normalizeMobile(form.mobileNumber.trim());

    if (!/^\+?[0-9]{7,15}$/.test(mobileNumber)) {
      setError("Enter a valid mobile number with 7–15 digits.");
      return;
    }

    if (!form.teamIds.length) {
      setError("Select at least one team for this player.");
      return;
    }

    const selectedTeamIds = form.teamIds.map(Number);
    const existingPlayer = players.find(
      (player) =>
        normalizeMobile(player.mobileNumber || "") === mobileNumber &&
        player.id !== editingId
    );

    const payload = {
      name: form.name.trim(),
      mobileNumber,
      role: form.role,
      battingStyle: form.battingStyle || null,
      bowlingStyle: form.bowlingStyle || null,
      teamIds: selectedTeamIds,
    };

    setSaving(true);

    try {
      if (editingId !== null) {
        await API.put(`/players/${editingId}`, payload);
        resetForm();
        await loadData();
        setNotice("Player details and team assignments updated.");
      } else if (existingPlayer) {
        const currentTeamIds = getPlayerTeams(existingPlayer).map(
          (team) => String(team.id)
        );
        const missingTeamIds = selectedTeamIds
          .map(String)
          .filter((id) => !currentTeamIds.includes(id));

        if (missingTeamIds.length) {
          for (const teamId of missingTeamIds) {
            await API.post(`/players/${existingPlayer.id}/teams`, {
              teamId: Number(teamId),
            });
          }
        } else {
          throw new Error(
            "This player already exists and is assigned to all selected teams."
          );
        }

        resetForm();
        await loadData();
        setNotice(
          `${existingPlayer.name} already exists. Their existing record was reused and the new team assignment was saved.`
        );
      } else {
        await API.post("/players", payload);
        resetForm();
        await loadData();
        setNotice("Player added successfully.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to save the player. Please check the backend."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (player) => {
    setEditingId(player.id);
    setForm({
      name: player.name || "",
      mobileNumber: player.mobileNumber || "",
      role: player.role || "Batsman",
      battingStyle: player.battingStyle || "",
      bowlingStyle: player.bowlingStyle || "",
      teamIds: getPlayerTeams(player).map((team) => String(team.id)),
    });

    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (player) => {
    const confirmed = window.confirm(
      `Delete ${player.name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await API.delete(`/players/${player.id}`);

      if (editingId === player.id) resetForm();

      await loadData();
      setNotice(`${player.name} deleted successfully.`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to delete the player. They may still be assigned to teams."
      );
    }
  };

  const filteredPlayers = players.filter((player) => {
    const query = search.trim().toLowerCase();
    const playerTeams = getPlayerTeams(player);

    const matchesSearch =
      (player.name || "").toLowerCase().includes(query) ||
      (player.role || "").toLowerCase().includes(query) ||
      (player.mobileNumber || "").toLowerCase().includes(query) ||
      playerTeams.some((team) =>
        (team.name || "").toLowerCase().includes(query)
      );

    return matchesSearch &&
      (roleFilter === "All" || player.role === roleFilter);
  });

  const getInitials = (name) =>
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <div className="cz-players">
      <section className="cz-players-hero">
        <div>
          <div className="cz-players-eyebrow">
            <span />
            PLAYER DATABASE
          </div>
          <h2>
            Players <span>.</span>
          </h2>
          <p>
            Manage player records by mobile number and assign players to
            multiple teams without separate player accounts.
          </p>
        </div>

        <div className="cz-players-total">
          <small>TOTAL PLAYERS</small>
          <strong>{String(players.length).padStart(2, "0")}</strong>
          <span>Player records in Criczone</span>
        </div>
      </section>

      {error && (
        <div className="cz-players-message error" role="alert">
          <span>!</span>
          <p>{error}</p>
          <button onClick={() => setError("")} type="button">×</button>
        </div>
      )}

      {notice && (
        <div className="cz-players-message success" role="status">
          <span>✓</span>
          <p>{notice}</p>
          <button onClick={() => setNotice("")} type="button">×</button>
        </div>
      )}

      <section className="cz-players-form-panel">
        <div className="cz-players-section-heading">
          <div>
            <small>{editingId ? "EDIT PLAYER" : "ORGANIZER TOOL"}</small>
            <h3>{editingId ? "Update player details" : "Add or assign a player"}</h3>
          </div>
          <span className="cz-players-step">{editingId ? "02" : "01"}</span>
        </div>

        <form className="cz-players-form" onSubmit={handleSubmit}>
          <label>
            <span>Player name <b>*</b></span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter full name"
              maxLength={100}
              required
            />
          </label>

          <label>
            <span>Mobile number <b>*</b></span>
            <input
              name="mobileNumber"
              type="tel"
              value={form.mobileNumber}
              onChange={handleChange}
              placeholder="Enter player's mobile number"
              maxLength={20}
              required
            />
          </label>

          <label>
            <span>Player role <b>*</b></span>
            <select name="role" value={form.role} onChange={handleChange} required>
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Batting style</span>
            <select name="battingStyle" value={form.battingStyle} onChange={handleChange}>
              <option value="">Not specified</option>
              <option value="Right-handed">Right-handed</option>
              <option value="Left-handed">Left-handed</option>
            </select>
          </label>

          <label>
            <span>Bowling style</span>
            <select name="bowlingStyle" value={form.bowlingStyle} onChange={handleChange}>
              <option value="">Not specified</option>
              <option value="Right-arm fast">Right-arm fast</option>
              <option value="Left-arm fast">Left-arm fast</option>
              <option value="Right-arm medium">Right-arm medium</option>
              <option value="Left-arm medium">Left-arm medium</option>
              <option value="Right-arm off-spin">Right-arm off-spin</option>
              <option value="Right-arm leg-spin">Right-arm leg-spin</option>
              <option value="Left-arm orthodox">Left-arm orthodox</option>
              <option value="Left-arm wrist-spin">Left-arm wrist-spin</option>
            </select>
          </label>

          <label className="cz-players-team-field">
            <span>Assign teams <b>*</b></span>
            <select
              multiple
              value={form.teamIds}
              onChange={handleTeamChange}
              size={Math.min(Math.max(teams.length, 2), 5)}
              required
              aria-label="Select one or more teams"
            >
              {teams.map((team) => (
                <option key={team.id} value={String(team.id)}>
                  {team.name} ({team.shortName})
                </option>
              ))}
            </select>
            <small>Use Ctrl (Windows) or Command (Mac) to select multiple teams.</small>
          </label>

          <div className="cz-players-form-actions">
            <button type="submit" disabled={saving || loading}>
              {saving ? "Saving..." : editingId ? "Save changes" : "+ Add / Assign Player"}
              {!saving && <span>↗</span>}
            </button>
            {editingId && (
              <button
                type="button"
                className="cz-players-cancel"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="cz-players-form-foot">
          <span />
          No player account is created. Mobile number identifies the existing player record.
        </div>
      </section>

      <section className="cz-players-directory">
        <div className="cz-players-section-heading">
          <div>
            <small>YOUR CRICKET UNIVERSE</small>
            <h3>Player directory <span>{filteredPlayers.length}</span></h3>
          </div>
          <button
            type="button"
            className="cz-players-refresh"
            onClick={loadData}
            disabled={loading}
            title="Refresh players"
            aria-label="Refresh players"
          >
            ↻
          </button>
        </div>

        <div className="cz-players-toolbar">
          <label className="cz-players-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search name, mobile, role or team..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            className="cz-players-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter players by role"
          >
            <option value="All">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="cz-players-empty">
            <div className="cz-players-loader" />
            <strong>Loading players...</strong>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="cz-players-empty">
            <div className="cz-players-empty-icon">♧</div>
            <strong>
              {search || roleFilter !== "All"
                ? "No matching players"
                : "Your player directory is empty"}
            </strong>
            <p>
              {search || roleFilter !== "All"
                ? "Change your search or role filter."
                : "Add your first player using the organizer form above."}
            </p>
          </div>
        ) : (
          <div className="cz-players-grid">
            {filteredPlayers.map((player, index) => {
              const playerTeams = getPlayerTeams(player);

              return (
                <article className="cz-player-card" key={player.id}>
                  <div className="cz-player-card-top">
                    <span className="cz-player-number">
                      PLAYER / {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="cz-player-role">{player.role || "Player"}</span>
                  </div>

                  <div className="cz-player-profile">
                    <div className="cz-player-avatar">{getInitials(player.name)}</div>
                    <div className="cz-player-profile-info">
                      <h4>{player.name}</h4>
                      <p>
                        {playerTeams.length
                          ? playerTeams.map((team) => team.name).filter(Boolean).join(", ")
                          : "Unassigned player"}
                      </p>
                    </div>
                  </div>

                  <div className="cz-player-details">
                    <div>
                      <span>MOBILE NUMBER</span>
                      <strong>{player.mobileNumber || "Not provided"}</strong>
                    </div>
                    <div>
                      <span>BATTING</span>
                      <strong>{player.battingStyle || "Not specified"}</strong>
                    </div>
                    <div>
                      <span>BOWLING</span>
                      <strong>{player.bowlingStyle || "Not specified"}</strong>
                    </div>
                  </div>

                  <div className="cz-player-card-actions">
                    <button type="button" onClick={() => handleEdit(player)}>
                      Edit player
                    </button>
                    <button
                      type="button"
                      className="cz-player-delete"
                      onClick={() => handleDelete(player)}
                      aria-label={`Delete ${player.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="cz-players-directory-foot">
          <span>CRICZONE / PLAYER DATABASE</span>
          <span>{filteredPlayers.length} PLAYERS SHOWN</span>
        </div>
      </section>
    </div>
  );
}

export default Players;
