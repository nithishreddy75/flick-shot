
package com.cricket.scoring.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.cricket.scoring.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByMobileNumber(String mobileNumber);

    boolean existsByMobileNumber(String mobileNumber);
}
