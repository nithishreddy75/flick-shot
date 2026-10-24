
package com.cricket.scoring.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cricket.scoring.entity.Match;

@Repository
public interface MatchRepository extends JpaRepository<Match, Long> {

    List<Match> findAllByOrderByMatchDateDesc();
}
