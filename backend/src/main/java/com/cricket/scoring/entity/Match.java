
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
@Table(name = "cricket_matches")
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_one_id", nullable = false)
    private Team teamOne;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_two_id", nullable = false)
    private Team teamTwo;

    @Column(name = "match_type", nullable = false, length = 255)
    private String matchType;

    @Column(name = "match_format", nullable = false, length = 30)
    private String matchFormat;

    @Column(name = "total_overs", nullable = false)
    private Integer totalOvers;

    @Column(name = "match_date", nullable = false)
    private LocalDateTime matchDate;

    @Column(length = 200)
    private String venue;

    @Column(nullable = false, length = 20)
    private String status = "UPCOMING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "toss_winner_team_id")
    private Team tossWinner;

    @Column(name = "toss_decision", length = 10)
    private String tossDecision;

    @Column(name = "team_one_score", nullable = false)
    private Integer teamOneScore = 0;

    @Column(name = "team_one_wickets", nullable = false)
    private Integer teamOneWickets = 0;

    @Column(name = "team_two_score", nullable = false)
    private Integer teamTwoScore = 0;

    @Column(name = "team_two_wickets", nullable = false)
    private Integer teamTwoWickets = 0;

    @Column(length = 500)
    private String result;

    public Match() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Team getTeamOne() {
        return teamOne;
    }

    public void setTeamOne(Team teamOne) {
        this.teamOne = teamOne;
    }

    public Team getTeamTwo() {
        return teamTwo;
    }

    public void setTeamTwo(Team teamTwo) {
        this.teamTwo = teamTwo;
    }

    public String getMatchType() {
        return matchType;
    }

    public void setMatchType(String matchType) {
        this.matchType = matchType;
    }

    public String getMatchFormat() {
        return matchFormat;
    }

    public void setMatchFormat(String matchFormat) {
        this.matchFormat = matchFormat;
    }

    public Integer getTotalOvers() {
        return totalOvers;
    }

    public void setTotalOvers(Integer totalOvers) {
        this.totalOvers = totalOvers;
    }

    public LocalDateTime getMatchDate() {
        return matchDate;
    }

    public void setMatchDate(LocalDateTime matchDate) {
        this.matchDate = matchDate;
    }

    public String getVenue() {
        return venue;
    }

    public void setVenue(String venue) {
        this.venue = venue;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public Integer getTeamOneScore() {
        return teamOneScore;
    }

    public void setTeamOneScore(Integer teamOneScore) {
        this.teamOneScore = teamOneScore;
    }

    public Integer getTeamOneWickets() {
        return teamOneWickets;
    }

    public void setTeamOneWickets(Integer teamOneWickets) {
        this.teamOneWickets = teamOneWickets;
    }

    public Integer getTeamTwoScore() {
        return teamTwoScore;
    }

    public void setTeamTwoScore(Integer teamTwoScore) {
        this.teamTwoScore = teamTwoScore;
    }

    public Integer getTeamTwoWickets() {
        return teamTwoWickets;
    }

    public void setTeamTwoWickets(Integer teamTwoWickets) {
        this.teamTwoWickets = teamTwoWickets;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }
}
