
package com.cricket.scoring.entity;

import java.util.HashSet;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "teams")
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String shortName;

    @Column(length = 1000)
    private String logoUrl;

    @Column(name = "captain_mobile_number", length = 20)
    private String captainMobileNumber;

    @ManyToMany(mappedBy = "teams")
    @JsonIgnore
    private Set<Player> players = new HashSet<>();

    // Default constructor
    public Team() {
    }

    // Parameterized constructor
    public Team(String name, String shortName, String logoUrl) {
        this.name = name;
        this.shortName = shortName;
        this.logoUrl = logoUrl;
    }

    // Getters and setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getShortName() {
        return shortName;
    }

    public void setShortName(String shortName) {
        this.shortName = shortName;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getCaptainMobileNumber() {
        return captainMobileNumber;
    }

    public void setCaptainMobileNumber(String captainMobileNumber) {
        this.captainMobileNumber = captainMobileNumber;
    }

    public Set<Player> getPlayers() {
        return players;
    }

    public void setPlayers(Set<Player> players) {
        this.players = players;
    }

    // Add a player to this team
    public void addPlayer(Player player) {
        if (player != null) {
            player.addTeam(this);
            players.add(player);
        }
    }

    // Remove a player from this team
    public void removePlayer(Player player) {
        if (player != null) {
            player.removeTeam(this);
            players.remove(player);
        }
    }
}
