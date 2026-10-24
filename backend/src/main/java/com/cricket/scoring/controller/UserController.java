
package com.cricket.scoring.controller;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.cricket.scoring.entity.User;
import com.cricket.scoring.repository.UserRepository;
import com.cricket.scoring.security.JwtService;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:5173")
public class UserController {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public UserController(
            UserRepository userRepository,
            JwtService jwtService,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    // =========================================================
    // MOBILE REGISTRATION
    // POST /api/users/mobile-register
    // =========================================================

    @PostMapping("/mobile-register")
    @Transactional
    public ResponseEntity<?> mobileRegister(
            @RequestBody Map<String, String> request) {

        String name = request.get("name");
        String mobile;
        String password = request.get("password");

        try {
            mobile = normalizeMobile(request.get("mobileNumber"));
        } catch (ResponseStatusException ex) {
            return badRequest(ex.getReason());
        }

        if (name == null || name.trim().length() < 2) {
            return badRequest(
                    "Enter your full name (at least 2 characters).");
        }

        try {
            validatePassword(password);
        } catch (ResponseStatusException ex) {
            return badRequest(ex.getReason());
        }

        if (userRepository.findByMobileNumber(mobile).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "This mobile number is already registered. Please sign in."));
        }

        User user = new User();
        user.setName(name.trim());
        user.setMobileNumber(mobile);
        user.setPassword(passwordEncoder.encode(password));

        // New mobile registrations cannot grant themselves
        // organizer or administrator privileges.
        user.setRole("USER");

        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "This mobile number is already registered."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message",
                        "Account created successfully. Please sign in."));
    }

    // =========================================================
    // MOBILE LOGIN
    // POST /api/users/mobile-login
    // =========================================================

    @PostMapping("/mobile-login")
    @Transactional(readOnly = true)
    public ResponseEntity<?> mobileLogin(
            @RequestBody Map<String, String> request) {

        String mobile;

        try {
            mobile = normalizeMobile(request.get("mobileNumber"));
        } catch (ResponseStatusException ex) {
            return badRequest(ex.getReason());
        }

        String password = request.get("password");

        if (password == null || password.isBlank()) {
            return badRequest(
                    "Mobile number and password are required.");
        }

        Optional<User> existingUser =
                userRepository.findByMobileNumber(mobile);

        if (existingUser.isEmpty()) {
            return invalidCredentials();
        }

        User user = existingUser.get();
        String storedPassword = user.getPassword();

        // Only accept BCrypt hashes. Never compare a submitted
        // password against a stored plaintext password.
        if (storedPassword == null
                || !isBcryptHash(storedPassword)
                || !passwordEncoder.matches(
                        password, storedPassword)) {

            return invalidCredentials();
        }

        return ResponseEntity.ok(
                createLoginResponse(user, mobile));
    }

    // =========================================================
    // EMAIL REGISTRATION - BACKWARD COMPATIBILITY
    // POST /api/users/register
    // =========================================================

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(
            @RequestBody Map<String, String> request) {

        String email = request.get("email");
        String password = request.get("password");
        String name = request.get("name");

        if (name == null || name.isBlank()) {
            name = request.get("fullName");
        }

        if (email == null || email.isBlank()
                || password == null || password.isBlank()) {

            return badRequest(
                    "Email and password are required.");
        }

        if (name == null || name.trim().length() < 2) {
            return badRequest("Enter your full name.");
        }

        try {
            validatePassword(password);
        } catch (ResponseStatusException ex) {
            return badRequest(ex.getReason());
        }

        email = email.trim().toLowerCase();

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "Email is already registered."));
        }

        User user = new User();
        user.setName(name.trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));

        // Preserve the existing email registration behavior.
        // Never accept a role supplied by the client.
        user.setRole("ORGANIZER");

        try {
            userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "This account already exists."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message",
                        "Registration successful. You can now log in."));
    }

    // =========================================================
    // EMAIL LOGIN - BACKWARD COMPATIBILITY
    // POST /api/users/login
    // =========================================================

    @PostMapping("/login")
    @Transactional(readOnly = true)
    public ResponseEntity<?> login(
            @RequestBody Map<String, String> request) {

        String email = request.get("email");

        if (email == null || email.isBlank()) {
            email = request.get("username");
        }

        String password = request.get("password");

        if (email == null || email.isBlank()
                || password == null || password.isBlank()) {

            return badRequest(
                    "Email and password are required.");
        }

        email = email.trim().toLowerCase();

        Optional<User> existingUser =
                userRepository.findByEmail(email);

        if (existingUser.isEmpty()) {
            return invalidCredentials();
        }

        User user = existingUser.get();
        String storedPassword = user.getPassword();

        if (storedPassword == null
                || !isBcryptHash(storedPassword)
                || !passwordEncoder.matches(
                        password, storedPassword)) {

            return invalidCredentials();
        }

        return ResponseEntity.ok(
                createLoginResponse(user, user.getEmail()));
    }

    // =========================================================
    // CREATE LOGIN RESPONSE AND JWT
    // =========================================================

    private Map<String, Object> createLoginResponse(
            User user,
            String jwtIdentity) {

        String role = user.getRole() == null
                || user.getRole().isBlank()
                        ? "USER"
                        : user.getRole()
                                .replaceFirst("(?i)^ROLE_", "")
                                .toUpperCase();

        String token = jwtService.generateToken(
                user.getId(),
                jwtIdentity,
                role);

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put("message", "Login successful");
        response.put("id", user.getId());
        response.put("name", user.getName());
        response.put(
                "email",
                user.getEmail() == null ? "" : user.getEmail());
        response.put(
                "mobileNumber",
                user.getMobileNumber() == null
                        ? "" : user.getMobileNumber());
        response.put("role", role);
        response.put("token", token);

        return response;
    }

    // =========================================================
    // PASSWORD VALIDATION
    // =========================================================

    private void validatePassword(String password) {

        if (password == null || password.length() < 8) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password must contain at least 8 characters.");
        }

        if (password.length() > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Password cannot exceed 72 characters.");
        }
    }

    private boolean isBcryptHash(String password) {
        return password.startsWith("$2a$")
                || password.startsWith("$2b$")
                || password.startsWith("$2y$");
    }

    // =========================================================
    // MOBILE NUMBER NORMALIZATION
    // =========================================================

    private String normalizeMobile(String raw) {

        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mobile number is required.");
        }

        String mobile = raw.trim()
                .replaceAll("[\\s()-]", "");

        if (mobile.startsWith("+")) {
            mobile = mobile.substring(1);
        }

        // Treat ten-digit numbers as Indian mobile numbers.
        if (mobile.matches("[0-9]{10}")) {
            mobile = "91" + mobile;
        }

        if (!mobile.matches("[1-9][0-9]{6,14}")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid mobile number with country code.");
        }

        return mobile;
    }

    // =========================================================
    // STANDARD ERROR RESPONSES
    // =========================================================

    private ResponseEntity<Map<String, String>> badRequest(
            String message) {

        return ResponseEntity.badRequest()
                .body(Map.of("message", message));
    }

    private ResponseEntity<Map<String, String>> invalidCredentials() {

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of(
                        "message",
                        "Invalid mobile number or password."));
    }
}
