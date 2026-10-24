package com.cricket.scoring.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cricket.scoring.entity.Match;
import com.cricket.scoring.entity.Player;
import com.cricket.scoring.entity.PlayingXISelection;
import com.cricket.scoring.repository.MatchRepository;
import com.cricket.scoring.repository.PlayerRepository;
import com.cricket.scoring.repository.PlayingXISelectionRepository;

@RestController
@RequestMapping("/api/playing-xi")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
})
public class PlayingXISelectionController {

    private final PlayingXISelectionRepository selectionRepository;
    private final MatchRepository matchRepository;
    private final PlayerRepository playerRepository;

    public PlayingXISelectionController(
            PlayingXISelectionRepository selectionRepository,
            MatchRepository matchRepository,
            PlayerRepository playerRepository) {
        this.selectionRepository = selectionRepository;
        this.matchRepository = matchRepository;
        this.playerRepository = playerRepository;
    }

    @GetMapping("/{matchId}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getSelection(@PathVariable Long matchId) {
        Optional<Match> matchOptional = matchRepository.findById(matchId);

        if (matchOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Match not found.");
        }

        Match match = matchOptional.get();
        Optional<PlayingXISelection> selectionOptional =
            selectionRepository.findByMatch_Id(matchId);

        Map<String, Object> response = new HashMap<>();
        response.put("matchId", matchId);
        response.put(
            "tossWinnerTeamId",
            selectionOptional.map(PlayingXISelection::getTossWinnerTeamId)
                .orElse(match.getTossWinner() == null
                    ? null : match.getTossWinner().getId())
        );
        response.put(
            "tossDecision",
            selectionOptional.map(PlayingXISelection::getTossDecision)
                .orElse(match.getTossDecision())
        );
        response.put(
            "teamOnePlayerIds",
            selectionOptional.map(PlayingXISelection::getTeamOnePlayerIds)
                .orElse(List.of())
        );
        response.put(
            "teamTwoPlayerIds",
            selectionOptional.map(PlayingXISelection::getTeamTwoPlayerIds)
                .orElse(List.of())
        );

        selectionOptional.ifPresent(selection -> {
            response.put("inningsOneStrikerId",
                selection.getInningsOneStrikerId());
            response.put("inningsOneNonStrikerId",
                selection.getInningsOneNonStrikerId());
            response.put("inningsOneBowlerId",
                selection.getInningsOneBowlerId());
            response.put("inningsTwoStrikerId",
                selection.getInningsTwoStrikerId());
            response.put("inningsTwoNonStrikerId",
                selection.getInningsTwoNonStrikerId());
            response.put("inningsTwoBowlerId",
                selection.getInningsTwoBowlerId());
        });

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{matchId}")
    @Transactional
    public ResponseEntity<?> saveSelection(
            @PathVariable Long matchId,
            @RequestBody Map<String, Object> request) {

        Optional<Match> matchOptional = matchRepository.findById(matchId);

        if (matchOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Match not found.");
        }

        Match match = matchOptional.get();

        Long tossWinnerId = toLong(request.get("tossWinnerTeamId"));
        String tossDecision = stringValue(request.get("tossDecision"));
        List<Long> teamOneIds = toLongList(request.get("teamOnePlayerIds"));
        List<Long> teamTwoIds = toLongList(request.get("teamTwoPlayerIds"));

        Long teamOneId = match.getTeamOne() == null
            ? null : match.getTeamOne().getId();
        Long teamTwoId = match.getTeamTwo() == null
            ? null : match.getTeamTwo().getId();

        if (teamOneId == null || teamTwoId == null) {
            return error(HttpStatus.BAD_REQUEST,
                "Both teams must be assigned to the match.");
        }

        if (tossWinnerId == null
                || (!tossWinnerId.equals(teamOneId)
                    && !tossWinnerId.equals(teamTwoId))) {
            return error(HttpStatus.BAD_REQUEST,
                "The toss winner must be one of the two match teams.");
        }

        if (tossDecision == null) {
            return error(HttpStatus.BAD_REQUEST,
                "Toss decision must be BAT or BOWL.");
        }

        tossDecision = tossDecision.trim().toUpperCase();

        if (!tossDecision.equals("BAT") && !tossDecision.equals("BOWL")) {
            return error(HttpStatus.BAD_REQUEST,
                "Toss decision must be BAT or BOWL.");
        }

        if (teamOneIds.size() != 11 || teamTwoIds.size() != 11) {
            return error(HttpStatus.BAD_REQUEST,
                "Select exactly 11 players for each team.");
        }

        Set<Long> allIds = new HashSet<>(teamOneIds);
        if (allIds.size() != 11) {
            return error(HttpStatus.BAD_REQUEST,
                "A player cannot appear twice in the first Playing XI.");
        }

        for (Long id : teamTwoIds) {
            if (!allIds.add(id)) {
                return error(HttpStatus.BAD_REQUEST,
                    "The same player cannot appear in both Playing XIs.");
            }
        }

        for (Long id : teamOneIds) {
            Player player = playerRepository.findById(id).orElse(null);
            if (player == null || !belongsToTeam(player, teamOneId)) {
                return error(HttpStatus.BAD_REQUEST,
                    "Every first-team player must belong to the first team.");
            }
        }

        for (Long id : teamTwoIds) {
            Player player = playerRepository.findById(id).orElse(null);
            if (player == null || !belongsToTeam(player, teamTwoId)) {
                return error(HttpStatus.BAD_REQUEST,
                    "Every second-team player must belong to the second team.");
            }
        }

        PlayingXISelection selection = selectionRepository
            .findByMatch_Id(matchId)
            .orElseGet(PlayingXISelection::new);

        selection.setMatch(match);
        selection.setTossWinnerTeamId(tossWinnerId);
        selection.setTossDecision(tossDecision);
        selection.setTeamOnePlayerIds(teamOneIds);
        selection.setTeamTwoPlayerIds(teamTwoIds);

        match.setTossWinner(
            tossWinnerId.equals(teamOneId)
                ? match.getTeamOne()
                : match.getTeamTwo()
        );
        match.setTossDecision(tossDecision);

        matchRepository.save(match);
        selectionRepository.save(selection);

        return getSelection(matchId);
    }

    @GetMapping("/{matchId}/scoring-setup/{inningsNumber}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getScoringSetup(
            @PathVariable Long matchId,
            @PathVariable Integer inningsNumber) {

        if (!validInnings(inningsNumber)) {
            return error(HttpStatus.BAD_REQUEST,
                "Innings number must be 1 or 2.");
        }

        Optional<PlayingXISelection> optional =
            selectionRepository.findByMatch_Id(matchId);

        if (optional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND,
                "Save the Playing XI and toss details first.");
        }

        PlayingXISelection selection = optional.get();
        Map<String, Object> response = new HashMap<>();
        response.put("matchId", matchId);
        response.put("inningsNumber", inningsNumber);

        if (inningsNumber == 1) {
            response.put("strikerId", selection.getInningsOneStrikerId());
            response.put("nonStrikerId",
                selection.getInningsOneNonStrikerId());
            response.put("bowlerId", selection.getInningsOneBowlerId());
        } else {
            response.put("strikerId", selection.getInningsTwoStrikerId());
            response.put("nonStrikerId",
                selection.getInningsTwoNonStrikerId());
            response.put("bowlerId", selection.getInningsTwoBowlerId());
        }

        return ResponseEntity.ok(response);
    }

