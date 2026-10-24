package com.cricket.scoring.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cricket.scoring.entity.BallDelivery;
import com.cricket.scoring.entity.Match;
import com.cricket.scoring.entity.Player;
import com.cricket.scoring.repository.BallDeliveryRepository;
import com.cricket.scoring.repository.MatchRepository;
import com.cricket.scoring.repository.PlayerRepository;

@RestController
@RequestMapping("/api/live-scoring")
@CrossOrigin(origins = {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
})
public class LiveScoringController {

    private final BallDeliveryRepository deliveryRepository;
    private final MatchRepository matchRepository;
    private final PlayerRepository playerRepository;

    public LiveScoringController(
            BallDeliveryRepository deliveryRepository,
            MatchRepository matchRepository,
            PlayerRepository playerRepository) {

        this.deliveryRepository = deliveryRepository;
        this.matchRepository = matchRepository;
        this.playerRepository = playerRepository;
    }

    @GetMapping("/{matchId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getMatchDeliveries(
            @PathVariable Long matchId) {

        if (!matchRepository.existsById(matchId)) {
            return error(HttpStatus.NOT_FOUND, "Match not found.");
        }

        return ResponseEntity.ok(
                deliveryRepository.findByMatchIdOrderByIdAsc(matchId));
    }

    @GetMapping("/{matchId}/innings/{inningsNumber}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getInningsDeliveries(
            @PathVariable Long matchId,
            @PathVariable Integer inningsNumber) {

        if (!matchRepository.existsById(matchId)) {
            return error(HttpStatus.NOT_FOUND, "Match not found.");
        }

        if (inningsNumber < 1 || inningsNumber > 4) {
            return error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid innings number.");
        }

        return ResponseEntity.ok(
                deliveryRepository
                        .findByMatchIdAndInningsNumberOrderByIdAsc(
                                matchId, inningsNumber));
    }

