
package com.cricket.scoring.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cricket.scoring.entity.Player;
import com.cricket.scoring.entity.Team;
import com.cricket.scoring.repository.TeamRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@RestController
@RequestMapping("/api/teams")
@CrossOrigin(origins = "http://localhost:5173")
public class TeamController {

    private final TeamRepository teamRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public TeamController(TeamRepository teamRepository) {
        this.teamRepository = teamRepository;
    }

    @GetMapping
    public List<Team> getAllTeams() {
        return teamRepository.findAll();
    }

    @GetMapping("/{id}")
    public Team getTeamById(@PathVariable Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));
    }

    @GetMapping("/{id}/players")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTeamPlayers(
            @PathVariable Long id) {

        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));

        List<Map<String, Object>> result = new ArrayList<>();

        for (Player player : team.getPlayers()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", player.getId());
            item.put("name", player.getName());
            item.put("mobileNumber", player.getMobileNumber());
            item.put("role", player.getRole());
            item.put("battingStyle", player.getBattingStyle());
            item.put("bowlingStyle", player.getBowlingStyle());
            result.add(item);
        }

        return result;
    }

    @PostMapping
    public Team createTeam(@RequestBody Map<String, String> request) {
        String name = request.get("name");
        String shortName = request.get("shortName");

        validateTeam(name, shortName);

        Team team = new Team();
        team.setName(name.trim());
        team.setShortName(shortName.trim().toUpperCase());
        team.setLogoUrl(cleanLogoUrl(request.get("logoUrl")));
        team.setCaptainMobileNumber(
                cleanMobileNumber(request.get("captainMobileNumber")));

        return teamRepository.save(team);
    }

    @PutMapping("/{id}")
    public Team updateTeam(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {

        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));

        String name = request.get("name");
        String shortName = request.get("shortName");

        validateTeam(name, shortName);

        team.setName(name.trim());
        team.setShortName(shortName.trim().toUpperCase());
        team.setLogoUrl(cleanLogoUrl(request.get("logoUrl")));
        team.setCaptainMobileNumber(
                cleanMobileNumber(request.get("captainMobileNumber")));

        return teamRepository.save(team);
    }

    // Delete team-player links first, then delete the team.
    // Player records themselves are preserved.
    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, String> deleteTeam(@PathVariable Long id) {

        Team team = teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));

        try {
            // Flush pending ORM changes before the native delete.
            entityManager.flush();

            // This assumes the join table is player_teams and
            // its team foreign-key column is team_id.
            entityManager.createNativeQuery(
                    "DELETE FROM player_teams WHERE team_id = :teamId")
                    .setParameter("teamId", id)
                    .executeUpdate();

            teamRepository.delete(team);
            teamRepository.flush();

            return Map.of(
                    "message", "Team deleted successfully",
                    "teamId", id.toString());

        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "This team may be linked to an existing match. "
                    + "Update or remove its match references before deleting it.",
                    ex);
        }
    }

    private void validateTeam(String name, String shortName) {
        if (name == null || name.trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Team name is required");
        }

        if (name.trim().length() > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Team name cannot exceed 100 characters");
        }

        if (shortName == null || shortName.trim().isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Team short name is required");
        }

        if (shortName.trim().length() > 10) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Team short name cannot exceed 10 characters");
        }
    }

    private String cleanMobileNumber(String mobile) {
        if (mobile == null || mobile.trim().isEmpty()) {
            return null;
        }

        String normalized = mobile.trim().replaceAll("[\\s()-]", "");

        if (!normalized.matches("^\\+?[0-9]{7,15}$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid captain mobile number");
        }

        return normalized;
    }

    private String cleanLogoUrl(String logoUrl) {
        if (logoUrl == null || logoUrl.trim().isEmpty()) {
            return null;
        }

        return logoUrl.trim();
    }
}
