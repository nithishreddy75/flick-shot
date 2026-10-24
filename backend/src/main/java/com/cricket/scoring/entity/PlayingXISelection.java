package com.cricket.scoring.entity;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
    name = "playing_xi_selections",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = "match_id")
    }
)
public class PlayingXISelection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false, unique = true)
    private Match match;

    @Column(name = "toss_winner_team_id")
    private Long tossWinnerTeamId;

    @Column(name = "toss_decision")
    private String tossDecision;

    @ElementCollection
    @CollectionTable(
        name = "playing_xi_team_one_players",
        joinColumns = @JoinColumn(name = "selection_id")
    )
    @OrderColumn(name = "player_order")
    @Column(name = "player_id")
    private List<Long> teamOnePlayerIds = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
        name = "playing_xi_team_two_players",
        joinColumns = @JoinColumn(name = "selection_id")
    )
    @OrderColumn(name = "player_order")
    @Column(name = "player_id")
    private List<Long> teamTwoPlayerIds = new ArrayList<>();

    // Persistent scoring setup for innings 1
    @Column(name = "innings_one_striker_id")
    private Long inningsOneStrikerId;

    @Column(name = "innings_one_non_striker_id")
    private Long inningsOneNonStrikerId;

    @Column(name = "innings_one_bowler_id")
    private Long inningsOneBowlerId;

    // Persistent scoring setup for innings 2
    @Column(name = "innings_two_striker_id")
    private Long inningsTwoStrikerId;

    @Column(name = "innings_two_non_striker_id")
    private Long inningsTwoNonStrikerId;

    @Column(name = "innings_two_bowler_id")
    private Long inningsTwoBowlerId;

    public PlayingXISelection() {
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

    public Long getTossWinnerTeamId() {
        return tossWinnerTeamId;
    }

    public void setTossWinnerTeamId(Long tossWinnerTeamId) {
        this.tossWinnerTeamId = tossWinnerTeamId;
    }

    public String getTossDecision() {
        return tossDecision;
    }

    public void setTossDecision(String tossDecision) {
        this.tossDecision = tossDecision;
    }

    public List<Long> getTeamOnePlayerIds() {
        return teamOnePlayerIds;
    }

    public void setTeamOnePlayerIds(List<Long> teamOnePlayerIds) {
        this.teamOnePlayerIds = teamOnePlayerIds == null
            ? new ArrayList<>()
            : new ArrayList<>(teamOnePlayerIds);
    }

    public List<Long> getTeamTwoPlayerIds() {
        return teamTwoPlayerIds;
    }

    public void setTeamTwoPlayerIds(List<Long> teamTwoPlayerIds) {
        this.teamTwoPlayerIds = teamTwoPlayerIds == null
            ? new ArrayList<>()
            : new ArrayList<>(teamTwoPlayerIds);
    }

    public Long getInningsOneStrikerId() {
        return inningsOneStrikerId;
    }

    public void setInningsOneStrikerId(Long inningsOneStrikerId) {
        this.inningsOneStrikerId = inningsOneStrikerId;
    }

    public Long getInningsOneNonStrikerId() {
        return inningsOneNonStrikerId;
    }

    public void setInningsOneNonStrikerId(Long inningsOneNonStrikerId) {
        this.inningsOneNonStrikerId = inningsOneNonStrikerId;
    }

    public Long getInningsOneBowlerId() {
        return inningsOneBowlerId;
    }

    public void setInningsOneBowlerId(Long inningsOneBowlerId) {
        this.inningsOneBowlerId = inningsOneBowlerId;
    }

    public Long getInningsTwoStrikerId() {
        return inningsTwoStrikerId;
    }

    public void setInningsTwoStrikerId(Long inningsTwoStrikerId) {
        this.inningsTwoStrikerId = inningsTwoStrikerId;
    }

    public Long getInningsTwoNonStrikerId() {
        return inningsTwoNonStrikerId;
    }

    public void setInningsTwoNonStrikerId(Long inningsTwoNonStrikerId) {
        this.inningsTwoNonStrikerId = inningsTwoNonStrikerId;
    }

    public Long getInningsTwoBowlerId() {
        return inningsTwoBowlerId;
    }

    public void setInningsTwoBowlerId(Long inningsTwoBowlerId) {
        this.inningsTwoBowlerId = inningsTwoBowlerId;
    }
}