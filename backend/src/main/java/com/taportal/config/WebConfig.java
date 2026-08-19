package com.taportal.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Opens CORS for the local frontend. POC only — no auth yet (delivery-phase concern). */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String allowedOrigin;

    public WebConfig(@Value("${app.cors.allowed-origin}") String allowedOrigin) {
        this.allowedOrigin = allowedOrigin;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // POC: allow the recruiter console (configured origin) and any local dev port — the
        // candidate career site runs on its own port (e.g. :5173) and POSTs to this API, and
        // Chrome attaches an Origin header on non-GET requests even same-origin-via-proxy.
        registry.addMapping("/v1/**")
                .allowedOriginPatterns(allowedOrigin, "http://localhost:*", "http://127.0.0.1:*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE");
    }
}
