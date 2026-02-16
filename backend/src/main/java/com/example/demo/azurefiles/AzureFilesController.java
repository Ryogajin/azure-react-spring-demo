package com.example.demo.azurefiles;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/azurefiles")
public class AzureFilesController {
	@Value("${app.azurefiles.path:}")
	private String azureFilesPath;

	@GetMapping("/test")
	public ResponseEntity<?> test() {
		if (azureFilesPath == null || azureFilesPath.isBlank()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
					"message", "AZURE_FILES_PATH is empty. Mount Azure Files and set AZURE_FILES_PATH (e.g. Z:\\\\)"
			));
		}
		try {
			var base = Path.of(azureFilesPath);
			Files.createDirectories(base);
			var file = base.resolve("azurefiles-test.txt");
			var content = "ok " + Instant.now() + System.lineSeparator();
			Files.writeString(file, content);
			var read = Files.readString(file);
			return ResponseEntity.ok(Map.of(
					"path", file.toString(),
					"written", content.trim(),
					"read", read.trim()
			));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
					"message", "Azure Files test failed",
					"error", e.getClass().getName(),
					"detail", String.valueOf(e.getMessage())
			));
		}
	}
}

