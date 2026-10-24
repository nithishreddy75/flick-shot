
package com.cricket.scoring.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cricket.scoring.entity.BallDelivery;

public interface BallDeliveryRepository
        extends JpaRepository<BallDelivery, Long> {

    List<BallDelivery> findByMatchIdAndInningsNumberOrderByIdAsc(
            Long matchId,
            Integer inningsNumber
    );

    List<BallDelivery> findByMatchIdOrderByIdAsc(Long matchId);
}
