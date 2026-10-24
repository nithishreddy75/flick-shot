
package com.cricket.scoring.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "playing_xi")
public class PlayingXI {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "match_id", nullable = false, unique = true)
    private Match match;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "toss_winner_id", nullable = false)
    private Team tossWinner;

    @Column(name = "toss_decision", nullable = false)
    private String tossDecision;

    @Column(name = "team1_player_ids", nullable = false, columnDefinition = "TEXT")
    private String team1PlayerIds;

    @Column(name = "team2_player_ids", nullable = false, columnDefinition = "TEXT")
    private String team2PlayerIds;

    public PlayingXI() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Match getMatch() {
        return match;
    }

    public void setMatch(Match match) {
        this.match = match;
    }

    public Team getTossWinner() {
        return tossWinner;
    }

    public void setTossWinner(Team tossWinner) {
        this.tossWinner = tossWinner;
    }

    public String getTossDecision() {
        return tossDecision;
    }

    public void setTossDecision(String tossDecision) {
        this.tossDecision = tossDecision;
    }

    public String getTeam1PlayerIds() {
        return team1PlayerIds;
    }

    public void setTeam1PlayerIds(String team1PlayerIds) {
        this.team1PlayerIds = team1PlayerIds;
    }

    public String getTeam2PlayerIds() {
        return team2PlayerIds;
    }

    public void setTeam2PlayerIds(String team2PlayerIds) {
        this.team2PlayerIds = team2PlayerIds;
    }
}
