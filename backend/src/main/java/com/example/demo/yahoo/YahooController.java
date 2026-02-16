package com.example.demo.yahoo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/yahoo")
public class YahooController {
	private final HttpClient http = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.followRedirects(HttpClient.Redirect.NORMAL)
			.build();

	@GetMapping
	public Map<String, Object> fetch() throws Exception {
		var req = HttpRequest.newBuilder()
				.uri(URI.create("https://www.yahoo.co.jp/"))
				.timeout(Duration.ofSeconds(15))
				.GET()
				.header("User-Agent", "azure-demo/1.0")
				.build();
		var res = http.send(req, HttpResponse.BodyHandlers.ofString());
		var body = res.body() == null ? "" : res.body();
		var snippet = body.length() <= 200 ? body : body.substring(0, 200);
		return Map.of(
				"status", res.statusCode(),
				"length", body.length(),
				"snippet", snippet
		);
	}
}

