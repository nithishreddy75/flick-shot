
import { useCallback, useEffect, useState } from "react";
import API from "../services/api";
import "../Teams.css";

const emptyTeam = {
  name: "",
  shortName: "",
  logoUrl: "",
  captainMobileNumber: "",
};

const emptyPlayer = {
  mobileNumber: "",
  name: "",
  role: "Batsman",
  battingStyle: "",
  bowlingStyle: "",
};

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [squad, setSquad] = useState([]);

  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);

  const [editingTeamId, setEditingTeamId] = useState(null);
  const [search, setSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");

  const [playerFound, setPlayerFound] = useState(null);
  const [lookupDone, setLookupDone] = useState(false);

  const [loading, setLoading] = useState(true);
  const [squadLoading, setSquadLoading] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const getErrorMessage = (err, fallback) =>
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    (typeof err?.response?.data === "string"
      ? err.response.data
      : null) ||
    err?.message ||
    fallback;

  const loadTeams = useCallback(async () => {
    setLoading(true);

    try {
      const response = await API.get("/teams");
      setTeams(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load teams."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSquad = useCallback(async (teamId) => {
    if (!teamId) {
      setSquad([]);
      return;
    }

    setSquadLoading(true);

    try {
      const response = await API.get(`/teams/${teamId}/players`);
      setSquad(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setSquad([]);
      setError(getErrorMessage(err, "Unable to load this squad."));
    } finally {
      setSquadLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (selectedTeam?.id) {
      loadSquad(selectedTeam.id);
    } else {
      setSquad([]);
    }
  }, [selectedTeam?.id, loadSquad]);

  const resetTeamForm = () => {
    setTeamForm(emptyTeam);
    setEditingTeamId(null);
  };

  const handleTeamInput = (event) => {
    const { name, value } = event.target;

    setTeamForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleTeamSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!teamForm.name.trim() || !teamForm.shortName.trim()) {
      setError("Team name and short name are required.");
      return;
    }

    setSavingTeam(true);

    const payload = {
      name: teamForm.name.trim(),
      shortName: teamForm.shortName.trim().toUpperCase(),
      logoUrl: teamForm.logoUrl.trim(),
      captainMobileNumber: teamForm.captainMobileNumber.trim(),
    };

    try {
      let savedTeam;

      if (editingTeamId) {
        const response = await API.put(
          `/teams/${editingTeamId}`,
          payload
        );
        savedTeam = response.data;
        setMessage("Team updated successfully.");
      } else {
        const response = await API.post("/teams", payload);
        savedTeam = response.data;
        setMessage("Team created successfully.");
      }

      await loadTeams();
      resetTeamForm();

      if (savedTeam?.id) {
        setSelectedTeam(savedTeam);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save the team."));
    } finally {
      setSavingTeam(false);
    }
  };

  const handleEditTeam = (team) => {
    setEditingTeamId(team.id);

    setTeamForm({
      name: team.name || "",
      shortName: team.shortName || "",
      logoUrl: team.logoUrl || "",
      captainMobileNumber: team.captainMobileNumber || "",
    });

    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteTeam = async (team) => {
    const confirmed = window.confirm(
      `Delete ${team.name}? Teams with players must have their squads cleared first.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await API.delete(`/teams/${team.id}`);

      if (selectedTeam?.id === team.id) {
        setSelectedTeam(null);
        setSquad([]);
      }

      if (editingTeamId === team.id) {
        resetTeamForm();
      }

      await loadTeams();
      setMessage("Team deleted successfully.");
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to delete the team. Remove its players first."
        )
      );
    }
  };

  const selectTeam = (team) => {
    setSelectedTeam(team);
    setError("");
    setMessage("");
    setPlayerFound(null);
    setLookupDone(false);
    setMobileSearch("");
    setPlayerForm(emptyPlayer);
  };

  const handleMobileSearchChange = (event) => {
    const value = event.target.value;
    setMobileSearch(value);
    setPlayerForm((previous) => ({
      ...previous,
      mobileNumber: value,
    }));
    setPlayerFound(null);
    setLookupDone(false);
  };

  const handleLookup = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setPlayerFound(null);
    setLookupDone(false);

    const mobile = mobileSearch.trim();

    if (!mobile) {
      setError("Enter the player's mobile number.");
      return;
    }

    try {
      const response = await API.get("/players/by-mobile", {
        params: { mobileNumber: mobile },
      });

      setPlayerFound(response.data);
      setPlayerForm({
        mobileNumber: response.data.mobileNumber || mobile,
        name: response.data.name || "",
        role: response.data.role || "Batsman",
        battingStyle: response.data.battingStyle || "",
        bowlingStyle: response.data.bowlingStyle || "",
      });
      setLookupDone(true);

      const alreadyAdded = squad.some(
        (player) => player.id === response.data.id
      );

      if (alreadyAdded) {
        setMessage("This player is already in the selected squad.");
      } else {
        setMessage("Existing player found. Add them to this squad.");
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setPlayerFound(null);
        setPlayerForm({
          ...emptyPlayer,
          mobileNumber: mobile,
        });
        setLookupDone(true);
        setMessage(
          "No player found. Enter the player's details to create a profile."
        );
      } else {
        setError(getErrorMessage(err, "Player lookup failed."));
      }
    }
  };

  const handlePlayerInput = (event) => {
    const { name, value } = event.target;

    setPlayerForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAddPlayer = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!selectedTeam) {
      setError("Select a team first.");
      return;
    }

    if (!lookupDone) {
      setError("Search for the player by mobile number first.");
      return;
    }

    if (playerFound) {
      const alreadyAdded = squad.some(
        (player) => player.id === playerFound.id
      );

      if (alreadyAdded) {
        setMessage("This player is already in this squad.");
        return;
      }
    } else if (!playerForm.name.trim()) {
      setError("Enter the player's name.");
      return;
    }

    setSavingPlayer(true);

    try {
      let player = playerFound;

      // Create a profile only if the mobile number was not found.
      if (!player) {
        const createResponse = await API.post("/players", {
          name: playerForm.name.trim(),
          mobileNumber: playerForm.mobileNumber.trim(),
          role: playerForm.role,
          battingStyle: playerForm.battingStyle,
          bowlingStyle: playerForm.bowlingStyle,
        });

        player = createResponse.data;
      }

      // Reuse the existing player profile across multiple teams.
      await API.post(`/players/${player.id}/teams`, {
        teamId: selectedTeam.id,
      });

      await loadSquad(selectedTeam.id);

      setMessage(`${player.name} added to ${selectedTeam.name}.`);
      setMobileSearch("");
      setPlayerForm(emptyPlayer);
      setPlayerFound(null);
      setLookupDone(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to add the player to this squad.")
      );
    } finally {
      setSavingPlayer(false);
    }
  };

  const handleRemovePlayer = async (player) => {
    if (!selectedTeam) return;

    const confirmed = window.confirm(
      `Remove ${player.name} from ${selectedTeam.name}? Their player profile will remain available.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await API.delete(
        `/players/${player.id}/teams/${selectedTeam.id}`
      );

      await loadSquad(selectedTeam.id);
      setMessage(`${player.name} removed from the squad.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to remove this player."));
    }
  };

  const filteredTeams = teams.filter((team) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      (team.name || "").toLowerCase().includes(query) ||
      (team.shortName || "").toLowerCase().includes(query)
    );
  });

  return (
    <main className="cz-teams-page">
      <header className="cz-teams-header">
        <div>
          <span className="cz-eyebrow">CLUB MANAGEMENT</span>
          <h1>Teams & Squads</h1>
          <p>
            Build your teams, manage player profiles and prepare your squads.
          </p>
        </div>

        <div className="cz-team-count">
          <span>Total Teams</span>
          <strong>{teams.length}</strong>
        </div>
      </header>

      {(error || message) && (
        <div
          className={`cz-team-alert ${error ? "is-error" : "is-success"}`}
          role="status"
        >
          <span>{error || message}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      <section className="cz-teams-layout">
        <div className="cz-team-form-card">
          <div className="cz-section-heading">
            <div>
              <span className="cz-eyebrow">
                {editingTeamId ? "EDIT TEAM" : "TEAM SETUP"}
              </span>
              <h2>{editingTeamId ? "Update Team" : "Create a Team"}</h2>
            </div>
            <span className="cz-heading-icon">🏏</span>
          </div>

          <form onSubmit={handleTeamSubmit} className="cz-team-form">
            <label>
              Team Name *
              <input
                name="name"
                value={teamForm.name}
                onChange={handleTeamInput}
                placeholder="e.g. Hyderabad Strikers"
                maxLength={100}
                required
              />
            </label>

            <label>
              Short Name *
              <input
                name="shortName"
                value={teamForm.shortName}
                onChange={handleTeamInput}
                placeholder="e.g. HYS"
                maxLength={10}
                required
              />
            </label>

            <label>
              Team Logo URL
              <input
                name="logoUrl"
                value={teamForm.logoUrl}
                onChange={handleTeamInput}
                placeholder="https://example.com/logo.png"
              />
            </label>

            <label>
              Captain Mobile Number
              <input
                name="captainMobileNumber"
                type="tel"
                value={teamForm.captainMobileNumber}
                onChange={handleTeamInput}
                placeholder="Captain's mobile number"
              />
            </label>

            <div className="cz-team-form-actions">
              <button
                type="submit"
                className="cz-primary-button"
                disabled={savingTeam}
              >
                {savingTeam
                  ? "Saving..."
                  : editingTeamId
                    ? "Save Changes"
                    : "Create Team"}
              </button>

              {editingTeamId && (
                <button
                  type="button"
                  className="cz-secondary-button"
                  onClick={resetTeamForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="cz-team-list-card">
          <div className="cz-section-heading">
            <div>
              <span className="cz-eyebrow">YOUR CLUBS</span>
              <h2>All Teams</h2>
            </div>
          </div>

          <input
            className="cz-team-search"
            type="search"
            placeholder="Search by team name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {loading ? (
            <div className="cz-team-empty">Loading teams...</div>
          ) : filteredTeams.length === 0 ? (
            <div className="cz-team-empty">
              {search
                ? "No teams match your search."
                : "No teams yet. Create your first team."}
            </div>
          ) : (
            <div className="cz-team-list">
              {filteredTeams.map((team) => (
                <article
                  className={`cz-team-item ${
                    selectedTeam?.id === team.id ? "is-selected" : ""
                  }`}
                  key={team.id}
                >
                  <button
                    type="button"
                    className="cz-team-select"
                    onClick={() => selectTeam(team)}
                  >
                    {team.logoUrl ? (
                      <img
                        className="cz-team-logo"
                        src={team.logoUrl}
                        alt={`${team.name} logo`}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="cz-team-logo-fallback">
                        {(team.shortName || team.name || "T")
                          .slice(0, 3)
                          .toUpperCase()}
                      </div>
                    )}

                    <span className="cz-team-item-details">
                      <strong>{team.name}</strong>
                      <small>
                        {team.shortName || "TEAM"} · Captain:{" "}
                        {team.captainMobileNumber || "Not assigned"}
                      </small>
                    </span>

                    <span className="cz-team-arrow">›</span>
                  </button>

                  <div className="cz-team-item-actions">
                    <button
                      type="button"
                      onClick={() => handleEditTeam(team)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="cz-danger-text"
                      onClick={() => handleDeleteTeam(team)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="cz-squad-panel">
        <div className="cz-section-heading">
          <div>
            <span className="cz-eyebrow">PLAYER MANAGEMENT</span>
            <h2>
              {selectedTeam
                ? `${selectedTeam.name} Squad`
                : "Team Squad"}
            </h2>
            <p>
              {selectedTeam
                ? "Find players by mobile number or create a new profile."
                : "Select a team above to manage its players."}
            </p>
          </div>

          <span className="cz-squad-count">
            {squad.length} {squad.length === 1 ? "Player" : "Players"}
          </span>
        </div>

        {selectedTeam && (
          <>
            <form
              className="cz-squad-add-form"
              onSubmit={handleLookup}
            >
              <label>
                Player Mobile Number
                <input
                  type="tel"
                  value={mobileSearch}
                  onChange={handleMobileSearchChange}
                  placeholder="Enter mobile number to search"
                  required
                />
              </label>

              <button type="submit" className="cz-primary-button">
                Find Player
              </button>
            </form>

            {lookupDone && (
              <form
                className="cz-squad-player-form"
                onSubmit={handleAddPlayer}
              >
                <h3>
                  {playerFound
                    ? "Existing Player Found"
                    : "Create New Player"}
                </h3>

                {playerFound && (
                  <p className="cz-squad-found-player">
                    This mobile number belongs to{" "}
                    <strong>{playerFound.name}</strong>. Their existing
                    profile will be reused.
                  </p>
                )}

                <div className="cz-player-fields">
                  <label>
                    Player Name *
                    <input
                      name="name"
                      value={playerForm.name}
                      onChange={handlePlayerInput}
                      placeholder="Player name"
                      required
                      disabled={Boolean(playerFound)}
                    />
                  </label>

                  <label>
                    Role *
                    <select
                      name="role"
                      value={playerForm.role}
                      onChange={handlePlayerInput}
                      disabled={Boolean(playerFound)}
                    >
                      <option value="Batsman">Batsman</option>
                      <option value="Bowler">Bowler</option>
                      <option value="All-rounder">All-rounder</option>
                      <option value="Wicket-keeper">Wicket-keeper</option>
                    </select>
                  </label>

                  <label>
                    Batting Style
                    <select
                      name="battingStyle"
                      value={playerForm.battingStyle}
                      onChange={handlePlayerInput}
                      disabled={Boolean(playerFound)}
                    >
                      <option value="">Select style</option>
                      <option value="Right-hand bat">Right-hand bat</option>
                      <option value="Left-hand bat">Left-hand bat</option>
                    </select>
                  </label>

                  <label>
                    Bowling Style
                    <input
                      name="bowlingStyle"
                      value={playerForm.bowlingStyle}
                      onChange={handlePlayerInput}
                      placeholder="e.g. Right-arm medium"
                      disabled={Boolean(playerFound)}
                    />
                  </label>
                </div>

                <div className="cz-team-form-actions">
                  <button
                    type="submit"
                    className="cz-primary-button"
                    disabled={savingPlayer}
                  >
                    {savingPlayer
                      ? "Adding..."
                      : "Add Player to Squad"}
                  </button>

                  <button
                    type="button"
                    className="cz-secondary-button"
                    onClick={() => {
                      setLookupDone(false);
                      setPlayerFound(null);
                      setPlayerForm(emptyPlayer);
                      setMobileSearch("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="cz-squad-list-heading">
              <h3>Squad Members</h3>
              <button
                type="button"
                className="cz-secondary-button"
                onClick={() => loadSquad(selectedTeam.id)}
                disabled={squadLoading}
              >
                {squadLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {squadLoading ? (
              <div className="cz-team-empty">Loading squad...</div>
            ) : squad.length === 0 ? (
              <div className="cz-squad-empty">
                <span>🏏</span>
                <strong>No players in this squad yet</strong>
                <p>Search by mobile number to add your first player.</p>
              </div>
            ) : (
              <div className="cz-squad-list">
                {squad.map((player) => (
                  <article
                    className="cz-squad-player"
                    key={player.id}
                  >
                    <div className="cz-squad-player-avatar">
                      {(player.name || "P")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="cz-squad-player-info">
                      <strong>{player.name}</strong>
                      <span>{player.role || "Player"}</span>
                      <small>
                        {player.mobileNumber || "No mobile number"}
                      </small>
                    </div>

                    <button
                      type="button"
                      className="cz-danger-button"
                      onClick={() => handleRemovePlayer(player)}
                    >
                      Remove
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