    @PutMapping("/{matchId}/scoring-setup/{inningsNumber}")
    @Transactional
    public ResponseEntity<?> saveScoringSetup(
            @PathVariable Long matchId,
            @PathVariable Integer inningsNumber,
            @RequestBody Map<String, Object> request) {

        if (!validInnings(inningsNumber)) {
            return error(HttpStatus.BAD_REQUEST,
                "Innings number must be 1 or 2.");
        }

        Optional<Match> matchOptional = matchRepository.findById(matchId);
        if (matchOptional.isEmpty()) {
            return error(HttpStatus.NOT_FOUND, "Match not found.");
        }

        Optional<PlayingXISelection> selectionOptional =
            selectionRepository.findByMatch_Id(matchId);

        if (selectionOptional.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST,
                "Save the Playing XI and toss details first.");
        }

        Match match = matchOptional.get();
        PlayingXISelection selection = selectionOptional.get();

        Long strikerId = toLong(request.get("strikerId"));
        Long nonStrikerId = toLong(request.get("nonStrikerId"));
        Long bowlerId = toLong(request.get("bowlerId"));

        if (strikerId == null || nonStrikerId == null || bowlerId == null) {
            return error(HttpStatus.BAD_REQUEST,
                "Choose a striker, non-striker and bowler.");
        }

