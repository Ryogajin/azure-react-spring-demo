package com.example.demo;

import com.example.demo.user.AppUser;
import com.example.demo.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class DemoApplication {

	public static void main(String[] args) {
		SpringApplication.run(DemoApplication.class, args);
	}

	private final AppUserRepository users;

	public DemoApplication(AppUserRepository users) {
		this.users = users;
	}

	@Value("${app.bootstrap-admin.username}")
	private String bootstrapAdminUsername;

	@Value("${app.bootstrap-admin.password}")
	private String bootstrapAdminPassword;

	@Value("${app.bootstrap-admin.display-name}")
	private String bootstrapAdminDisplayName;

	private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

	@EventListener(ApplicationReadyEvent.class)
	public void bootstrapAdmin() {
		if (users.count() > 0) {
			return;
		}
		var admin = new AppUser();
		admin.setUsername(bootstrapAdminUsername);
		admin.setDisplayName(bootstrapAdminDisplayName);
		admin.setPasswordHash(passwordEncoder.encode(bootstrapAdminPassword));
		users.save(admin);
	}
}
