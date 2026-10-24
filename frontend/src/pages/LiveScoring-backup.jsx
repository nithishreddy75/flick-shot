import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";

const EXTRAS = [
  { key: "WIDE", label: "WD", name: "Wide" },
  { key: "NO_BALL", label: "NB", name: "No Ball" },
  { key: "BYE", label: "B", name: "Bye" },
  { key: "LEG_BYE", label: "LB", name: "Leg Bye" },
];

const DISMISSALS = [
  "BOWLED",
  "CAUGHT",
  "LBW",
  "RUN_OUT",
  "STUMPED",
  "HIT_WICKET",
  "RETIRED_OUT",
];

const idOf = (item) => item?.id ?? item?.playerId ?? "";

const nameOf = (item) =>
  item?.name ?? item?.playerName ?? item?.fullName ?? "Unknown";

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const teamIdOfPlayer = (player) =>
  player?.teamId ??
  player?.team?.id ??
  player?.team?.teamId ??
  player?.team?.team_id ??
  "";

const matchTeam = (match, number) =>
  match?.[`team${number}`] ??
  match?.[`team${number === 1 ? "A" : "B"}`] ??
  null;

const matchTeamId = (match, number) => {
  const team = matchTeam(match, number);

  return (
    (typeof team === "object" && team ? idOf(team) : team) ??
    match?.[`team${number}Id`] ??
    match?.[`team${number}ID`] ??
    ""
  );
};

const matchTeamName = (match, number) => {
  const team = matchTeam(match, number);

  if (typeof team === "object" && team) {
    return team.name ?? team.teamName ?? `Team ${number}`;
  }

  return (
    match?.[`team${number}Name`] ||
    (typeof team === "string" ? team : "") ||
    `Team ${number}`
  );
};

const playerOf = (delivery, role) =>
  delivery?.[role] ??
  delivery?.[`${role}Player`] ??
  null;

const deliveryRuns = (delivery) =>
  Number(delivery?.runsScored ?? 0) +
  Number(delivery?.extraRuns ?? 0);

const isLegalBall = (delivery) =>
  !["WIDE", "NO_BALL"].includes(
    String(delivery?.extraType ?? "NONE").toUpperCase()
  );

