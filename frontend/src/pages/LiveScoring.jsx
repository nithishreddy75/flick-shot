
import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";
import "./LiveScoring.css";

const EXTRAS = ["NONE", "WIDE", "NO_BALL", "BYE", "LEG_BYE"];
const DISMISSALS = [
  "BOWLED",
  "CAUGHT",
  "LBW",
  "RUN_OUT",
  "STUMPED",
  "HIT_WICKET",
  "RETIRED_OUT",
];

const idOf = (value) =>
  value == null
    ? ""
    : String(typeof value === "object" ? value.id ?? "" : value);

const playerName = (player) =>
  player?.name || player?.fullName || `Player ${player?.id ?? ""}`;

const totalRuns = (delivery) =>
  Number(delivery?.runsScored || 0) +
  Number(delivery?.extraRuns || 0);

const extraTypeOf = (delivery) =>
  String(delivery?.extraType || "NONE").toUpperCase();

const isLegalBall = (delivery) =>
  !["WIDE", "NO_BALL"].includes(extraTypeOf(delivery));

function getTeamId(match, side) {
  return idOf(
    match?.[side]?.id ??
      match?.[`${side}Id`] ??
      match?.[side === "teamOne" ? "team1Id" : "team2Id"]
  );
}

function getTeamName(match, side) {
  return (
    match?.[`${side}Name`] ||
    match?.[side]?.name ||
    match?.[side === "teamOne" ? "teamOneShortName" : "teamTwoShortName"] ||
    "Team"
  );
}

function getInningsStats(deliveries, inningsNumber, oversLimit) {
  const inningsDeliveries = deliveries.filter(
    (delivery) => Number(delivery.inningsNumber) === inningsNumber
  );

  const runs = inningsDeliveries.reduce(
    (sum, delivery) => sum + totalRuns(delivery),
    0
  );

  const wickets = inningsDeliveries.filter(
    (delivery) => delivery.wicket === true
  ).length;

  const legalBalls = inningsDeliveries.filter(isLegalBall).length;

  const firstInningsRuns = deliveries
    .filter((delivery) => Number(delivery.inningsNumber) === 1)
    .reduce((sum, delivery) => sum + totalRuns(delivery), 0);

  const targetReached = inningsNumber === 2 && runs > firstInningsRuns;
  const oversFinished = legalBalls >= Number(oversLimit || 20) * 6;
  const allOut = wickets >= 10;

  return {
    runs,
    wickets,
    legalBalls,
    overs: `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`,
    target: firstInningsRuns + 1,
    targetReached,
    oversFinished,
    allOut,
    finished: targetReached || oversFinished || allOut,
    deliveries: inningsDeliveries,
  };
}

function getMatchResult(first, second, firstTeam, secondTeam) {
  if (second.runs > first.runs) {
    const remaining = Math.max(0, 10 - second.wickets);
    return `${secondTeam} won by ${remaining} wicket${
      remaining === 1 ? "" : "s"
    }`;
  }

  if (first.runs > second.runs) {
    const margin = first.runs - second.runs;
    return `${firstTeam} won by ${margin} run${margin === 1 ? "" : "s"}`;
  }

  return "Match tied";
}

