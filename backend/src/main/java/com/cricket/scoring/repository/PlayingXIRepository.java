
package com.cricket.scoring.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cricket.scoring.entity.PlayingXI;

public interface PlayingXIRepository
        extends JpaRepository<PlayingXI, Long> {

    Optional<PlayingXI> findByMatchId(Long matchId);
}
