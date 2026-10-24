
package com.cricket.scoring.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cricket.scoring.entity.Team;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {

    // Check whether a team name already exists
    boolean existsByNameIgnoreCase(String name);

    // Check whether a team short name already exists
    boolean existsByShortNameIgnoreCase(String shortName);
}
