package com.example.demo;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS（Cross-Origin Resource Sharing）設定
 * フロントエンドVM（IIS）からバックエンドVM（Spring Boot）への
 * クロスオリジン通信を許可する設定
 * 
 * 通信経路:
 *   ブラウザ → App Gateway → IIS(web1/web2) → Spring Boot(apps)
 *   IISとSpring Bootは異なるVMのため、CORSが必要
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                // localhost(:80) や App Gateway 経由アクセスを許可
                .allowedOriginPatterns(
                        "http://localhost",
                        "http://localhost:*",
                        "http://127.0.0.1",
                        "http://127.0.0.1:*",
                        "http://172.16.1.4",
                        "http://172.16.1.5",
                        "http://20.89.245.247",
                        "https://20.89.245.247"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}