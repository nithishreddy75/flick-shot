
package com.cricket.scoring.entity;

import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "players")
public class Player {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "mobile_number", length = 20, unique = true)
    private String mobileNumber;

    private String role;

    private String battingStyle;

    private String bowlingStyle;

    @ManyToMany
    @JoinTable(
        name = "player_teams",
        joinColumns = @JoinColumn(name = "player_id"),
        inverseJoinColumns = @JoinColumn(name = "team_id")
    )
    @JsonIgnore
    private Set<Team> teams = new HashSet<>();

    public Player() {
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getBattingStyle() {
        return battingStyle;
    }

    public void setBattingStyle(String battingStyle) {
        this.battingStyle = battingStyle;
    }

    public String getBowlingStyle() {
        return bowlingStyle;
    }

    public void setBowlingStyle(String bowlingStyle) {
        this.bowlingStyle = bowlingStyle;
    }

    public Set<Team> getTeams() {
        return teams;
    }

    public void setTeams(Set<Team> teams) {
        this.teams = teams != null ? teams : new HashSet<>();
    }

    public void addTeam(Team team) {
        if (team != null) {
            teams.add(team);
        }
    }

    public void removeTeam(Team team) {
        if (team != null) {
            teams.remove(team);
        }
    }
}
