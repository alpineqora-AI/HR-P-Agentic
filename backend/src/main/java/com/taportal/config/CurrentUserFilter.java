package com.taportal.config;

import com.taportal.domain.recruiter.RecruiterUser;
import com.taportal.domain.recruiter.RecruiterUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the acting user from the {@code X-User-Id} header (dev "acting as") into
 * {@link CurrentUser} for the duration of the request. Falls back to the first ADMIN when the
 * header is absent, so the POC always has an actor. Real SSO replaces this at delivery.
 */
@Component
public class CurrentUserFilter extends OncePerRequestFilter {

    private final RecruiterUserRepository users;

    public CurrentUserFilter(RecruiterUserRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            RecruiterUser actor = resolve(request.getHeader("X-User-Id"));
            if (actor != null) {
                CurrentUser.set(actor.getId(), actor.getName(),
                        actor.getRole() == null ? null : actor.getRole().toUpperCase());
            }
            chain.doFilter(request, response);
        } finally {
            CurrentUser.clear();
        }
    }

    private RecruiterUser resolve(String headerId) {
        if (headerId != null && !headerId.isBlank()) {
            try {
                RecruiterUser u = users.findById(UUID.fromString(headerId.trim())).orElse(null);
                if (u != null) {
                    return u;
                }
            } catch (IllegalArgumentException ignored) {
                // not a UUID — fall through to default
            }
        }
        return users.findAll().stream()
                .filter(u -> "ADMIN".equalsIgnoreCase(u.getRole()))
                .findFirst()
                .orElse(null);
    }
}
