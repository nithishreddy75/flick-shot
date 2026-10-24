
package com.cricket.scoring.controller;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cricket.scoring.entity.Match;
import com.cricket.scoring.entity.Team;
import com.cricket.scoring.repository.MatchRepository;
import com.cricket.scoring.repository.TeamRepository;

@RestController
@RequestMapping("/api/matches")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
})
public class MatchController {

    private final MatchRepository matchRepository;
    private final TeamRepository teamRepository;

    public MatchController(
            MatchRepository matchRepository,
            TeamRepository teamRepository) {
        this.matchRepository = matchRepository;
        this.teamRepository = teamRepository;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllMatches() {
        return matchRepository.findAllByOrderByMatchDateDesc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getMatchById(@PathVariable Long id) {
        return toResponse(findMatch(id));
    }

    @PostMapping
    @Transactional
    public Map<String, Object> createMatch(
            @RequestBody Map<String, Object> request) {

        Match match = new Match();
        applyRequest(match, request);

        return toResponse(matchRepository.save(match));
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updateMatch(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {

        Match match = findMatch(id);

        if ("LIVE".equalsIgnoreCase(match.getStatus())
                || "COMPLETED".equalsIgnoreCase(match.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Live or completed matches cannot be edited"
            );
        }

        applyRequest(match, request);
        return toResponse(matchRepository.save(match));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void deleteMatch(@PathVariable Long id) {
        Match match = findMatch(id);

        if ("LIVE".equalsIgnoreCase(match.getStatus())
                || "COMPLETED".equalsIgnoreCase(match.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "A live or completed match cannot be deleted"
            );
        }

        matchRepository.delete(match);
    }

    private Match findMatch(Long id) {
        return matchRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Match not found"
            ));
    }

    private void applyRequest(
            Match match,
            Map<String, Object> request) {

        Long teamOneId = requiredLong(request, "teamOneId", "team1Id");
        Long teamTwoId = requiredLong(request, "teamTwoId", "team2Id");

        if (teamOneId.equals(teamTwoId)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Select two different teams"
            );
        }

        Team teamOne = teamRepository.findById(teamOneId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "First team not found"
            ));

        Team teamTwo = teamRepository.findById(teamTwoId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Second team not found"
            ));

        String format = optionalString(request, "matchFormat", "matchType");

        if (format == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "matchFormat or matchType is required"
            );
        }

        format = format.trim().toUpperCase()
            .replace('-', '_')
            .replace(' ', '_');

        List<String> supportedFormats = List.of(
            "T10", "T20", "ODI", "TEST",
            "CUSTOM", "LIMITED_OVERS", "BOX_CRICKET"
        );

