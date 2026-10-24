
package com.cricket.scoring.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cricket.scoring.entity.PlayingXISelection;

@Repository
public interface PlayingXISelectionRepository
        extends JpaRepository<PlayingXISelection, Long> {

    Optional<PlayingXISelection> findByMatch_Id(Long matchId);
}
