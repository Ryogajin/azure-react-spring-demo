package com.example.demo.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {
	private final SecretKey key;
	private final String issuer;
	private final long ttlSeconds;

	public JwtService(
			@Value("${app.jwt.secret}") String secret,
			@Value("${app.jwt.issuer}") String issuer,
			@Value("${app.jwt.ttl-seconds}") long ttlSeconds
	) {
		// HS256 needs 256-bit key; enforce minimum length by padding if dev forgot.
		var bytes = secret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < 32) {
			var padded = (secret + "________________________________").substring(0, 32);
			bytes = padded.getBytes(StandardCharsets.UTF_8);
		}
		this.key = Keys.hmacShaKeyFor(bytes);
		this.issuer = issuer;
		this.ttlSeconds = ttlSeconds;
	}

	public String createToken(String subject, Map<String, Object> claims) {
		var now = Instant.now();
		var exp = now.plusSeconds(ttlSeconds);
		return Jwts.builder()
				.issuer(issuer)
				.subject(subject)
				.issuedAt(Date.from(now))
				.expiration(Date.from(exp))
				.claims(claims)
				.signWith(key, Jwts.SIG.HS256)
				.compact();
	}

	public JwtPrincipal parse(String token) {
		var jwt = Jwts.parser()
				.verifyWith(key)
				.requireIssuer(issuer)
				.build()
				.parseSignedClaims(token);
		var claims = jwt.getPayload();
		var sub = claims.getSubject();
		var username = (String) claims.get("username");
		return new JwtPrincipal(sub, username);
	}
}