        if (strikerId.equals(nonStrikerId)) {
            return error(HttpStatus.BAD_REQUEST,
                "Striker and non-striker must be different players.");
        }

        Long battingTeamId = getBattingTeamId(match, selection, inningsNumber);
        Long bowlingTeamId = battingTeamId == null ? null
            : battingTeamId.equals(match.getTeamOne().getId())
                ? match.getTeamTwo().getId()
                : match.getTeamOne().getId();

        List<Long> battingIds = getXiIds(selection, battingTeamId, match);
        List<Long> bowlingIds = getXiIds(selection, bowlingTeamId, match);

        if (!battingIds.contains(strikerId)
                || !battingIds.contains(nonStrikerId)) {
            return error(HttpStatus.BAD_REQUEST,
                "Both batters must be in the batting team's saved Playing XI.");
        }

        if (!bowlingIds.contains(bowlerId)) {
            return error(HttpStatus.BAD_REQUEST,
                "The bowler must be in the bowling team's saved Playing XI.");
        }

        if (inningsNumber == 1) {
            selection.setInningsOneStrikerId(strikerId);
            selection.setInningsOneNonStrikerId(nonStrikerId);
            selection.setInningsOneBowlerId(bowlerId);
        } else {
            selection.setInningsTwoStrikerId(strikerId);
            selection.setInningsTwoNonStrikerId(nonStrikerId);
            selection.setInningsTwoBowlerId(bowlerId);
        }

        selectionRepository.save(selection);

        Map<String, Object> response = new HashMap<>();
        response.put("matchId", matchId);
        response.put("inningsNumber", inningsNumber);
        response.put("strikerId", strikerId);
        response.put("nonStrikerId", nonStrikerId);
        response.put("bowlerId", bowlerId);
        response.put("message", "Scoring setup saved.");

        return ResponseEntity.ok(response);
    }

    private Long getBattingTeamId(
            Match match,
            PlayingXISelection selection,
            Integer inningsNumber) {

        Long teamOneId = match.getTeamOne().getId();
        Long teamTwoId = match.getTeamTwo().getId();
        Long tossWinnerId = selection.getTossWinnerTeamId();
        String decision = selection.getTossDecision();

        if (tossWinnerId == null || decision == null) {
            return null;
        }

        boolean winnerBatsFirst = decision.equalsIgnoreCase("BAT");
        Long firstBattingTeam = winnerBatsFirst
            ? tossWinnerId
            : (tossWinnerId.equals(teamOneId) ? teamTwoId : teamOneId);

        if (inningsNumber == 1) {
            return firstBattingTeam;
        }

        return firstBattingTeam.equals(teamOneId) ? teamTwoId : teamOneId;
    }

    private List<Long> getXiIds(
            PlayingXISelection selection,
            Long teamId,
            Match match) {

        if (teamId == null) {
            return List.of();
        }

        if (teamId.equals(match.getTeamOne().getId())) {
            return selection.getTeamOnePlayerIds();
        }

        if (teamId.equals(match.getTeamTwo().getId())) {
            return selection.getTeamTwoPlayerIds();
        }

        return List.of();
    }

    private boolean belongsToTeam(Player player, Long teamId) {
        if (player.getTeams() == null) {
            return false;
        }

        return player.getTeams().stream()
            .anyMatch(team -> team.getId() != null
                && team.getId().equals(teamId));
    }

    private boolean validInnings(Integer inningsNumber) {
        return inningsNumber != null
            && (inningsNumber == 1 || inningsNumber == 2);
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<Long> toLongList(Object value) {
        List<Long> result = new ArrayList<>();

        if (!(value instanceof List<?> list)) {
            return result;
        }

        for (Object item : list) {
            Long id = toLong(item);
            if (id != null) {
                result.add(id);
            }
        }

        return result;
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private ResponseEntity<Map<String, String>> error(
            HttpStatus status,
            String message) {

        return ResponseEntity.status(status)
            .body(Map.of("error", message));
    }
}