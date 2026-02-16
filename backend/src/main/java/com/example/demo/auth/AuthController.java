package com.example.demo.auth;

import com.example.demo.security.JwtService;
import com.example.demo.user.AppUserRepository;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
	private final AppUserRepository users;
	private final JwtService jwtService;
	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	public AuthController(AppUserRepository users, JwtService jwtService) {
		this.users = users;
		this.jwtService = jwtService;
	}

	public record LoginRequest(@NotBlank String username, @NotBlank String password) {
	}

	@PostMapping("/login")
	public ResponseEntity<?> login(@RequestBody LoginRequest req) {
		var userOpt = users.findByUsername(req.username());
		if (userOpt.isEmpty()) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials"));
		}
		var user = userOpt.get();
		if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid credentials"));
		}
		var token = jwtService.createToken(
				user.getId().toString(),
				Map.of("username", user.getUsername(), "displayName", user.getDisplayName())
		);
		return ResponseEntity.ok(Map.of(
				"token", token,
				"user", Map.of(
						"id", user.getId(),
						"username", user.getUsername(),
						"displayName", user.getDisplayName()
				)
		));
	}
}