    @PostMapping("/{matchId}/deliveries")
    @Transactional
    public ResponseEntity<?> recordDelivery(
            @PathVariable Long matchId,
            @RequestBody Map<String, Object> data) {

        try {
            Match match = matchRepository.findById(matchId).orElse(null);

            if (match == null) {
                return error(HttpStatus.NOT_FOUND, "Match not found.");
            }

            int inningsNumber = requiredInt(data, "inningsNumber");
            int overNumber = requiredInt(data, "overNumber");
            int ballNumber = requiredInt(data, "ballNumber");
            int runsScored = optionalInt(data, "runsScored", 0);
            int extraRuns = optionalInt(data, "extraRuns", 0);

            int matchOvers = match.getTotalOvers() != null
                    ? match.getTotalOvers()
                    : defaultOvers(match.getMatchFormat());

            if (matchOvers < 1 || matchOvers > 450) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Invalid match overs setting.");
            }

            if (inningsNumber < 1 || inningsNumber > 4
                    || overNumber < 0
                    || ballNumber < 1 || ballNumber > 6
                    || runsScored < 0 || runsScored > 6
                    || extraRuns < 0 || extraRuns > 5) {

                return error(
                        HttpStatus.BAD_REQUEST,
                        "Invalid innings, over, ball, runs, or extras.");
            }

            String extraType = String.valueOf(
                    data.getOrDefault("extraType", "NONE"))
                    .trim().toUpperCase();

            if (!List.of(
                    "NONE", "WIDE", "NO_BALL",
                    "BYE", "LEG_BYE", "PENALTY")
                    .contains(extraType)) {

                return error(
                        HttpStatus.BAD_REQUEST,
                        "Invalid extra type.");
            }

            if ("WIDE".equals(extraType) && extraRuns < 1) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "A wide must include at least one extra run.");
            }

            if ("NO_BALL".equals(extraType) && extraRuns < 1) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "A no-ball must include at least one extra run.");
            }

            boolean wicket = Boolean.parseBoolean(
                    String.valueOf(data.getOrDefault("wicket", false)));

            String dismissalType = data.get("dismissalType") == null
                    ? null
                    : data.get("dismissalType").toString()
                            .trim().toUpperCase();

            if (wicket && (dismissalType == null
                    || dismissalType.isBlank())) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Provide a dismissal type for a wicket.");
            }

            Long strikerId = requiredLong(data, "strikerId");
            Long nonStrikerId = requiredLong(data, "nonStrikerId");
            Long bowlerId = requiredLong(data, "bowlerId");

            if (strikerId.equals(nonStrikerId)) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Striker and non-striker must be different players.");
            }

            Player striker = playerRepository.findById(strikerId)
                    .orElse(null);

            Player nonStriker = playerRepository.findById(nonStrikerId)
                    .orElse(null);

            Player bowler = playerRepository.findById(bowlerId)
                    .orElse(null);

            if (striker == null || nonStriker == null || bowler == null) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Striker, non-striker, or bowler not found.");
            }

            Player dismissedPlayer = null;

            if (wicket) {
                Long dismissedId = requiredLong(data, "dismissedPlayerId");

                if (!dismissedId.equals(strikerId)
                        && !dismissedId.equals(nonStrikerId)) {
                    return error(
                            HttpStatus.BAD_REQUEST,
                            "Dismissed player must be one of the two batters.");
                }

                dismissedPlayer = playerRepository.findById(dismissedId)
                        .orElse(null);

                if (dismissedPlayer == null) {
                    return error(
                            HttpStatus.BAD_REQUEST,
                            "Dismissed player not found.");
                }
            }

            List<BallDelivery> existing =
                    deliveryRepository
                            .findByMatchIdAndInningsNumberOrderByIdAsc(
                                    matchId, inningsNumber);

            int legalBalls = 0;
            int bowlerLegalBalls = 0;

            for (BallDelivery previous : existing) {
                if (isLegalBall(previous.getExtraType())) {
                    legalBalls++;

                    if (previous.getBowler() != null
                            && bowlerId.equals(previous.getBowler().getId())) {
                        bowlerLegalBalls++;
                    }
                }
            }

            if (legalBalls >= matchOvers * 6) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "This innings has reached its overs limit.");
            }

            int expectedOver = legalBalls / 6;
            int expectedBall = (legalBalls % 6) + 1;

            if (overNumber != expectedOver || ballNumber != expectedBall) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Incorrect delivery sequence. Expected over "
                                + (expectedOver + 1)
                                + ", ball " + expectedBall + ".");
            }

            int maximumBowlerOvers = Math.max(1, (matchOvers + 4) / 5);
            int maximumBowlerBalls = maximumBowlerOvers * 6;

            if (bowlerLegalBalls >= maximumBowlerBalls) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "Bowler has reached the limit of "
                                + maximumBowlerOvers + " overs.");
            }

            int wicketsSoFar = (int) existing.stream()
                    .filter(BallDelivery::isWicket)
                    .count();

            if (wicketsSoFar >= 10) {
                return error(
                        HttpStatus.BAD_REQUEST,
                        "This innings is already all out.");
            }

            BallDelivery delivery = new BallDelivery();
            delivery.setMatch(match);
            delivery.setInningsNumber(inningsNumber);
            delivery.setOverNumber(overNumber);
            delivery.setBallNumber(ballNumber);
            delivery.setStriker(striker);
            delivery.setNonStriker(nonStriker);
            delivery.setBowler(bowler);
            delivery.setRunsScored(runsScored);
            delivery.setExtraRuns(extraRuns);
            delivery.setExtraType(extraType);
            delivery.setWicket(wicket);
            delivery.setDismissalType(wicket ? dismissalType : null);
            delivery.setDismissedPlayer(dismissedPlayer);

            BallDelivery saved = deliveryRepository.saveAndFlush(delivery);

            Match latestMatch = matchRepository.findById(matchId)
                    .orElseThrow(() ->
                            new IllegalArgumentException("Match not found."));

            updateMatchSummary(latestMatch);

            return ResponseEntity.status(HttpStatus.CREATED).body(saved);

        } catch (IllegalArgumentException exception) {
            return error(
                    HttpStatus.BAD_REQUEST,
                    "Missing or invalid scoring fields.");
        }
    }

    // Continue with Part 2.
        @DeleteMapping("/deliveries/{deliveryId}")
    @Transactional
    public ResponseEntity<?> deleteDelivery(
            @PathVariable Long deliveryId) {

        BallDelivery delivery = deliveryRepository.findById(deliveryId)
                .orElse(null);

        if (delivery == null) {
            return error(HttpStatus.NOT_FOUND, "Delivery not found.");
        }

        Long matchId = delivery.getMatch() == null
                ? null
                : delivery.getMatch().getId();

        deliveryRepository.delete(delivery);
        deliveryRepository.flush();

        if (matchId != null) {
            Match match = matchRepository.findById(matchId).orElse(null);

            if (match != null) {
                updateMatchSummary(match);
            }
        }

        return ResponseEntity.noContent().build();
    }

    private static class InningsSummary {
        private int runs;
        private int wickets;
        private int legalBalls;
        private boolean started;
        private boolean finished;
    }

    private InningsSummary summarizeInnings(
            Long matchId,
            int inningsNumber,
            int oversLimit,
            Integer target) {

        InningsSummary summary = new InningsSummary();

        List<BallDelivery> inningsDeliveries =
                deliveryRepository
                        .findByMatchIdAndInningsNumberOrderByIdAsc(
                                matchId, inningsNumber);

        summary.started = !inningsDeliveries.isEmpty();

        for (BallDelivery delivery : inningsDeliveries) {
            summary.runs +=
                    (delivery.getRunsScored() == null
                            ? 0 : delivery.getRunsScored())
                    + (delivery.getExtraRuns() == null
                            ? 0 : delivery.getExtraRuns());

            if (delivery.isWicket()) {
                summary.wickets++;
            }

            if (isLegalBall(delivery.getExtraType())) {
                summary.legalBalls++;
            }
        }

        summary.finished =
                summary.legalBalls >= oversLimit * 6
                || summary.wickets >= 10
                || (target != null && summary.runs >= target);

        return summary;
    }

    private void updateMatchSummary(Match match) {
        if (match.getTeamOne() == null || match.getTeamTwo() == null) {
            return;
        }

        int oversLimit = match.getTotalOvers() == null
                ? defaultOvers(match.getMatchFormat())
                : match.getTotalOvers();

        InningsSummary first = summarizeInnings(
                match.getId(), 1, oversLimit, null);

        Integer target = first.started ? first.runs + 1 : null;

        InningsSummary second = summarizeInnings(
                match.getId(), 2, oversLimit, target);

        Long tossWinnerId = match.getTossWinner() == null
                ? null
                : match.getTossWinner().getId();

        String decision = match.getTossDecision();

        if (tossWinnerId == null || decision == null
                || (!decision.equalsIgnoreCase("BAT")
                && !decision.equalsIgnoreCase("BOWL"))) {

            match.setStatus(
                    first.started || second.started ? "LIVE" : "UPCOMING");
            match.setResult(null);
            matchRepository.saveAndFlush(match);
            return;
        }

        Long teamOneId = match.getTeamOne().getId();
        Long teamTwoId = match.getTeamTwo().getId();

        Long firstBattingTeamId = decision.equalsIgnoreCase("BAT")
                ? tossWinnerId
                : (tossWinnerId.equals(teamOneId)
                        ? teamTwoId : teamOneId);

        boolean teamOneBattedFirst =
                firstBattingTeamId.equals(teamOneId);

        if (teamOneBattedFirst) {
            match.setTeamOneScore(first.runs);
            match.setTeamOneWickets(first.wickets);
            match.setTeamTwoScore(second.runs);
            match.setTeamTwoWickets(second.wickets);
        } else {
            match.setTeamTwoScore(first.runs);
            match.setTeamTwoWickets(first.wickets);
            match.setTeamOneScore(second.runs);
            match.setTeamOneWickets(second.wickets);
        }

        boolean completed =
                first.finished && second.started && second.finished;

        if (completed) {
            String firstBattingName = teamOneBattedFirst
                    ? match.getTeamOne().getName()
                    : match.getTeamTwo().getName();

            String secondBattingName = teamOneBattedFirst
                    ? match.getTeamTwo().getName()
                    : match.getTeamOne().getName();

            if (second.runs > first.runs) {
                match.setResult(
                        secondBattingName + " won by "
                        + Math.max(0, 10 - second.wickets)
                        + " wickets");
            } else if (first.runs > second.runs) {
                match.setResult(
                        firstBattingName + " won by "
                        + (first.runs - second.runs) + " runs");
            } else {
                match.setResult("Match tied");
            }

            match.setStatus("COMPLETED");

        } else if (first.started || second.started) {
            match.setStatus("LIVE");
            match.setResult(null);

        } else {
            match.setStatus("UPCOMING");
            match.setResult(null);
        }

        matchRepository.saveAndFlush(match);
    }

    private boolean isLegalBall(String extraType) {
        String type = extraType == null
                ? "NONE"
                : extraType.toUpperCase();

        return !type.equals("WIDE") && !type.equals("NO_BALL");
    }

    private int defaultOvers(String matchFormat) {
        if (matchFormat == null) {
            return 20;
        }

        String format = matchFormat.toUpperCase();

        if (format.contains("TEST")) {
            return 90;
        }

        if (format.contains("ODI")) {
            return 50;
        }

        if (format.contains("T10")) {
            return 10;
        }

        return 20;
    }

    private int requiredInt(Map<String, Object> data, String key) {
        Object value = data.get(key);

        if (value == null || value.toString().isBlank()) {
            throw new IllegalArgumentException("Missing " + key);
        }

        return Integer.parseInt(value.toString());
    }

    private int optionalInt(
            Map<String, Object> data,
            String key,
            int defaultValue) {

        Object value = data.get(key);

        return value == null || value.toString().isBlank()
                ? defaultValue
                : Integer.parseInt(value.toString());
    }

    private Long requiredLong(Map<String, Object> data, String key) {
        Object value = data.get(key);

        if (value == null || value.toString().isBlank()) {
            throw new IllegalArgumentException("Missing " + key);
        }

        return Long.valueOf(value.toString());
    }

    private ResponseEntity<Map<String, String>> error(
            HttpStatus status,
            String message) {

        return ResponseEntity.status(status)
                .body(Map.of("message", message));
    }
}