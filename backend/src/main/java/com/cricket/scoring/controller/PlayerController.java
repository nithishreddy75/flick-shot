
package com.cricket.scoring.controller;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cricket.scoring.entity.Player;
import com.cricket.scoring.entity.Team;
import com.cricket.scoring.repository.PlayerRepository;
import com.cricket.scoring.repository.TeamRepository;

@RestController
@RequestMapping("/api/players")
@CrossOrigin(origins = "http://localhost:5173")
public class PlayerController {

    private final PlayerRepository playerRepository;
    private final TeamRepository teamRepository;

    public PlayerController(
            PlayerRepository playerRepository,
            TeamRepository teamRepository) {
        this.playerRepository = playerRepository;
        this.teamRepository = teamRepository;
    }

    // Get all players, including their team assignments.
    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllPlayers() {
        List<Player> players = playerRepository.findAll();
        List<Map<String, Object>> response = new ArrayList<>();

        for (Player player : players) {
            response.add(toResponse(player));
        }

        return response;
    }

    // Get one player, including their team assignments.
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> getPlayerById(@PathVariable Long id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Player not found"));

        return toResponse(player);
    }

    // Find an existing player by mobile number.
    @GetMapping("/by-mobile")
    @Transactional(readOnly = true)
    public Map<String, Object> getPlayerByMobile(
            @RequestParam String mobileNumber) {

        String mobile = normalizeMobile(mobileNumber);

        Player player = playerRepository.findByMobileNumber(mobile)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No player found with this mobile number"));

        return toResponse(player);
    }

    // Create a new player.
    @PostMapping
    @Transactional
    public Map<String, Object> createPlayer(
            @RequestBody Map<String, Object> data) {

        Player player = new Player();
        applyData(player, data);

        return toResponse(savePlayer(player));
    }

    // Update an existing player.
    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> updatePlayer(
            @PathVariable Long id,
            @RequestBody Map<String, Object> data) {

        Player player = playerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Player not found"));

        applyData(player, data);

        return toResponse(savePlayer(player));
    }