function Field({ label, value, onChange, options, placeholder }) {
  return (
    <label className="cz-field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="cz-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function playerNameSafe(players, playerId) {
  const player = players.find(
    (item) => String(idOf(item)) === String(playerId)
  );

  return player ? nameOf(player) : "Unknown player";
}

export default function LiveScoring() {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matchId, setMatchId] = useState("");
  const [innings, setInnings] = useState("1");
  const [battingTeamId, setBattingTeamId] = useState("");
  const [deliveries, setDeliveries] = useState([]);

  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const [extraType, setExtraType] = useState("");
  const [extraAmount, setExtraAmount] = useState(1);
  const [wicketMode, setWicketMode] = useState(false);
  const [dismissalType, setDismissalType] = useState("BOWLED");
  const [dismissedPlayerId, setDismissedPlayerId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedMatch = matches.find(
    (match) => String(idOf(match)) === String(matchId)
  );

  const team1Id = matchTeamId(selectedMatch, 1);
  const team2Id = matchTeamId(selectedMatch, 2);

  const teamOptions = selectedMatch
    ? [
        {
          value: String(team1Id),
          label: matchTeamName(selectedMatch, 1),
        },
        {
          value: String(team2Id),
          label: matchTeamName(selectedMatch, 2),
        },
      ].filter(
        (team) =>
          team.value &&
          team.value !== "undefined" &&
          team.value !== "null"
      )
    : [];

  const bowlingTeamId =
    String(battingTeamId) === String(team1Id)
      ? team2Id
      : String(battingTeamId) === String(team2Id)
        ? team1Id
        : "";

  const battingPlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          Boolean(battingTeamId) &&
          String(teamIdOfPlayer(player)) === String(battingTeamId)
      ),
    [players, battingTeamId]
  );

  const bowlingPlayers = useMemo(
    () =>
      players.filter(
        (player) =>
          Boolean(bowlingTeamId) &&
          String(teamIdOfPlayer(player)) === String(bowlingTeamId)
      ),
    [players, bowlingTeamId]
  );

  const inningsDeliveries = useMemo(
    () =>
      deliveries.filter(
        (delivery) =>
          Number(delivery?.inningsNumber ?? 1) === Number(innings)
      ),
    [deliveries, innings]
  );

  const totalRuns = inningsDeliveries.reduce(
    (sum, delivery) => sum + deliveryRuns(delivery),
    0
  );

  const wickets = inningsDeliveries.filter(
    (delivery) => delivery.wicket
  ).length;

  const legalBalls = inningsDeliveries.filter(isLegalBall).length;
  const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

  const currentRate = legalBalls
    ? (totalRuns / (legalBalls / 6)).toFixed(2)
    : "0.00";

  const striker = players.find(
    (player) => String(idOf(player)) === String(strikerId)
  );

  const nonStriker = players.find(
    (player) => String(idOf(player)) === String(nonStrikerId)
  );

  const bowler = players.find(
    (player) => String(idOf(player)) === String(bowlerId)
  );

  const completedOvers = Math.floor(legalBalls / 6);

  const lastCompletedOverBowlerId = useMemo(() => {
    if (completedOvers < 1) return "";

    const previousOverNumber = completedOvers - 1;

    const previousOverDeliveries = inningsDeliveries.filter(
      (delivery) =>
        Number(delivery.overNumber) === previousOverNumber
    );

    for (let index = previousOverDeliveries.length - 1; index >= 0; index--) {
      const delivery = previousOverDeliveries[index];

      const previousBowler =
        idOf(playerOf(delivery, "bowler")) ||
        delivery?.bowlerId ||
        "";

      if (previousBowler !== "") {
        return String(previousBowler);
      }
    }

    return "";
  }, [inningsDeliveries, completedOvers]);

  const availableBowlers = useMemo(
    () =>
      bowlingPlayers.filter(
        (player) =>
          !lastCompletedOverBowlerId ||
          String(idOf(player)) !== String(lastCompletedOverBowlerId)
      ),
    [bowlingPlayers, lastCompletedOverBowlerId]
  );

  const batterStats = (playerId) => {
    const rows = inningsDeliveries.filter((delivery) => {
      const batterId =
        idOf(playerOf(delivery, "striker")) ||
        delivery?.strikerId ||
        "";

      return String(batterId) === String(playerId);
    });

    const batterRuns = rows.reduce(
      (sum, delivery) => sum + Number(delivery.runsScored ?? 0),
      0
    );

    const balls = rows.filter(
      (delivery) =>
        String(delivery.extraType ?? "NONE").toUpperCase() !== "WIDE"
    ).length;

    return {
      runs: batterRuns,
      balls,
      fours: rows.filter(
        (delivery) => Number(delivery.runsScored) === 4
      ).length,
      sixes: rows.filter(
        (delivery) => Number(delivery.runsScored) === 6
      ).length,
      sr: balls ? ((batterRuns / balls) * 100).toFixed(1) : "0.0",
    };
  };

  const bowlingStats = useMemo(() => {
    const rows = inningsDeliveries.filter((delivery) => {
      const deliveryBowlerId =
        idOf(playerOf(delivery, "bowler")) ||
        delivery?.bowlerId ||
        "";

      return String(deliveryBowlerId) === String(bowlerId);
    });

    const conceded = rows.reduce((sum, delivery) => {
      const type = String(delivery.extraType ?? "NONE").toUpperCase();

      const extras = ["BYE", "LEG_BYE"].includes(type)
        ? 0
        : Number(delivery.extraRuns ?? 0);

      return sum + Number(delivery.runsScored ?? 0) + extras;
    }, 0);

    const balls = rows.filter(isLegalBall).length;

    const wicketsTaken = rows.filter(
      (delivery) =>
        delivery.wicket &&
        !["RUN_OUT", "RETIRED_OUT"].includes(
          String(delivery.dismissalType ?? "").toUpperCase()
        )
    ).length;

    return {
      runs: conceded,
      balls,
      wickets: wicketsTaken,
      overs: `${Math.floor(balls / 6)}.${balls % 6}`,
      economy: balls
        ? (conceded / (balls / 6)).toFixed(2)
        : "0.00",
    };
  }, [inningsDeliveries, bowlerId]);

  
const loadData = useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const [matchResponse, playerResponse] = await Promise.all([
      API.get("/matches"),
      API.get("/players"),
    ]);

    const matchList = unwrapList(matchResponse.data);
    const playerList = unwrapList(playerResponse.data);

    setMatches(matchList);
    setPlayers(playerList);

    // Restore the match selected in Match Center / Playing XI.
    const savedMatchId = localStorage.getItem(
      "criczone-selected-match-id"
    );

    const savedMatchExists = matchList.some(
      (match) => String(idOf(match)) === String(savedMatchId)
    );

    setMatchId((current) => {
      if (
        current &&
        matchList.some(
          (match) => String(idOf(match)) === String(current)
        )
      ) {
        return current;
      }

      if (savedMatchExists) {
        return String(savedMatchId);
      }

      return matchList.length
        ? String(idOf(matchList[0]))
        : "";
    });
  } catch (err) {
    setError(
      err?.response?.data?.message ??
        "Could not load matches and players. Check the backend."
    );
  } finally {
    setLoading(false);
  }
}, []);


  const loadDeliveries = useCallback(async () => {
    if (!matchId) {
      setDeliveries([]);
      return;
    }

    try {
      const response = await API.get(`/live-scoring/${matchId}`);
      setDeliveries(unwrapList(response.data));
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "Could not load scoring history."
      );
    }
  }, [matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    if (!selectedMatch) {
      setBattingTeamId("");
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
      return;
    }

    const key = `criczone-selection-${matchId}-${innings}`;

    let saved = null;

    try {
      saved = JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      saved = null;
    }

    const defaultTeam =
      Number(innings) % 2 === 1 ? team1Id : team2Id;

    const restoredTeam =
      saved?.battingTeamId &&
      [String(team1Id), String(team2Id)].includes(
        String(saved.battingTeamId)
      )
        ? saved.battingTeamId
        : defaultTeam;

    setBattingTeamId(String(restoredTeam ?? ""));
    setStrikerId(saved?.strikerId || "");
    setNonStrikerId(saved?.nonStrikerId || "");
    setBowlerId(saved?.bowlerId || "");
    setExtraType("");
    setWicketMode(false);
  }, [matchId, innings, selectedMatch, team1Id, team2Id]);

  useEffect(() => {
    if (!matchId || !battingTeamId) return;

    const key = `criczone-selection-${matchId}-${innings}`;

    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          battingTeamId,
          strikerId,
          nonStrikerId,
          bowlerId,
        })
      );
    } catch {
      // Local storage is optional.
    }
  }, [
    matchId,
    innings,
    battingTeamId,
    strikerId,
    nonStrikerId,
    bowlerId,
  ]);

  useEffect(() => {
    if (
      strikerId &&
      !battingPlayers.some(
        (player) => String(idOf(player)) === String(strikerId)
      )
    ) {
      setStrikerId("");
    }

    if (
      nonStrikerId &&
      !battingPlayers.some(
        (player) => String(idOf(player)) === String(nonStrikerId)
      )
    ) {
      setNonStrikerId("");
    }
  }, [battingPlayers, strikerId, nonStrikerId]);

  useEffect(() => {
    if (
      bowlerId &&
      lastCompletedOverBowlerId &&
      String(bowlerId) === String(lastCompletedOverBowlerId)
    ) {
      setBowlerId("");
      setNotice(
        "Choose a different bowler. Consecutive overs are not allowed."
      );
    }
  }, [bowlerId, lastCompletedOverBowlerId]);

  const recordDelivery = async ({
    runsScored = 0,
    extraRuns = 0,
    type = "NONE",
    wicket = false,
    dismissal = null,
    dismissedId = null,
  }) => {
    if (!matchId) {
      setError("Select a match first.");
      return;
    }

    if (!battingTeamId || !bowlingTeamId) {
      setError("Select the batting team first.");
      return;
    }

    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError("Select the striker, non-striker and bowler first.");
      return;
    }

    if (String(strikerId) === String(nonStrikerId)) {
      setError("Striker and non-striker must be different players.");
      return;
    }

    if (
      !battingPlayers.some(
        (player) => String(idOf(player)) === String(strikerId)
      ) ||
      !battingPlayers.some(
        (player) => String(idOf(player)) === String(nonStrikerId)
      )
    ) {
      setError("Both batters must belong to the selected batting team.");
      return;
    }

    if (
      !bowlingPlayers.some(
        (player) => String(idOf(player)) === String(bowlerId)
      )
    ) {
      setError("The bowler must belong to the opposing team.");
      return;
    }

    if (
      lastCompletedOverBowlerId &&
      String(bowlerId) === String(lastCompletedOverBowlerId)
    ) {
      setError(
        "A bowler cannot bowl two consecutive overs. Select another bowler."
      );
      return;
    }

    if (wicket && !dismissedId) {
      setError("Select the dismissed batter.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const legalCount = inningsDeliveries.filter(isLegalBall).length;
    const overNumber = Math.floor(legalCount / 6);
    const ballNumber = (legalCount % 6) + 1;

    const payload = {
      inningsNumber: Number(innings),
      overNumber,
      ballNumber,
      strikerId: Number(strikerId),
      nonStrikerId: Number(nonStrikerId),
      bowlerId: Number(bowlerId),
      runsScored: Number(runsScored),
      extraRuns: Number(extraRuns),
      extraType: type,
      wicket,
      dismissalType: wicket ? dismissal : null,
      dismissedPlayerId: wicket ? Number(dismissedId) : null,
    };

    try {
      await API.post(
        `/live-scoring/${matchId}/deliveries`,
        payload
      );

      const legal = !["WIDE", "NO_BALL"].includes(type);
      const endsOver = legal && ballNumber === 6;

      let nextStriker = strikerId;
      let nextNonStriker = nonStrikerId;
      let completedRuns = Number(runsScored);

      if (type === "BYE" || type === "LEG_BYE") {
        completedRuns = Number(extraRuns);
      } else if (type === "WIDE") {
        completedRuns = Math.max(0, Number(extraRuns) - 1);
      }

      if (completedRuns % 2 === 1) {
        [nextStriker, nextNonStriker] = [
          nextNonStriker,
          nextStriker,
        ];
      }

      if (endsOver) {
        [nextStriker, nextNonStriker] = [
          nextNonStriker,
          nextStriker,
        ];
        setBowlerId("");
      }

      if (wicket) {
        if (String(dismissedId) === String(nextStriker)) {
          nextStriker = "";
        } else if (String(dismissedId) === String(nextNonStriker)) {
          nextNonStriker = "";
        }
      }

      setStrikerId(nextStriker);
      setNonStrikerId(nextNonStriker);
      setExtraType("");
      setExtraAmount(1);
      setWicketMode(false);
      setDismissedPlayerId("");

      await loadDeliveries();

      if (endsOver) {
        setNotice(
          "Over completed. Select a different bowler for the next over."
        );
      } else if (wicket) {
        setNotice("Wicket recorded. Select the incoming batter.");
      } else {
        setNotice("Delivery recorded successfully.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "Could not record delivery. Check the selected players."
      );
    } finally {
      setSaving(false);
    }
  };

  const undoLastDelivery = async () => {
    const last = [...inningsDeliveries].reverse()[0];

    if (!last?.id) {
      setError("There is no delivery to undo.");
      return;
    }

    if (!window.confirm("Undo the last delivery?")) return;

    setError("");
    setNotice("");

    try {
      await API.delete(`/live-scoring/deliveries/${last.id}`);

      const oldStriker = playerOf(last, "striker");
      const oldNonStriker = playerOf(last, "nonStriker");
      const oldBowler = playerOf(last, "bowler");

      const oldStrikerId = idOf(oldStriker) || last.strikerId;
      const oldNonStrikerId = idOf(oldNonStriker) || last.nonStrikerId;
      const oldBowlerId = idOf(oldBowler) || last.bowlerId;

      if (oldStrikerId) setStrikerId(String(oldStrikerId));
      if (oldNonStrikerId) setNonStrikerId(String(oldNonStrikerId));
      if (oldBowlerId) setBowlerId(String(oldBowlerId));

      await loadDeliveries();
      setNotice("Last delivery undone.");
    } catch (err) {
      setError(
        err?.response?.data?.message ??
          "Could not undo the last delivery."
      );
    }
  };

  const ballLabel = (delivery) => {
    if (delivery.wicket) return "W";

    const type = String(delivery.extraType ?? "NONE").toUpperCase();

    if (type === "WIDE") return `WD${delivery.extraRuns || ""}`;

    if (type === "NO_BALL") {
      return `NB${
        Number(delivery.runsScored || 0) +
        Number(delivery.extraRuns || 0)
      }`;
    }

    if (type === "BYE") return `B${delivery.extraRuns || ""}`;
    if (type === "LEG_BYE") return `LB${delivery.extraRuns || ""}`;

    return String(delivery.runsScored ?? 0);
  };

  // The scoring interface and CSS continue in Part 2.
    if (loading) {
    return (
      <div className="cz-page">
        <ScoringStyles />
        <div className="cz-loading">Loading Criczone Live Scoring...</div>
      </div>
    );
  }

  return (
    <div className="cz-page">
      <ScoringStyles />

      <header className="cz-header">
        <div className="cz-brand">
          <div className="cz-brand-icon">C</div>
          <div>
            <div className="cz-brand-name">
              CRIC<span>ZONE</span>
            </div>
            <div className="cz-brand-caption">
              THE GAME, IN REAL TIME
            </div>
          </div>
        </div>

        <div className="cz-header-right">
          <i className="cz-live-dot" /> LIVE SCORING
        </div>
      </header>

      <main className="cz-main">
        <div className="cz-heading">
          <div>
            <div className="cz-eyebrow">
              MATCH CENTER / SCORING DESK
            </div>
            <h1>
              Live <span>Scoring.</span>
            </h1>
            <p>Every run. Every wicket. Every moment.</p>
          </div>

          <div className="cz-live-badge">
            <i className="cz-live-dot" /> LIVE SESSION
          </div>
        </div>

        <section className="cz-toolbar">
          <Field
            label="SELECT MATCH"
            value={matchId}
            onChange={(value) => {
              setMatchId(value);
              setBattingTeamId("");
              setStrikerId("");
              setNonStrikerId("");
              setBowlerId("");
            }}
            options={matches.map((match) => ({
              value: String(idOf(match)),
              label: `${matchTeamName(match, 1)} vs ${matchTeamName(match, 2)}`,
            }))}
            placeholder="Select match"
          />

          <label className="cz-field cz-innings">
            <span>INNINGS</span>
            <select
              value={innings}
              onChange={(event) => setInnings(event.target.value)}
            >
              <option value="1">1st Innings</option>
              <option value="2">2nd Innings</option>
              <option value="3">3rd Innings</option>
              <option value="4">4th Innings</option>
            </select>
          </label>

          <Field
            label="BATTING TEAM"
            value={battingTeamId}
            onChange={(value) => {
              setBattingTeamId(value);
              setStrikerId("");
              setNonStrikerId("");
              setBowlerId("");
            }}
            options={teamOptions}
            placeholder="Select batting team"
          />

          <div className="cz-saved-note">✓ Auto-saved</div>
        </section>

        {error && (
          <div className="cz-alert cz-error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {notice && (
          <div className="cz-alert cz-success">
            ✓ {notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        <section className="cz-score-hero">
          <div className="cz-score-top">
            <div>
              <div className="cz-muted-label">CURRENT INNINGS</div>
              <h2>
                {selectedMatch
                  ? `${matchTeamName(selectedMatch, 1)} vs ${matchTeamName(selectedMatch, 2)}`
                  : "Select a match"}
              </h2>
              <div className="cz-batting-caption">
                Batting:{" "}
                {teamOptions.find(
                  (team) => team.value === String(battingTeamId)
                )?.label || "Select batting team"}
              </div>
            </div>

            <span className="cz-innings-pill">
              INNINGS {innings}
            </span>
          </div>

          <div className="cz-score-body">
            <div className="cz-total-score">
              <div className="cz-score-number">
                {totalRuns}<span>/{wickets}</span>
              </div>
              <div className="cz-score-caption">
                TOTAL SCORE · {overs} OVERS
              </div>
            </div>

            <div className="cz-score-divider" />

            <div className="cz-score-stats">
              <Metric label="OVERS" value={overs} />
              <Metric label="RUN RATE" value={currentRate} />
              <Metric label="WICKETS" value={`${wickets}/10`} />
            </div>
          </div>

          <div className="cz-score-footer">
            <span>{legalBalls % 6} LEGAL BALLS THIS OVER</span>
            <div className="cz-over-track">
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={index}
                  className={index < legalBalls % 6 ? "filled" : ""}
                >
                  {index < legalBalls % 6 ? "✓" : index + 1}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="cz-player-grid">
          <div className="cz-panel">
            <div className="cz-panel-heading">
              <div>
                <div className="cz-eyebrow">BATTING TEAM ONLY</div>
                <h3>Batters</h3>
              </div>
              <span className="cz-panel-icon">↗</span>
            </div>

            <Field
              label="STRIKER"
              value={strikerId}
              onChange={setStrikerId}
              options={battingPlayers.map((player) => ({
                value: String(idOf(player)),
                label: nameOf(player),
              }))}
              placeholder="Select striker"
            />

            <div className="cz-player-row">
              <div className="cz-avatar active">
                {striker ? nameOf(striker).charAt(0).toUpperCase() : "S"}
              </div>
              <div className="cz-player-info">
                <strong>{striker ? nameOf(striker) : "Striker"}</strong>
                <span>ON STRIKE</span>
              </div>
              <div className="cz-player-score">
                <strong>
                  {strikerId ? batterStats(strikerId).runs : "—"}*
                </strong>
                <span>
                  {strikerId ? batterStats(strikerId).balls : 0} balls
                </span>
              </div>
            </div>

            <div className="cz-mini-stats">
              <Metric
                label="4s"
                value={strikerId ? batterStats(strikerId).fours : "—"}
              />
              <Metric
                label="6s"
                value={strikerId ? batterStats(strikerId).sixes : "—"}
              />
              <Metric
                label="SR"
                value={strikerId ? batterStats(strikerId).sr : "—"}
              />
            </div>

            <div className="cz-separator" />

            <Field
              label="NON-STRIKER"
              value={nonStrikerId}
              onChange={setNonStrikerId}
              options={battingPlayers
                .filter(
                  (player) => String(idOf(player)) !== String(strikerId)
                )
                .map((player) => ({
                  value: String(idOf(player)),
                  label: nameOf(player),
                }))}
              placeholder="Select non-striker"
            />

            <div className="cz-player-row">
              <div className="cz-avatar">
                {nonStriker
                  ? nameOf(nonStriker).charAt(0).toUpperCase()
                  : "N"}
              </div>
              <div className="cz-player-info">
                <strong>
                  {nonStriker ? nameOf(nonStriker) : "Non-striker"}
                </strong>
                <span>NON-STRIKER</span>
              </div>
              <div className="cz-player-score">
                <strong>
                  {nonStrikerId ? batterStats(nonStrikerId).runs : "—"}
                </strong>
                <span>
                  {nonStrikerId ? batterStats(nonStrikerId).balls : 0} balls
                </span>
              </div>
            </div>

            <button
              className="cz-swap"
              disabled={!strikerId || !nonStrikerId}
              onClick={() => {
                setStrikerId(nonStrikerId);
                setNonStrikerId(strikerId);
              }}
            >
              ⇅ SWAP ENDS
            </button>

            <p className="cz-tip">
              Showing {battingPlayers.length} player(s) from the selected
              batting team.
            </p>
          </div>

          <div className="cz-panel">
            <div className="cz-panel-heading">
              <div>
                <div className="cz-eyebrow">OPPOSING TEAM ONLY</div>
                <h3>Bowler</h3>
              </div>
              <span className="cz-panel-icon">◉</span>
            </div>

            <Field
              label="BOWLING TEAM"
              value={String(bowlingTeamId || "")}
              onChange={() => {}}
              options={
                bowlingTeamId
                  ? [
                      {
                        value: String(bowlingTeamId),
                        label:
                          teamOptions.find(
                            (team) =>
                              team.value === String(bowlingTeamId)
                          )?.label || "Opposition",
                      },
                    ]
                  : []
              }
              placeholder="Select batting team first"
            />

            <Field
              label="SELECT BOWLER"
              value={bowlerId}
              onChange={setBowlerId}
              options={availableBowlers.map((player) => ({
                value: String(idOf(player)),
                label: nameOf(player),
              }))}
              placeholder={
                !battingTeamId
                  ? "Select batting team first"
                  : availableBowlers.length
                    ? "Select bowler"
                    : "No eligible bowlers"
              }
            />

            {lastCompletedOverBowlerId && (
              <div className="cz-rule-note">
                <span>✓</span>
                Previous over's bowler is excluded.
              </div>
            )}

            <div className="cz-bowler-identity">
              <div className="cz-bowler-avatar">♙</div>
              <div>
                <strong>
                  {bowler ? nameOf(bowler) : "Select a bowler"}
                </strong>
                <span>
                  {bowler ? "CURRENT BOWLER" : "READY TO BOWL"}
                </span>
              </div>
            </div>

            <div className="cz-bowler-stats">
              <Metric
                label="OVERS"
                value={bowlerId ? bowlingStats.overs : "—"}
              />
              <Metric
                label="RUNS"
                value={bowlerId ? bowlingStats.runs : "—"}
              />
              <Metric
                label="WICKETS"
                value={bowlerId ? bowlingStats.wickets : "—"}
              />
            </div>

            <div className="cz-economy">
              <span>ECONOMY RATE</span>
              <strong>
                {bowlerId ? bowlingStats.economy : "—"}
              </strong>
            </div>

            <p className="cz-tip">
              A bowler cannot bowl consecutive overs. Choose another eligible
              bowler after the over.
            </p>
          </div>
        </section>
                <section className="cz-panel cz-scoring-panel">
          <div className="cz-panel-heading">
            <div>
              <div className="cz-eyebrow">TAP TO RECORD</div>
              <h3>Scoring console</h3>
            </div>
            <span className="cz-instant-label">
              <i className="cz-live-dot" /> INSTANT SCORING
            </span>
          </div>

          <div className="cz-scoring-grid">
            <div>
              <div className="cz-section-label">RUNS OFF THE BAT</div>
              <div className="cz-run-grid">
                {[0, 1, 2, 3, 4, 6].map((run) => (
                  <button
                    key={run}
                    className={`cz-run-button ${
                      run === 4 || run === 6 ? "boundary" : ""
                    }`}
                    disabled={saving}
                    onClick={() => {
                      setExtraType("");
                      setWicketMode(false);
                      recordDelivery({
                        runsScored: run,
                        extraRuns: 0,
                        type: "NONE",
                      });
                    }}
                  >
                    <strong>{run}</strong>
                    <span>
                      {run === 0
                        ? "DOT BALL"
                        : run === 1
                          ? "SINGLE"
                          : run === 2
                            ? "TWO RUNS"
                            : run === 3
                              ? "THREE"
                              : run === 4
                                ? "FOUR"
                                : "SIX"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="cz-hint">Tap a run to record immediately.</p>
            </div>

            <div>
              <div className="cz-section-label">EXTRAS</div>
              <div className="cz-extra-grid">
                {EXTRAS.map((extra) => (
                  <button
                    key={extra.key}
                    disabled={saving}
                    className={`cz-extra-button ${
                      extraType === extra.key ? "selected" : ""
                    }`}
                    onClick={() => {
                      setExtraType(extra.key);
                      setExtraAmount(1);
                      setWicketMode(false);
                    }}
                  >
                    <strong>{extra.label}</strong>
                    <span>{extra.name}</span>
                  </button>
                ))}
              </div>

              {extraType && (
                <div className="cz-extra-config">
                  <div className="cz-config-heading">
                    {EXTRAS.find((item) => item.key === extraType)?.name}
                    <button onClick={() => setExtraType("")}>×</button>
                  </div>

                  <div className="cz-section-label">
                    {["WIDE", "NO_BALL"].includes(extraType)
                      ? "TOTAL EXTRAS (MINIMUM 1)"
                      : "EXTRA RUNS"}
                  </div>

                  <div className="cz-amount-grid">
                    {[1, 2, 3, 4, 5].map((amount) => (
                      <button
                        key={amount}
                        className={
                          extraAmount === amount ? "selected" : ""
                        }
                        onClick={() => setExtraAmount(amount)}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>

                  <button
                    className="cz-confirm"
                    disabled={saving}
                    onClick={() =>
                      recordDelivery({
                        runsScored: 0,
                        extraRuns: Number(extraAmount),
                        type: extraType,
                      })
                    }
                  >
                    {saving ? "RECORDING..." : "CONFIRM EXTRA →"}
                  </button>
                </div>
              )}

              <button
                className={`cz-wicket-button ${
                  wicketMode ? "selected" : ""
                }`}
                disabled={saving}
                onClick={() => {
                  setWicketMode((value) => !value);
                  setExtraType("");
                  setDismissedPlayerId(strikerId || "");
                }}
              >
                <span className="cz-wicket-symbol">✕</span>
                <span>
                  <strong>WICKET</strong>
                  <small>Record a dismissal</small>
                </span>
                <span className="cz-arrow">→</span>
              </button>
            </div>
          </div>

          {wicketMode && (
            <div className="cz-wicket-config">
              <div>
                <div className="cz-eyebrow">DISMISSAL DETAILS</div>
                <h3>Record wicket</h3>
              </div>

              <Field
                label="DISMISSAL TYPE"
                value={dismissalType}
                onChange={setDismissalType}
                options={DISMISSALS.map((type) => ({
                  value: type,
                  label: type.replaceAll("_", " "),
                }))}
                placeholder="Select dismissal"
              />

              <Field
                label="DISMISSED BATTER"
                value={dismissedPlayerId}
                onChange={setDismissedPlayerId}
                options={[
                  ...(strikerId
                    ? [
                        {
                          value: String(strikerId),
                          label: playerNameSafe(players, strikerId),
                        },
                      ]
                    : []),
                  ...(nonStrikerId
                    ? [
                        {
                          value: String(nonStrikerId),
                          label: playerNameSafe(players, nonStrikerId),
                        },
                      ]
                    : []),
                ]}
                placeholder="Select batter"
              />

              <button
                className="cz-confirm-wicket"
                disabled={saving || !dismissedPlayerId}
                onClick={() =>
                  recordDelivery({
                    wicket: true,
                    dismissal: dismissalType,
                    dismissedId: dismissedPlayerId,
                  })
                }
              >
                {saving ? "RECORDING..." : "CONFIRM WICKET →"}
              </button>
            </div>
          )}
        </section>

        <section className="cz-panel cz-history-panel">
          <div className="cz-panel-heading">
            <div>
              <div className="cz-eyebrow">BALL-BY-BALL</div>
              <h3>Over timeline</h3>
            </div>

            <button
              className="cz-undo"
              disabled={!inningsDeliveries.length || saving}
              onClick={undoLastDelivery}
            >
              ↶ Undo last ball
            </button>
          </div>

          <div className="cz-history-summary">
            <span>
              <i className="cz-live-dot" /> CURRENT INNINGS
            </span>
            <strong>
              {inningsDeliveries.length} deliveries recorded
            </strong>
          </div>

          {!inningsDeliveries.length ? (
            <div className="cz-empty">
              <div className="cz-empty-icon">◉</div>
              <strong>No deliveries yet</strong>
              <span>
                Select your players and tap a run to start scoring.
              </span>
            </div>
          ) : (
            <>
              <div className="cz-over-groups">
                {Object.entries(
                  inningsDeliveries.reduce((groups, delivery) => {
                    const over = Number(delivery.overNumber ?? 0);

                    if (!groups[over]) groups[over] = [];

                    groups[over].push(delivery);
                    return groups;
                  }, {})
                ).map(([over, rows]) => (
                  <div key={over} className="cz-over-group">
                    <div className="cz-over-label">
                      <span>OVER {Number(over) + 1}</span>
                      <strong>
                        {rows.reduce(
                          (sum, delivery) =>
                            sum + deliveryRuns(delivery),
                          0
                        )}{" "}
                        RUNS
                      </strong>
                    </div>

                    <div className="cz-ball-strip">
                      {rows.map((delivery, index) => (
                        <div
                          key={delivery.id ?? `${over}-${index}`}
                          className={[
                            "cz-ball-chip",
                            delivery.wicket ? "wicket" : "",
                            [4, 6].includes(
                              Number(delivery.runsScored)
                            )
                              ? "boundary"
                              : "",
                            delivery.extraType &&
                            delivery.extraType !== "NONE"
                              ? "extra"
                              : "",
                          ].join(" ")}
                          title={`${nameOf(
                            playerOf(delivery, "striker")
                          )}: ${ballLabel(delivery)}`}
                        >
                          {ballLabel(delivery)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="cz-table-wrap">
                <table className="cz-history-table">
                  <thead>
                    <tr>
                      <th>OVER.BALL</th>
                      <th>BATTER</th>
                      <th>BOWLER</th>
                      <th>RESULT</th>
                      <th>RUNS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...inningsDeliveries]
                      .reverse()
                      .map((delivery, index) => (
                        <tr key={delivery.id ?? index}>
                          <td>
                            {Number(delivery.overNumber ?? 0) + 1}.
                            {delivery.ballNumber ?? "—"}
                          </td>
                          <td>
                            {nameOf(playerOf(delivery, "striker"))}
                          </td>
                          <td>
                            {nameOf(playerOf(delivery, "bowler"))}
                          </td>
                          <td>
                            {delivery.wicket ? (
                              <span className="cz-result-wicket">
                                WICKET ·{" "}
                                {String(
                                  delivery.dismissalType ?? ""
                                ).replaceAll("_", " ")}
                              </span>
                            ) : (
                              <span className="cz-result-normal">
                                {String(
                                  delivery.extraType ?? "NONE"
                                ) === "NONE"
                                  ? "RUNS"
                                  : String(
                                      delivery.extraType
                                    ).replaceAll("_", " ")}
                              </span>
                            )}
                          </td>
                          <td>
                            <strong>{deliveryRuns(delivery)}</strong>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <footer className="cz-footer">
          <div className="cz-brand-name">
            CRIC<span>ZONE</span>
          </div>
          <span>BUILT FOR THE LOVE OF CRICKET.</span>
          <span className="cz-footer-status">
            <i className="cz-live-dot" /> SCORING DESK ACTIVE
          </span>
        </footer>
      </main>
    </div>
  );
}
function ScoringStyles() {
  return (
    <style>{`
      .cz-page {
        --cz-green: #b7ff43;
        width: calc(100% - 278px);
        min-width: 0;
        min-height: 100vh;
        margin: 0 0 0 278px;
        padding: 0 0 32px;
        box-sizing: border-box;
        overflow-x: clip;
        background: radial-gradient(
          ellipse at 50% -20%,
          #5b7f391f,
          transparent 45%
        ), #0b0f10;
        color: #f4f7f4;
        font-family: Inter, system-ui, sans-serif;
      }

      .cz-page * {
        box-sizing: border-box;
      }

      .cz-header {
        min-height: 70px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px clamp(15px, 3vw, 40px);
        border-bottom: 1px solid #202728;
        background: #0b0f10;
      }

      .cz-brand {
        display: flex;
        align-items: center;
        gap: 11px;
      }

      .cz-brand-icon {
        width: 39px;
        height: 39px;
        display: grid;
        place-items: center;
        background: var(--cz-green);
        color: #10150b;
        font-size: 25px;
        font-weight: 950;
        font-style: italic;
        border-radius: 10px;
      }

      .cz-brand-name {
        font-size: 17px;
        font-weight: 950;
        letter-spacing: 1.3px;
      }

      .cz-brand-name span,
      .cz-heading h1 span {
        color: var(--cz-green);
      }

      .cz-brand-caption {
        margin-top: 3px;
        color: #7e8986;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 1.5px;
      }

      .cz-header-right,
      .cz-live-badge,
      .cz-instant-label,
      .cz-footer-status {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cz-header-right {
        color: var(--cz-green);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .cz-live-dot {
        width: 7px;
        height: 7px;
        display: inline-block;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--cz-green);
        box-shadow: 0 0 12px #b7ff4360;
      }

      .cz-main {
        width: 100%;
        max-width: 1500px;
        margin: 0 auto;
        padding: 26px clamp(13px, 2.4vw, 34px);
      }

      .cz-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 23px;
      }

      .cz-eyebrow {
        color: var(--cz-green);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1.6px;
      }

      .cz-heading h1 {
        margin: 8px 0 5px;
        font-size: clamp(30px, 3.5vw, 44px);
        line-height: 1.1;
        letter-spacing: -1.5px;
        font-weight: 950;
      }

      .cz-heading p {
        margin: 0;
        color: #899492;
        font-size: 12px;
      }

      .cz-live-badge {
        padding: 9px 11px;
        border: 1px solid #34412a;
        background: #161d13;
        border-radius: 7px;
        color: var(--cz-green);
        font-size: 9px;
        font-weight: 900;
        white-space: nowrap;
      }

      .cz-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(105px, .65fr) minmax(0, 1.1fr) auto;
        align-items: end;
        gap: 12px;
        padding: 15px;
        background: #111617;
        border: 1px solid #252d2e;
        border-radius: 11px;
        margin-bottom: 17px;
      }

      .cz-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
        min-width: 0;
      }

      .cz-field > span {
        color: #87918f;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1.1px;
      }

      .cz-field select {
        width: 100%;
        min-width: 0;
        border: 1px solid #303a3a;
        border-radius: 7px;
        background: #0d1213;
        color: #f3f6f3;
        padding: 11px 9px;
        font: inherit;
        font-size: 11px;
        outline: none;
      }

      .cz-field select:focus {
        border-color: var(--cz-green);
      }

      .cz-saved-note {
        color: #9ba5a0;
        font-size: 9px;
        white-space: nowrap;
        padding-bottom: 11px;
      }

      .cz-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 8px;
        font-size: 12px;
        margin: 12px 0;
      }

      .cz-alert button {
        margin-left: auto;
        border: 0;
        background: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
      }

      .cz-error {
        color: #ffb5b5;
        background: #351a1a;
        border: 1px solid #633232;
      }

      .cz-success {
        color: #d4f6ac;
        background: #1a2816;
        border: 1px solid #364b27;
      }

      .cz-score-hero {
        overflow: hidden;
        position: relative;
        border: 1px solid #38442c;
        border-radius: 12px;
        background: linear-gradient(115deg, #1a2417, #121817 55%, #151a19);
        margin-bottom: 17px;
      }

      .cz-score-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 19px 22px 8px;
      }

      .cz-muted-label {
        color: #a3b19b;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 1.5px;
      }

      .cz-score-top h2 {
        margin: 7px 0;
        font-size: 15px;
        font-weight: 850;
        overflow-wrap: anywhere;
      }

      .cz-batting-caption {
        font-size: 10px;
        color: #9ba990;
      }

      .cz-innings-pill {
        padding: 7px 9px;
        background: #293521;
        border: 1px solid #43552e;
        border-radius: 6px;
        color: var(--cz-green);
        font-size: 9px;
        font-weight: 900;
        white-space: nowrap;
      }

      .cz-score-body {
        display: flex;
        align-items: center;
        gap: 26px;
        padding: 12px 22px 20px;
      }

      .cz-total-score {
        min-width: 150px;
      }

      .cz-score-number {
        font-size: clamp(48px, 5vw, 70px);
        line-height: 1;
        font-weight: 950;
        letter-spacing: -3px;
        font-variant-numeric: tabular-nums;
      }

      .cz-score-number span {
        color: var(--cz-green);
        font-size: .64em;
      }

      .cz-score-caption {
        margin-top: 9px;
        color: #8b9891;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .cz-score-divider {
        align-self: stretch;
        width: 1px;
        background: #374332;
      }

      .cz-score-stats {
        display: flex;
        gap: clamp(15px, 3vw, 40px);
      }

      .cz-metric {
        display: flex;
        flex-direction: column;
        gap: 7px;
        min-width: 0;
      }

      .cz-metric > span {
        color: #84908b;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .cz-metric > strong {
        color: #f5f7f3;
        font-size: 21px;
        font-weight: 850;
        font-variant-numeric: tabular-nums;
      }

      .cz-score-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 11px 22px;
        background: #070b0955;
        border-top: 1px solid #303c2c;
      }

      .cz-score-footer > span {
        color: #a3aea2;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      .cz-over-track {
        display: flex;
        gap: 5px;
      }

      .cz-over-track span {
        width: 21px;
        height: 21px;
        display: grid;
        place-items: center;
        border: 1px solid #39413a;
        border-radius: 5px;
        color: #87928b;
        font-size: 8px;
      }

      .cz-over-track span.filled {
        background: var(--cz-green);
        border-color: var(--cz-green);
        color: #11170a;
      }

      .cz-player-grid,
      .cz-scoring-grid {
        display: grid;
        grid-template-columns: 1.1fr .9fr;
        gap: 15px;
        margin-bottom: 17px;
      }

      .cz-panel {
        min-width: 0;
        background: linear-gradient(145deg, #141a1b, #101516);
        border: 1px solid #283131;
        border-radius: 11px;
        padding: 19px;
      }

      .cz-panel-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 17px;
      }

      .cz-panel-heading h3,
      .cz-wicket-config h3 {
        margin: 5px 0 0;
        font-size: 18px;
      }

      .cz-panel-icon,
      .cz-bowler-avatar {
        display: grid;
        place-items: center;
        background: #202a1a;
        color: var(--cz-green);
        border-radius: 9px;
      }

      .cz-panel-icon {
        width: 32px;
        height: 32px;
      }

      .cz-player-row,
      .cz-bowler-identity {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 0 8px;
      }

      .cz-avatar {
        width: 37px;
        height: 37px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        border-radius: 9px;
        background: #27302e;
        border: 1px solid #3a4541;
        color: #c5d0c9;
        font-weight: 900;
      }

      .cz-avatar.active {
        background: #29371d;
        border-color: #526b35;
        color: var(--cz-green);
      }

      .cz-player-info {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
      }

      .cz-player-info strong {
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .cz-player-info > span,
      .cz-bowler-identity > div:last-child span {
        color: #87938e;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: .8px;
      }

      .cz-player-score {
        margin-left: auto;
        text-align: right;
        flex-shrink: 0;
      }

      .cz-player-score strong {
        display: block;
        font-size: 19px;
      }

      .cz-player-score > span {
        color: #8d9892;
        font-size: 9px;
      }

      .cz-mini-stats {
        display: flex;
        gap: 24px;
        padding: 11px 0 15px 47px;
      }

      .cz-mini-stats .cz-metric {
        gap: 4px;
      }

      .cz-mini-stats .cz-metric > strong {
        font-size: 13px;
      }

      .cz-separator {
        height: 1px;
        background: #293131;
        margin: 0 0 15px;
      }

      .cz-swap,
      .cz-confirm,
      .cz-confirm-wicket {
        width: 100%;
        padding: 11px;
        margin-top: 12px;
        border: 1px solid #526b35;
        border-radius: 7px;
        background: #202a19;
        color: var(--cz-green);
        cursor: pointer;
        font-weight: 900;
      }

      .cz-swap:disabled,
      button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .cz-tip,
      .cz-hint {
        color: #89948d;
        font-size: 10px;
        line-height: 1.6;
      }

      .cz-rule-note {
        margin-top: 12px;
        padding: 10px;
        border: 1px solid #35442b;
        background: #161e14;
        border-radius: 7px;
        color: #d1efb0;
        font-size: 10px;
      }

      .cz-bowler-identity {
        margin: 19px 0;
      }

      .cz-bowler-avatar {
        width: 44px;
        height: 44px;
        font-size: 23px;
      }

      .cz-bowler-identity > div:last-child {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .cz-bowler-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 9px;
        padding: 16px 0;
        border-top: 1px solid #2b3333;
        border-bottom: 1px solid #2b3333;
      }

      .cz-bowler-stats .cz-metric > strong {
        font-size: 19px;
      }

      .cz-economy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 15px;
      }

      .cz-economy span,
      .cz-section-label {
        color: #8b9791;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 1.1px;
      }

      .cz-economy strong {
        font-size: 21px;
        color: var(--cz-green);
      }

      .cz-scoring-panel,
      .cz-history-panel {
        margin-bottom: 17px;
      }

      .cz-instant-label {
        color: var(--cz-green);
        font-size: 8px;
        font-weight: 900;
      }

      .cz-scoring-grid {
        margin-bottom: 0;
      }

      .cz-run-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .cz-run-button {
        display: flex;
        min-width: 0;
        min-height: 79px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: #1a2021;
        border: 1px solid #303a3a;
        border-radius: 9px;
        color: #f4f7f3;
        cursor: pointer;
      }

      .cz-run-button strong {
        font-size: 26px;
      }

      .cz-run-button > span {
        color: #89948f;
        font-size: 7px;
        font-weight: 900;
      }

      .cz-run-button.boundary {
        background: #27351e;
        border-color: #455a31;
      }

      .cz-run-button.boundary strong {
        color: var(--cz-green);
      }

      .cz-extra-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 5px;
      }

      .cz-extra-button {
        display: flex;
        min-width: 0;
        min-height: 59px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 1px solid #303939;
        background: #1a2021;
        color: #fff;
        border-radius: 7px;
        cursor: pointer;
      }

      .cz-extra-button strong {
        font-size: 15px;
      }

      .cz-extra-button span {
        font-size: 7px;
        color: #8c9791;
      }

      .cz-extra-button.selected {
        border-color: var(--cz-green);
        background: #202a19;
      }

      .cz-extra-config,
      .cz-wicket-config {
        padding: 12px;
        margin-top: 11px;
        border: 1px solid #35442b;
        border-radius: 8px;
        background: #161e14;
      }

      .cz-config-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        font-size: 12px;
        font-weight: 900;
      }

      .cz-config-heading button {
        background: none;
        border: 0;
        color: #c4d0c4;
        font-size: 20px;
        cursor: pointer;
      }

      .cz-amount-grid {
        display: flex;
        gap: 6px;
        margin: 9px 0 12px;
      }

      .cz-amount-grid button {
        flex: 1;
        min-width: 0;
        padding: 9px 0;
        background: #202722;
        border: 1px solid #394338;
        border-radius: 5px;
        color: #fff;
        cursor: pointer;
      }

      .cz-amount-grid button.selected {
        background: var(--cz-green);
        border-color: var(--cz-green);
        color: #10150b;
      }

      .cz-wicket-button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 14px;
        padding: 13px;
        background: #2b1919;
        border: 1px solid #633232;
        border-radius: 8px;
        color: #ffb5b5;
        text-align: left;
        cursor: pointer;
      }

      .cz-wicket-button.selected {
        background: #421c1c;
        border-color: #ff7777;
      }

      .cz-wicket-symbol {
        font-size: 23px;
      }

      .cz-wicket-button > span:nth-child(2) {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .cz-wicket-button small {
        color: #cba4a4;
      }

      .cz-arrow {
        margin-left: auto;
      }

      .cz-wicket-config {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .cz-wicket-config > div:first-child {
        grid-column: 1 / -1;
      }

      .cz-confirm-wicket {
        align-self: end;
        background: #421c1c;
        border-color: #a94a4a;
        color: #ffb5b5;
      }

      .cz-undo {
        padding: 9px 12px;
        background: #202722;
        border: 1px solid #394338;
        border-radius: 7px;
        color: #e2e9e1;
        cursor: pointer;
      }

      .cz-history-summary {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 0;
        border-top: 1px solid #293131;
        border-bottom: 1px solid #293131;
        color: #89948d;
        font-size: 10px;
      }

      .cz-history-summary > span {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .cz-history-summary strong {
        color: #dfe6df;
      }

      .cz-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 9px;
        padding: 38px 12px;
        text-align: center;
        color: #89948d;
        font-size: 11px;
      }

      .cz-empty strong {
        color: #e8eee8;
        font-size: 14px;
      }

      .cz-empty-icon {
        font-size: 27px;
        color: var(--cz-green);
      }

      .cz-over-group {
        padding: 15px 0;
        border-bottom: 1px solid #293131;
      }

      .cz-over-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 11px;
        font-size: 10px;
        color: #9ca89f;
      }

      .cz-over-label strong {
        color: var(--cz-green);
      }

      .cz-ball-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .cz-ball-chip {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        background: #202827;
        border: 1px solid #39413d;
        border-radius: 50%;
        color: #e8eee8;
        font-size: 10px;
        font-weight: 900;
      }

      .cz-ball-chip.boundary {
        background: #29371d;
        border-color: #526b35;
        color: var(--cz-green);
      }

      .cz-ball-chip.wicket {
        background: #431e1e;
        border-color: #a94a4a;
        color: #ffb5b5;
      }

      .cz-ball-chip.extra {
        border-style: dashed;
      }

      .cz-table-wrap {
        width: 100%;
        overflow-x: auto;
        margin-top: 18px;
      }

      .cz-history-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 11px;
      }

      .cz-history-table th {
        padding: 12px 10px;
        color: #87938e;
        font-size: 9px;
        letter-spacing: .7px;
        border-bottom: 1px solid #303939;
      }

      .cz-history-table td {
        padding: 13px 10px;
        border-bottom: 1px solid #242d2d;
        color: #dce4dd;
      }

      .cz-result-wicket {
        color: #ff9999;
        font-size: 9px;
        font-weight: 900;
      }

      .cz-result-normal {
        color: #b7ff43;
        font-size: 9px;
        font-weight: 900;
      }

      .cz-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        padding: 20px 0 0;
        color: #78837d;
        font-size: 9px;
        letter-spacing: .8px;
      }

      .cz-loading {
        padding: 60px 20px;
        text-align: center;
        color: var(--cz-green);
      }

      @media (max-width: 1000px) {
        .cz-page {
          width: 100%;
          margin-left: 0;
        }

        .cz-toolbar {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .cz-player-grid,
        .cz-scoring-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 600px) {
        .cz-main {
          padding: 18px 12px;
        }

        .cz-heading {
          align-items: flex-start;
        }

        .cz-live-badge {
          display: none;
        }

        .cz-toolbar {
          grid-template-columns: 1fr;
        }

        .cz-score-body {
          flex-wrap: wrap;
          gap: 18px;
        }

        .cz-score-divider {
          display: none;
        }

        .cz-score-stats {
          width: 100%;
          justify-content: space-between;
        }

        .cz-panel {
          padding: 14px;
        }

        .cz-wicket-config {
          grid-template-columns: 1fr;
        }

        .cz-wicket-config > div:first-child {
          grid-column: auto;
        }

        .cz-footer {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `}</style>
  );
}