export default function LiveScoring() {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matchId, setMatchId] = useState("");
  const [selection, setSelection] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [innings, setInnings] = useState(1);

  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const [previousOverBowlerId, setPreviousOverBowlerId] = useState("");

  const [extraType, setExtraType] = useState("WIDE");
  const [extraRuns, setExtraRuns] = useState(1);
  const [dismissalType, setDismissalType] = useState("BOWLED");
  const [dismissedPlayerId, setDismissedPlayerId] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedMatch = useMemo(
    () => matches.find((match) => idOf(match.id) === idOf(matchId)) || null,
    [matches, matchId]
  );

  const oversLimit = Number(
    selectedMatch?.totalOvers ??
      selectedMatch?.overs ??
      selectedMatch?.total_overs ??
      20
  );

  const teamOneId = getTeamId(selectedMatch, "teamOne");
  const teamTwoId = getTeamId(selectedMatch, "teamTwo");

  const tossWinnerId = idOf(
    selection?.tossWinnerTeamId ??
      selectedMatch?.tossWinnerTeamId ??
      selectedMatch?.tossWinner?.id ??
      selectedMatch?.tossWinner
  );

  const tossDecision = String(
    selection?.tossDecision ?? selectedMatch?.tossDecision ?? ""
  ).toUpperCase();

  const firstBattingTeamId =
    tossDecision === "BAT"
      ? tossWinnerId
      : tossWinnerId === teamOneId
        ? teamTwoId
        : teamOneId;

  const secondBattingTeamId =
    firstBattingTeamId === teamOneId ? teamTwoId : teamOneId;

  const battingTeamId =
    innings === 1 ? firstBattingTeamId : secondBattingTeamId;

  const bowlingTeamId =
    battingTeamId === teamOneId ? teamTwoId : teamOneId;

  const battingTeamName =
    battingTeamId === teamOneId
      ? getTeamName(selectedMatch, "teamOne")
      : getTeamName(selectedMatch, "teamTwo");

  const bowlingTeamName =
    bowlingTeamId === teamOneId
      ? getTeamName(selectedMatch, "teamOne")
      : getTeamName(selectedMatch, "teamTwo");

  const firstBattingTeamName =
    firstBattingTeamId === teamOneId
      ? getTeamName(selectedMatch, "teamOne")
      : getTeamName(selectedMatch, "teamTwo");

  const secondBattingTeamName =
    secondBattingTeamId === teamOneId
      ? getTeamName(selectedMatch, "teamOne")
      : getTeamName(selectedMatch, "teamTwo");

  const battingXI = useMemo(() => {
    const ids =
      battingTeamId === teamOneId
        ? selection?.teamOnePlayerIds
        : selection?.teamTwoPlayerIds;

    const allowedIds = Array.isArray(ids) ? ids.map(idOf) : [];

    return players.filter((player) => allowedIds.includes(idOf(player.id)));
  }, [players, selection, battingTeamId, teamOneId]);

  const bowlingXI = useMemo(() => {
    const ids =
      bowlingTeamId === teamOneId
        ? selection?.teamOnePlayerIds
        : selection?.teamTwoPlayerIds;

    const allowedIds = Array.isArray(ids) ? ids.map(idOf) : [];

    return players.filter((player) => allowedIds.includes(idOf(player.id)));
  }, [players, selection, bowlingTeamId, teamOneId]);

  const firstStats = useMemo(
    () => getInningsStats(deliveries, 1, oversLimit),
    [deliveries, oversLimit]
  );

  const secondStats = useMemo(
    () => getInningsStats(deliveries, 2, oversLimit),
    [deliveries, oversLimit]
  );

  const stats = innings === 1 ? firstStats : secondStats;

  const matchCompleted =
    String(selectedMatch?.status || "").toUpperCase() === "COMPLETED" ||
    (deliveries.some((d) => Number(d.inningsNumber) === 2) &&
      secondStats.finished);

  const matchResult =
    selectedMatch?.result ||
    (firstStats.finished && secondStats.finished
      ? getMatchResult(
          firstStats,
          secondStats,
          firstBattingTeamName,
          secondBattingTeamName
        )
      : "");

  const currentStriker = battingXI.find(
    (player) => idOf(player.id) === strikerId
  );

  const currentNonStriker = battingXI.find(
    (player) => idOf(player.id) === nonStrikerId
  );

  const currentBowler = bowlingXI.find(
    (player) => idOf(player.id) === bowlerId
  );

  const playerOptions = (list) =>
    list.map((player) => (
      <option key={player.id} value={player.id}>
        {playerName(player)}
      </option>
    ));

  const setupStorageKey = (id, inning) =>
    `flick-shot-scoring-setup-${id}-${inning}`;

  const loadBaseData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [matchesResponse, playersResponse] = await Promise.all([
        API.get("/matches"),
        API.get("/players"),
      ]);

      setMatches(
        Array.isArray(matchesResponse.data)
          ? matchesResponse.data
          : matchesResponse.data?.content || []
      );

      setPlayers(
        Array.isArray(playersResponse.data)
          ? playersResponse.data
          : playersResponse.data?.content || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to load matches and players."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh score and match status only.
  // Important: this function deliberately does NOT reset the player dropdowns.
  const refreshScore = useCallback(async (id, silent = false) => {
    if (!id) return;

    try {
      if (!silent) setLoading(true);

      const [matchListResponse, selectionResponse, deliveryResponse] =
        await Promise.all([
          API.get("/matches"),
          API.get(`/playing-xi/${id}`),
          API.get(`/live-scoring/${id}`),
        ]);

      const matchList = Array.isArray(matchListResponse.data)
        ? matchListResponse.data
        : matchListResponse.data?.content || [];

      const list = Array.isArray(deliveryResponse.data)
        ? deliveryResponse.data
        : deliveryResponse.data?.deliveries || [];

      setMatches(matchList);
      setSelection(selectionResponse.data || null);
      setDeliveries(list);

      const currentMatch = matchList.find(
        (match) => idOf(match.id) === idOf(id)
      );

      const limit = Number(
        currentMatch?.totalOvers ??
          currentMatch?.overs ??
          currentMatch?.total_overs ??
          20
      );

      const first = getInningsStats(list, 1, limit);
      const secondStarted = list.some(
        (delivery) => Number(delivery.inningsNumber) === 2
      );

      setInnings((previous) => {
        if (previous === 2 || first.finished || secondStarted) return 2;
        return 1;
      });

      if (!silent) {
        setNotice("Match score refreshed.");
        setError("");
      }
    } catch (err) {
      if (!silent) {
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to refresh match data."
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // Load match data and keep the score refreshed in the background.
  useEffect(() => {
    if (!matchId) {
      setSelection(null);
      setDeliveries([]);
      setInnings(1);
      setStrikerId("");
      setNonStrikerId("");
      setBowlerId("");
      setPreviousOverBowlerId("");
      return;
    }

    let active = true;

    const loadMatch = async () => {
      try {
        const [selectionResponse, deliveryResponse] = await Promise.all([
          API.get(`/playing-xi/${matchId}`),
          API.get(`/live-scoring/${matchId}`),
        ]);

        if (!active) return;

        setSelection(selectionResponse.data || null);

        const list = Array.isArray(deliveryResponse.data)
          ? deliveryResponse.data
          : deliveryResponse.data?.deliveries || [];

        setDeliveries(list);

        const limit = Number(
          selectedMatch?.totalOvers ??
            selectedMatch?.overs ??
            selectedMatch?.total_overs ??
            20
        );

        const first = getInningsStats(list, 1, limit);
        const secondStarted = list.some(
          (delivery) => Number(delivery.inningsNumber) === 2
        );

        setInnings(first.finished || secondStarted ? 2 : 1);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load the selected match."
          );
        }
      }
    };

    loadMatch();

    const timer = setInterval(() => {
      if (active) refreshScore(matchId, true);
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [matchId, refreshScore]); // Intentionally independent of player selections.

  // Restore players for the exact match and innings.
  // Backend is preferred; local storage is a fallback.
  useEffect(() => {
    if (!matchId) return;

    let active = true;
    const key = setupStorageKey(matchId, innings);

    const applySavedSetup = (data) => {
      if (!active || !data) return false;

      const savedStriker = idOf(data.strikerId);
      const savedNonStriker = idOf(data.nonStrikerId);
      const savedBowler = idOf(data.bowlerId);

      if (!savedStriker || !savedNonStriker) return false;

      setStrikerId(savedStriker);
      setNonStrikerId(savedNonStriker);

      // A bowler is allowed to be blank after an over ends.
      setBowlerId(savedBowler);

      return true;
    };

    const restoreLocal = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        return applySavedSetup(saved);
      } catch {
        return false;
      }
    };

    const loadSavedSetup = async () => {
      try {
        const response = await API.get(
          `/playing-xi/${matchId}/scoring-setup/${innings}`
        );

        if (!active) return;

        const data = response.data || {};

        if (applySavedSetup(data)) {
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                strikerId: idOf(data.strikerId),
                nonStrikerId: idOf(data.nonStrikerId),
                bowlerId: idOf(data.bowlerId),
              })
            );
          } catch {
            // Continue even when browser storage is unavailable.
          }
        } else {
          restoreLocal();
        }
      } catch {
        if (active) restoreLocal();
      }
    };

    loadSavedSetup();

    return () => {
      active = false;
    };
  }, [matchId, innings]);

  // Automatically save selections. The short delay avoids sending a request
  // for every intermediate change while the user is choosing players.
  useEffect(() => {
    if (!matchId || !strikerId || !nonStrikerId) return;
    if (strikerId === nonStrikerId) return;

    const key = setupStorageKey(matchId, innings);
    const saved = {
      strikerId,
      nonStrikerId,
      bowlerId,
    };

    try {
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // Browser storage is optional.
    }

    // Keep the browser copy immediately. If the bowler is blank at the end
    // of an over, don't send an incomplete setup to the backend.
    if (!bowlerId) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        await API.put(
          `/playing-xi/${matchId}/scoring-setup/${innings}`,
          {
            strikerId: Number(strikerId),
            nonStrikerId: Number(nonStrikerId),
            bowlerId: Number(bowlerId),
          }
        );

        if (!cancelled) {
          setNotice("Player selection saved automatically.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message ||
              err.response?.data?.error ||
              "Unable to save player selection."
          );
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [matchId, innings, strikerId, nonStrikerId, bowlerId]);

  const saveScoringSetup = async () => {
    if (!matchId) {
      setError("Select a match first.");
      return;
    }

    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError("Select the striker, non-striker and bowler.");
      return;
    }

    if (strikerId === nonStrikerId) {
      setError("Striker and non-striker must be different.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        strikerId: Number(strikerId),
        nonStrikerId: Number(nonStrikerId),
        bowlerId: Number(bowlerId),
      };

      await API.put(
        `/playing-xi/${matchId}/scoring-setup/${innings}`,
        payload
      );

      try {
        localStorage.setItem(
          setupStorageKey(matchId, innings),
          JSON.stringify({
            strikerId,
            nonStrikerId,
            bowlerId,
          })
        );
      } catch {
        // Browser storage is optional.
      }

      setNotice("Player selection saved.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to save scoring setup."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectMatch = (value) => {
    setMatchId(value);
    setSelection(null);
    setDeliveries([]);
    setStrikerId("");
    setNonStrikerId("");
    setBowlerId("");
    setPreviousOverBowlerId("");
    setInnings(1);
    setError("");
    setNotice("");
  };

  const recordDelivery = async ({
    runs = 0,
    type = "NONE",
    extras = 0,
    wicket = false,
  } = {}) => {
    if (!selectedMatch || !matchId) {
      setError("Select a match first.");
      return;
    }

    if (matchCompleted || stats.finished) {
      setError("This innings or match has finished.");
      return;
    }

    if (!selection) {
      setError("Save the toss and Playing XI first.");
      return;
    }

    if (!strikerId || !nonStrikerId || !bowlerId) {
      setError("Select the striker, non-striker and bowler.");
      return;
    }

    if (strikerId === nonStrikerId) {
      setError("Striker and non-striker must be different.");
      return;
    }

    if (wicket && !dismissedPlayerId) {
      setError("Select the dismissed batter.");
      return;
    }

    if (
      !battingXI.some((player) => idOf(player.id) === strikerId) ||
      !battingXI.some((player) => idOf(player.id) === nonStrikerId) ||
      !bowlingXI.some((player) => idOf(player.id) === bowlerId)
    ) {
      setError("Select players from the correct Playing XI.");
      return;
    }

    const normalizedType = String(type).toUpperCase();
    const batterRuns = Number(runs);
    const extrasValue = Number(extras);

    if (
      !Number.isInteger(batterRuns) ||
      batterRuns < 0 ||
      batterRuns > 6 ||
      !Number.isInteger(extrasValue) ||
      extrasValue < 0 ||
      extrasValue > 5
    ) {
      setError("Invalid runs or extras.");
      return;
    }

    if (
      wicket &&
      ![strikerId, nonStrikerId].includes(String(dismissedPlayerId))
    ) {
      setError("The dismissed player must be one of the two batters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      await API.put(
        `/playing-xi/${matchId}/scoring-setup/${innings}`,
        {
          strikerId: Number(strikerId),
          nonStrikerId: Number(nonStrikerId),
          bowlerId: Number(bowlerId),
        }
      );

      await API.post(`/live-scoring/${matchId}/deliveries`, {
        inningsNumber: innings,
        overNumber: Math.floor(stats.legalBalls / 6),
        ballNumber: (stats.legalBalls % 6) + 1,
        runsScored: batterRuns,
        extraRuns: extrasValue,
        extraType: normalizedType,
        wicket,
        dismissalType: wicket ? dismissalType : null,
        strikerId: Number(strikerId),
        nonStrikerId: Number(nonStrikerId),
        bowlerId: Number(bowlerId),
        dismissedPlayerId: wicket ? Number(dismissedPlayerId) : null,
      });

      // Calculate completed runs for strike rotation.
      let completedRuns;

      if (normalizedType === "WIDE") {
        completedRuns = Math.max(0, extrasValue - 1);
      } else if (normalizedType === "NO_BALL") {
        completedRuns = batterRuns + Math.max(0, extrasValue - 1);
      } else if (
        normalizedType === "BYE" ||
        normalizedType === "LEG_BYE"
      ) {
        completedRuns = extrasValue;
      } else {
        completedRuns = batterRuns;
      }

      const legalDelivery = isLegalBall({ extraType: normalizedType });
      const ballsAfter = stats.legalBalls + (legalDelivery ? 1 : 0);
      const overFinished = legalDelivery && ballsAfter > 0 && ballsAfter % 6 === 0;

      let nextStriker = strikerId;
      let nextNonStriker = nonStrikerId;

      if (Math.abs(completedRuns) % 2 === 1) {
        [nextStriker, nextNonStriker] = [
          nextNonStriker,
          nextStriker,
        ];
      }

      if (overFinished) {
        [nextStriker, nextNonStriker] = [
          nextNonStriker,
          nextStriker,
        ];

        setPreviousOverBowlerId(bowlerId);
        setBowlerId("");
        setNotice("Over completed. Choose a different bowler.");
      } else {
        setNotice("Delivery saved. Score refreshed.");
      }

      // On a wicket, clear the dismissed batter's slot so a replacement
      // can be selected. Otherwise persist the updated batting order.
      if (wicket) {
        if (String(dismissedPlayerId) === String(nextStriker)) {
          nextStriker = "";
        } else if (String(dismissedPlayerId) === String(nextNonStriker)) {
          nextNonStriker = "";
        }
      }

      setStrikerId(nextStriker);
      setNonStrikerId(nextNonStriker);
      setDismissedPlayerId("");

      try {
        localStorage.setItem(
          setupStorageKey(matchId, innings),
          JSON.stringify({
            strikerId: nextStriker,
            nonStrikerId: nextNonStriker,
            bowlerId: overFinished ? "" : bowlerId,
          })
        );
      } catch {
        // Browser storage is optional.
      }

      if (!overFinished && nextStriker && nextNonStriker) {
        await API.put(
          `/playing-xi/${matchId}/scoring-setup/${innings}`,
          {
            strikerId: Number(nextStriker),
            nonStrikerId: Number(nextNonStriker),
            bowlerId: Number(bowlerId),
          }
        );
      }

      await refreshScore(matchId, true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to record delivery."
      );
    } finally {
      setSaving(false);
    }
  };

  const undoLastDelivery = async () => {
    if (!matchId) {
      setError("Select a match first.");
      return;
    }

    const inningsDeliveries = deliveries.filter(
      (delivery) => Number(delivery.inningsNumber) === innings
    );

    if (!inningsDeliveries.length) {
      setError("No deliveries to undo in this innings.");
      return;
    }

    const last = inningsDeliveries[inningsDeliveries.length - 1];

    try {
      setSaving(true);
      setError("");

      await API.delete(`/live-scoring/deliveries/${last.id}`);
      await refreshScore(matchId, true);

      // Restore the players recorded on the delivery that was undone.
      const oldStriker = idOf(last.striker);
      const oldNonStriker = idOf(last.nonStriker);
      const oldBowler = idOf(last.bowler);

      if (oldStriker && oldNonStriker) {
        setStrikerId(oldStriker);
        setNonStrikerId(oldNonStriker);
      }
      if (oldBowler) setBowlerId(oldBowler);

      setNotice("Last delivery undone.");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to undo delivery."
      );
    } finally {
      setSaving(false);
    }
  };

  const startSecondInnings = () => {
    if (!firstStats.finished) {
      setError("Finish the first innings before starting the second.");
      return;
    }

    setInnings(2);
    setStrikerId("");
    setNonStrikerId("");
    setBowlerId("");
    setPreviousOverBowlerId("");
    setError("");
    setNotice("Second innings selected. Choose the opening players.");
  };

  const formatBall = (delivery) => {
    const type = extraTypeOf(delivery);
    const runs = Number(delivery.runsScored || 0);
    const extras = Number(delivery.extraRuns || 0);

    if (delivery.wicket) return "W";
    if (type === "WIDE") return `Wd ${extras}`;
    if (type === "NO_BALL") return `Nb ${runs + extras}`;
    if (type === "BYE") return `B ${extras}`;
    if (type === "LEG_BYE") return `Lb ${extras}`;

    return String(runs);
  };

  return (
    <main className="live-scoring-page">
      <header className="live-scoring-header">
        <div>
          <p className="live-scoring-eyebrow">FLICK SHOT</p>
          <h1>Live Cricket Scoring</h1>
          <p>Record every ball and follow the match in real time.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => refreshScore(matchId)}
          disabled={!matchId || loading || saving}
        >
          Refresh score
        </button>
      </header>

      {error && (
        <div className="scoring-alert error-alert" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="scoring-alert success-alert" role="status">
          {notice}
        </div>
      )}

      <section className="scoring-card">
        <label htmlFor="match-select">Select match</label>

        <select
          id="match-select"
          value={matchId}
          onChange={(event) => selectMatch(event.target.value)}
          disabled={loading || saving}
        >
          <option value="">Choose a match</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.title ||
                `${getTeamName(match, "teamOne")} vs ${getTeamName(
                  match,
                  "teamTwo"
                )}`}
              {" — "}
              {match.status || "UPCOMING"}
            </option>
          ))}
        </select>

        {loading && <p className="muted-text">Loading match data...</p>}
      </section>

      {selectedMatch && (
        <>
          <section className="scoreboard-card">
            <div className="scoreboard-top">
              <div>
                <p className="live-scoring-eyebrow">CURRENT INNINGS</p>
                <h2>{battingTeamName}</h2>
                <p className="muted-text">Batting against {bowlingTeamName}</p>
              </div>

              <span
                className={`match-status ${
                  matchCompleted ? "status-completed" : "status-live"
                }`}
              >
                {matchCompleted
                  ? "COMPLETED"
                  : selectedMatch.status || "UPCOMING"}
              </span>
            </div>

            <div className="scoreboard-score">
              <strong>
                {stats.runs}/{stats.wickets}
              </strong>
              <span>
                Overs {stats.overs} / {oversLimit}
              </span>
            </div>

            {innings === 2 && (
              <p className="target-line">
                Target: {firstStats.runs + 1} · Need{" "}
                {Math.max(0, firstStats.runs + 1 - secondStats.runs)} runs
              </p>
            )}

            <div className="scoreboard-details">
              <div>
                <span>Run rate</span>
                <strong>
                  {stats.legalBalls
                    ? (stats.runs / (stats.legalBalls / 6)).toFixed(2)
                    : "0.00"}
                </strong>
              </div>
              <div>
                <span>Legal balls</span>
                <strong>{stats.legalBalls}</strong>
              </div>
              <div>
                <span>Wickets remaining</span>
                <strong>{Math.max(0, 10 - stats.wickets)}</strong>
              </div>
            </div>

            {matchResult && (
              <div className="match-result">
                <h3>Match result</h3>
                <p>{matchResult}</p>
              </div>
            )}
          </section>

          <section className="scoring-card">
            <h2>Innings selection</h2>

            <div className="innings-buttons">
              <button
                type="button"
                className={
                  innings === 1 ? "primary-button" : "secondary-button"
                }
                onClick={() => {
                  setInnings(1);
                  setError("");
                  setNotice("");
                }}
              >
                First innings
              </button>

              <button
                type="button"
                className={
                  innings === 2 ? "primary-button" : "secondary-button"
                }
                onClick={startSecondInnings}
                disabled={!firstStats.finished && innings !== 2}
              >
                Second innings
              </button>
            </div>
          </section>

          {!matchCompleted && !stats.finished && (
            <>
              <section className="scoring-card">
                <h2>Batters and bowler</h2>

                <div className="scoring-form-grid">
                  <div>
                    <label htmlFor="striker-select">Striker</label>
                    <select
                      id="striker-select"
                      value={strikerId}
                      onChange={(event) => setStrikerId(event.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select striker</option>
                      {playerOptions(
                        battingXI.filter(
                          (player) => idOf(player.id) !== nonStrikerId
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="non-striker-select">Non-striker</label>
                    <select
                      id="non-striker-select"
                      value={nonStrikerId}
                      onChange={(event) =>
                        setNonStrikerId(event.target.value)
                      }
                      disabled={saving}
                    >
                      <option value="">Select non-striker</option>
                      {playerOptions(
                        battingXI.filter(
                          (player) => idOf(player.id) !== strikerId
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="bowler-select">Bowler</label>
                    <select
                      id="bowler-select"
                      value={bowlerId}
                      onChange={(event) => setBowlerId(event.target.value)}
                      disabled={saving}
                    >
                      <option value="">Select bowler</option>
                      {playerOptions(
                        bowlingXI.filter(
                          (player) =>
                            idOf(player.id) !== previousOverBowlerId
                        )
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={saveScoringSetup}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save batter and bowler selection"}
                </button>

                <div className="current-players">
                  <p>
                    <strong>Striker:</strong>{" "}
                    {currentStriker
                      ? playerName(currentStriker)
                      : "Not selected"}
                  </p>
                  <p>
                    <strong>Non-striker:</strong>{" "}
                    {currentNonStriker
                      ? playerName(currentNonStriker)
                      : "Not selected"}
                  </p>
                  <p>
                    <strong>Bowler:</strong>{" "}
                    {currentBowler
                      ? playerName(currentBowler)
                      : "Not selected"}
                  </p>
                </div>
              </section>

              <section className="scoring-card">
                <h2>Record delivery</h2>

                <div className="scoring-action-grid">
                  {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                    <button
                      key={runs}
                      type="button"
                      className={
                        runs === 4 || runs === 6
                          ? "run-button boundary-button"
                          : "run-button"
                      }
                      onClick={() =>
                        recordDelivery({
                          runs,
                          type: "NONE",
                          extras: 0,
                        })
                      }
                      disabled={saving}
                    >
                      {runs}
                    </button>
                  ))}
                </div>

                <div className="scoring-form-grid">
                  <div>
                    <label htmlFor="extra-type">Extra type</label>
                    <select
                      id="extra-type"
                      value={extraType}
                      onChange={(event) => setExtraType(event.target.value)}
                      disabled={saving}
                    >
                      {EXTRAS.filter((type) => type !== "NONE").map((type) => (
                        <option key={type} value={type}>
                          {type.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="extra-runs">Total extras</label>
                    <input
                      id="extra-runs"
                      type="number"
                      min="1"
                      max="5"
                      value={extraRuns}
                      onChange={(event) =>
                        setExtraRuns(Number(event.target.value))
                      }
                      disabled={saving}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    recordDelivery({
                      runs: 0,
                      type: extraType,
                      extras: extraRuns,
                    })
                  }
                  disabled={saving || extraType === "NONE"}
                >
                  Record extra
                </button>

                <div className="wicket-panel">
                  <h3>Record wicket</h3>

                  <div className="scoring-form-grid">
                    <div>
                      <label htmlFor="dismissal-type">Dismissal type</label>
                      <select
                        id="dismissal-type"
                        value={dismissalType}
                        onChange={(event) =>
                          setDismissalType(event.target.value)
                        }
                        disabled={saving}
                      >
                        {DISMISSALS.map((type) => (
                          <option key={type} value={type}>
                            {type.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="dismissed-player">
                        Dismissed batter
                      </label>
                      <select
                        id="dismissed-player"
                        value={dismissedPlayerId}
                        onChange={(event) =>
                          setDismissedPlayerId(event.target.value)
                        }
                        disabled={saving}
                      >
                        <option value="">Select dismissed batter</option>
                        {playerOptions(
                          battingXI.filter((player) =>
                            [strikerId, nonStrikerId].includes(idOf(player.id))
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() =>
                      recordDelivery({
                        runs: 0,
                        type: "NONE",
                        extras: 0,
                        wicket: true,
                      })
                    }
                    disabled={saving}
                  >
                    Record wicket
                  </button>
                </div>

                <button
                  type="button"
                  className="danger-button"
                  onClick={undoLastDelivery}
                  disabled={
                    saving ||
                    stats.deliveries.length === 0
                  }
                >
                  Undo last delivery
                </button>

                {saving && <p className="muted-text">Saving delivery...</p>}
              </section>
            </>
          )}

          <section className="scoring-card">
            <h2>Ball-by-ball commentary</h2>

            {stats.deliveries.length === 0 ? (
              <p className="muted-text">No deliveries recorded yet.</p>
            ) : (
              <div className="delivery-list">
                {[...stats.deliveries].reverse().map((delivery) => (
                  <div key={delivery.id} className="delivery-row">
                    <div>
                      <strong>
                        {Number(delivery.overNumber ?? 0) + 1}.
                        {delivery.ballNumber ?? "—"}
                      </strong>
                      <span>
                        {delivery.wicket
                          ? `Wicket · ${delivery.dismissalType || "OUT"}`
                          : extraTypeOf(delivery) !== "NONE"
                            ? extraTypeOf(delivery).replace("_", " ")
                            : "Delivery"}
                      </span>
                    </div>

                    <strong className="delivery-runs">
                      {formatBall(delivery)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