    // Add an existing player to a team without creating a duplicate.
    @PostMapping("/{playerId}/teams")
    @Transactional
    public Map<String, Object> addPlayerToTeam(
            @PathVariable Long playerId,
            @RequestBody Map<String, Object> data) {

        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Player not found"));

        Long teamId = readRequiredLong(data, "teamId");

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));

        player.addTeam(team);

        return toResponse(savePlayer(player));
    }

    // Remove a player from a team without deleting the player.
    @DeleteMapping("/{playerId}/teams/{teamId}")
    @Transactional
    public Map<String, Object> removePlayerFromTeam(
            @PathVariable Long playerId,
            @PathVariable Long teamId) {

        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Player not found"));

        Team team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));

        player.removeTeam(team);

        return toResponse(savePlayer(player));
    }

    // Delete a player only if they do not belong to any team.
    @DeleteMapping("/{id}")
    @Transactional
    public void deletePlayer(@PathVariable Long id) {

        Player player = playerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Player not found"));

        if (player.getTeams() != null
                && !player.getTeams().isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Remove the player from all teams before deleting");
        }

        playerRepository.delete(player);
    }

    // Convert a Player entity into JSON-safe data that includes team IDs.
    private Map<String, Object> toResponse(Player player) {

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("id", player.getId());
        response.put("name", player.getName());
        response.put("mobileNumber", player.getMobileNumber());
        response.put("role", player.getRole());
        response.put("battingStyle", player.getBattingStyle());
        response.put("bowlingStyle", player.getBowlingStyle());

        List<Map<String, Object>> teams = new ArrayList<>();
        List<Long> teamIds = new ArrayList<>();

        if (player.getTeams() != null) {
            for (Team team : player.getTeams()) {

                Map<String, Object> teamData = new LinkedHashMap<>();
                teamData.put("id", team.getId());
                teamData.put("name", team.getName());

                teams.add(teamData);
                teamIds.add(team.getId());
            }
        }

        response.put("teams", teams);
        response.put("teamIds", teamIds);

        // Backward compatibility for code expecting a single team ID.
        if (teamIds.size() == 1) {
            response.put("teamId", teamIds.get(0));
        } else {
            response.put("teamId", null);
        }

        return response;
    }

    // Apply incoming player details.
    private void applyData(
            Player player,
            Map<String, Object> data) {

        String name = readRequiredString(data, "name");
        String role = readRequiredString(data, "role");

        player.setName(name.trim());
        player.setRole(role.trim());

        if (data.containsKey("battingStyle")) {
            player.setBattingStyle(
                    cleanOptionalString(data.get("battingStyle")));
        }

        if (data.containsKey("bowlingStyle")) {
            player.setBowlingStyle(
                    cleanOptionalString(data.get("bowlingStyle")));
        }

        // Validate and set mobile number when supplied.
        if (data.containsKey("mobileNumber")) {

            String rawMobile = cleanOptionalString(
                    data.get("mobileNumber"));

            String mobile = rawMobile == null
                    ? null
                    : normalizeMobile(rawMobile);

            if (mobile != null) {
                Optional<Player> existing =
                        playerRepository.findByMobileNumber(mobile);

                if (existing.isPresent()
                        && !existing.get().getId()
                                .equals(player.getId())) {

                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "A player already exists with this mobile number");
                }
            }

            player.setMobileNumber(mobile);
        }

        // Replace team memberships when teamIds is provided.
        if (data.containsKey("teamIds")) {

            Object rawTeamIds = data.get("teamIds");

            if (!(rawTeamIds instanceof List<?>)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "teamIds must be a list of team IDs");
            }

            List<?> teamIds = (List<?>) rawTeamIds;
            Set<Team> selectedTeams = new HashSet<>();

            for (Object rawId : teamIds) {
                Long teamId = parseLong(rawId, "teamIds");

                Team team = teamRepository.findById(teamId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Team not found: " + teamId));

                selectedTeams.add(team);
            }

            Set<Team> currentTeams =
                    new HashSet<>(player.getTeams());

            for (Team team : currentTeams) {
                if (!selectedTeams.contains(team)) {
                    player.removeTeam(team);
                }
            }

            for (Team team : selectedTeams) {
                player.addTeam(team);
            }

        } else if (data.containsKey("teamId")) {

            // Support the older single-team request format.
            Object rawTeamId = data.get("teamId");

            Set<Team> currentTeams =
                    new HashSet<>(player.getTeams());

            if (rawTeamId == null
                    || rawTeamId.toString().trim().isEmpty()) {

                for (Team team : currentTeams) {
                    player.removeTeam(team);
                }

            } else {
                Long teamId = parseLong(rawTeamId, "teamId");

                Team selectedTeam = teamRepository.findById(teamId)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Team not found"));

                for (Team team : currentTeams) {
                    if (!team.getId().equals(teamId)) {
                        player.removeTeam(team);
                    }
                }

                player.addTeam(selectedTeam);
            }
        }
    }

    // Save a player and translate database constraint errors.
    private Player savePlayer(Player player) {
        try {
            return playerRepository.save(player);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A player with these details already exists",
                    ex);
        }
    }

    private String readRequiredString(
            Map<String, Object> data,
            String key) {

        Object value = data.get(key);

        if (value == null || value.toString().trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    key + " is required");
        }

        return value.toString();
    }

    private Long readRequiredLong(
            Map<String, Object> data,
            String key) {

        Object value = data.get(key);

        if (value == null || value.toString().trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    key + " is required");
        }

        return parseLong(value, key);
    }

    private Long parseLong(Object value, String fieldName) {
        try {
            long id = Long.parseLong(value.toString());

            if (id <= 0) {
                throw new NumberFormatException();
            }

            return id;

        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    fieldName + " must be a valid positive number");
        }
    }

    private String cleanOptionalString(Object value) {
        if (value == null) {
            return null;
        }

        String result = value.toString().trim();

        return result.isEmpty() ? null : result;
    }

    private String normalizeMobile(String mobileNumber) {

        if (mobileNumber == null || mobileNumber.trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mobile number is required");
        }

        String mobile = mobileNumber.trim()
                .replaceAll("[\\s()-]", "");

        if (!mobile.matches("^\\+?[0-9]{7,15}$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid mobile number");
        }

        return mobile;
    }
}
