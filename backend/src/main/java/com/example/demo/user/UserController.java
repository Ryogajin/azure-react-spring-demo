package com.example.demo.user;

import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {
	private final AppUserRepository users;
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	public UserController(AppUserRepository users) {
		this.users = users;
	}

	public record UserResponse(UUID id, String username, String displayName, Instant createdAt, Instant updatedAt) {
	}

	public record CreateUserRequest(@NotBlank String username, @NotBlank String password, String displayName) {
	}

	public record UpdateUserRequest(String password, String displayName) {
	}

	@GetMapping
	public List<UserResponse> list() {
		return users.findAll().stream()
				.map(u -> new UserResponse(u.getId(), u.getUsername(), u.getDisplayName(), u.getCreatedAt(), u.getUpdatedAt()))
				.toList();
	}

	@PostMapping
	public ResponseEntity<?> create(@RequestBody CreateUserRequest req) {
		if (users.existsByUsername(req.username())) {
			return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "username already exists"));
		}
		var u = new AppUser();
		u.setUsername(req.username());
		u.setDisplayName(req.displayName() == null ? "" : req.displayName());
		u.setPasswordHash(passwordEncoder.encode(req.password()));
		u.setCreatedAt(Instant.now());
		u.setUpdatedAt(Instant.now());
		var saved = users.save(u);
		return ResponseEntity.status(HttpStatus.CREATED).body(new UserResponse(
				saved.getId(), saved.getUsername(), saved.getDisplayName(), saved.getCreatedAt(), saved.getUpdatedAt()
		));
	}

	@PutMapping("/{id}")
	public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateUserRequest req) {
		var uOpt = users.findById(id);
		if (uOpt.isEmpty()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "not found"));
		}
		var u = uOpt.get();
		if (req.displayName() != null) {
			u.setDisplayName(req.displayName());
		}
		if (req.password() != null && !req.password().isBlank()) {
			u.setPasswordHash(passwordEncoder.encode(req.password()));
		}
		u.setUpdatedAt(Instant.now());
		var saved = users.save(u);
		return ResponseEntity.ok(new UserResponse(
				saved.getId(), saved.getUsername(), saved.getDisplayName(), saved.getCreatedAt(), saved.getUpdatedAt()
		));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<?> delete(@PathVariable UUID id) {
		if (!users.existsById(id)) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "not found"));
		}
		users.deleteById(id);
		return ResponseEntity.noContent().build();
	}
}