        if (!supportedFormats.contains(format)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Unsupported match format"
            );
        }

        int overs = requiredInteger(request, "totalOvers", "overs");

        if (overs < 1 || overs > 450) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Overs must be between 1 and 450"
            );
        }

        String dateValue = optionalString(request, "matchDate", "scheduledDate");

        if (dateValue == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "matchDate is required"
            );
        }

        LocalDateTime matchDate = parseDate(dateValue);
        String venue = optionalString(request, "venue", "ground");

        if (venue != null && venue.length() > 200) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Venue cannot exceed 200 characters"
            );
        }

        String title = optionalString(request, "title");

        if (title == null) {
            title = teamOne.getName() + " vs " + teamTwo.getName();
        }

        if (title.length() > 150) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Match title cannot exceed 150 characters"
            );
        }

        match.setTitle(title);
        match.setTeamOne(teamOne);
        match.setTeamTwo(teamTwo);
        match.setMatchType(format);
        match.setMatchFormat(format);
        match.setTotalOvers(overs);
        match.setMatchDate(matchDate);
        match.setVenue(venue);

        if (match.getStatus() == null || match.getStatus().isBlank()) {
            match.setStatus("UPCOMING");
        }

        Object tossWinnerValue = firstPresent(request, "tossWinnerTeamId");

        if (tossWinnerValue != null) {
            Long tossWinnerId = parseLong(
                tossWinnerValue, "tossWinnerTeamId"
            );

            if (tossWinnerId.equals(teamOneId)) {
                match.setTossWinner(teamOne);
            } else if (tossWinnerId.equals(teamTwoId)) {
                match.setTossWinner(teamTwo);
            } else {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Toss winner must be one of the selected teams"
                );
            }

            String decision = requiredString(request, "tossDecision")
                .toUpperCase();

            if (!List.of("BAT", "BOWL").contains(decision)) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Toss decision must be BAT or BOWL"
                );
            }

            match.setTossDecision(decision);
        } else if (match.getTossWinner() == null) {
            match.setTossDecision(null);
        }
    }

    private Map<String, Object> toResponse(Match match) {
        Map<String, Object> response = new LinkedHashMap<>();

        Team teamOne = match.getTeamOne();
        Team teamTwo = match.getTeamTwo();

        response.put("id", match.getId());
        response.put("title", match.getTitle());

        response.put("teamOneId", teamOne.getId());
        response.put("teamOneName", teamOne.getName());
        response.put("teamOneShortName", teamOne.getShortName());

        response.put("teamTwoId", teamTwo.getId());
        response.put("teamTwoName", teamTwo.getName());
        response.put("teamTwoShortName", teamTwo.getShortName());

        response.put("team1Id", teamOne.getId());
        response.put("team2Id", teamTwo.getId());

        response.put("matchType", match.getMatchType());
        response.put("matchFormat", match.getMatchFormat());
        response.put("overs", match.getTotalOvers());
        response.put("totalOvers", match.getTotalOvers());

        Map<String, Object> teamOneResponse = new LinkedHashMap<>();
        teamOneResponse.put("id", teamOne.getId());
        teamOneResponse.put("name", teamOne.getName());
        teamOneResponse.put("shortName", teamOne.getShortName());

        Map<String, Object> teamTwoResponse = new LinkedHashMap<>();
        teamTwoResponse.put("id", teamTwo.getId());
        teamTwoResponse.put("name", teamTwo.getName());
        teamTwoResponse.put("shortName", teamTwo.getShortName());

        response.put("teamOne", teamOneResponse);
        response.put("teamTwo", teamTwoResponse);
        response.put("team1", teamOneResponse);
        response.put("team2", teamTwoResponse);

        response.put("matchDate", match.getMatchDate());
        response.put("venue", match.getVenue());
        response.put("ground", match.getVenue());
        response.put("status", match.getStatus());

        response.put(
            "tossWinnerTeamId",
            match.getTossWinner() == null
                ? null : match.getTossWinner().getId()
        );

        response.put(
            "tossWinnerName",
            match.getTossWinner() == null
                ? null : match.getTossWinner().getName()
        );

        response.put("tossDecision", match.getTossDecision());
        response.put("teamOneScore", match.getTeamOneScore());
        response.put("teamOneWickets", match.getTeamOneWickets());
        response.put("teamTwoScore", match.getTeamTwoScore());
        response.put("teamTwoWickets", match.getTeamTwoWickets());
        response.put("result", match.getResult());

        return response;
    }

    private Object firstPresent(
            Map<String, Object> request, String... keys) {

        for (String key : keys) {
            Object value = request.get(key);
            if (value != null && !value.toString().isBlank()) {
                return value;
            }
        }

        return null;
    }

    private String requiredString(
            Map<String, Object> request, String... keys) {

        String value = optionalString(request, keys);

        if (value == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, keys[0] + " is required"
            );
        }

        return value;
    }

    private String optionalString(
            Map<String, Object> request, String... keys) {

        Object value = firstPresent(request, keys);
        return value == null ? null : value.toString().trim();
    }

    private Long requiredLong(
            Map<String, Object> request, String... keys) {

        Object value = firstPresent(request, keys);

        if (value == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST, keys[0] + " is required"
            );
        }

        return parseLong(value, keys[0]);
    }

    private Long parseLong(Object value, String key) {
        try {
            long id = Long.parseLong(value.toString());

            if (id <= 0) {
                throw new NumberFormatException();
            }

            return id;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                key + " must be a positive number"
            );
        }
    }

    private int requiredInteger(
            Map<String, Object> request, String... keys) {

        Object value = firstPresent(request, keys);

        try {
            if (value == null) {
                throw new NumberFormatException();
            }
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                keys[0] + " must be a whole number"
            );
        }
    }

    private LocalDateTime parseDate(String value) {
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ex) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Use matchDate format YYYY-MM-DDTHH:mm"
            );
        }
    }
}
