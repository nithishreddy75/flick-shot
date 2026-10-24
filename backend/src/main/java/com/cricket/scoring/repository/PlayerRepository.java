
package com.cricket.scoring.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cricket.scoring.entity.Player;

@Repository
public interface PlayerRepository extends JpaRepository<Player, Long> {

    // Find a player by their unique mobile number
    Optional<Player> findByMobileNumber(String mobileNumber);

    // Check whether a mobile number is already registered
    boolean existsByMobileNumber(String mobileNumber);
}
