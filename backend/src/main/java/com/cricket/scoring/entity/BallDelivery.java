
package com.cricket.scoring.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "ball_deliveries")
public class BallDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @Column(name = "innings_number", nullable = false)
    private Integer inningsNumber;

    @Column(name = "over_number", nullable = false)
    private Integer overNumber;

    @Column(name = "ball_number", nullable = false)
    private Integer ballNumber;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "striker_id", nullable = false)
    private Player striker;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "non_striker_id", nullable = false)
    private Player nonStriker;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "bowler_id", nullable = false)
    private Player bowler;

    @Column(name = "runs_scored", nullable = false)
    private Integer runsScored = 0;

    @Column(name = "extra_runs", nullable = false)
    private Integer extraRuns = 0;

    @Column(name = "extra_type")
    private String extraType = "NONE";

    @Column(name = "is_wicket", nullable = false)
    private boolean wicket = false;

    @Column(name = "dismissal_type")
    private String dismissalType;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "dismissed_player_id")
    private Player dismissedPlayer;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt = LocalDateTime.now();

    public BallDelivery() {
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

    public Integer getInningsNumber() {
        return inningsNumber;
    }

    public void setInningsNumber(Integer inningsNumber) {
        this.inningsNumber = inningsNumber;
    }

    public Integer getOverNumber() {
        return overNumber;
    }

    public void setOverNumber(Integer overNumber) {
        this.overNumber = overNumber;
    }

    public Integer getBallNumber() {
        return ballNumber;
    }

    public void setBallNumber(Integer ballNumber) {
        this.ballNumber = ballNumber;
    }

    public Player getStriker() {
        return striker;
    }

    public void setStriker(Player striker) {
        this.striker = striker;
    }

    public Player getNonStriker() {
        return nonStriker;
    }

    public void setNonStriker(Player nonStriker) {
        this.nonStriker = nonStriker;
    }

    public Player getBowler() {
        return bowler;
    }

    public void setBowler(Player bowler) {
        this.bowler = bowler;
    }

    public Integer getRunsScored() {
        return runsScored;
    }

    public void setRunsScored(Integer runsScored) {
        this.runsScored = runsScored;
    }

    public Integer getExtraRuns() {
        return extraRuns;
    }

    public void setExtraRuns(Integer extraRuns) {
        this.extraRuns = extraRuns;
    }

    public String getExtraType() {
        return extraType;
    }

    public void setExtraType(String extraType) {
        this.extraType = extraType;
    }

    public boolean isWicket() {
        return wicket;
    }

    public void setWicket(boolean wicket) {
        this.wicket = wicket;
    }

    public String getDismissalType() {
        return dismissalType;
    }

    public void setDismissalType(String dismissalType) {
        this.dismissalType = dismissalType;
    }

    public Player getDismissedPlayer() {
        return dismissedPlayer;
    }

    public void setDismissedPlayer(Player dismissedPlayer) {
        this.dismissedPlayer = dismissedPlayer;
    }

    public LocalDateTime getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(LocalDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }
}
