package com.taportal.api;

import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.OptimisticLockException;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Global translation layer between domain exceptions and the API's error
 * contract (three-tier standard: the middleware owns the API surface — no
 * framework or database detail may leak to clients).
 *
 * <p>Every error response has one shape, documented in docs/CONTRACT.md:</p>
 * <pre>{@code { "code": "BUSINESS_RULE_VIOLATION", "message": "...", "fieldErrors": {...}? } }</pre>
 *
 * <h3>Status mapping</h3>
 * <ul>
 *   <li>400 {@code VALIDATION_ERROR} — Bean Validation failures on DTOs (with per-field messages)</li>
 *   <li>404 {@code NOT_FOUND} — missing aggregates ({@link EntityNotFoundException} or 404 RSE)</li>
 *   <li>409 {@code CONFLICT} — duplicates and races: 409 RSE, DB unique-constraint hits
 *       (the schema's safety net surfacing cleanly), optimistic-lock failures</li>
 *   <li>422 {@code BUSINESS_RULE_VIOLATION} — service-layer rule rejections</li>
 *   <li>500 {@code INTERNAL_ERROR} — everything unexpected; logged server-side,
 *       generic message to the client (never a stack trace or SQL state)</li>
 * </ul>
 *
 * <p>Services signal expected failures with {@link ResponseStatusException};
 * this handler normalizes the body so clients read {@code message} uniformly.</p>
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** The single error envelope every failure returns. */
    public record ErrorResponse(String code, String message, Map<String, String> fieldErrors) {
        static ErrorResponse of(String code, String message) {
            return new ErrorResponse(code, message, null);
        }
    }

    /** DTO structural validation (@Valid) — 400 with a message per offending field. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("VALIDATION_ERROR", "Input validation failed", errors));
    }

    /** Missing aggregates thrown by services as JPA EntityNotFoundException. */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse.of("NOT_FOUND", ex.getMessage()));
    }

    /**
     * The database's structural safety net firing (e.g. the unique
     * "one registration per event+email" constraint winning a race the service
     * check missed). Surfaced as a clean 409 — constraint names stay internal.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("CONFLICT", "The request conflicts with existing data"));
    }

    /** Concurrent modification detected via @Version optimistic locking. */
    @ExceptionHandler(OptimisticLockException.class)
    public ResponseEntity<ErrorResponse> handleOptimisticLock(OptimisticLockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("CONFLICT", "The record was modified by someone else — reload and retry"));
    }

    /** Expected failures thrown by services; status carried on the exception. */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleStatus(ResponseStatusException ex) {
        String code = switch (ex.getStatusCode().value()) {
            case 400 -> "VALIDATION_ERROR";
            case 401, 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            case 422 -> "BUSINESS_RULE_VIOLATION";
            default -> "ERROR";
        };
        return ResponseEntity.status(ex.getStatusCode())
                .body(ErrorResponse.of(code, ex.getReason() != null ? ex.getReason() : "Request failed"));
    }

    /** Catch-all: log the truth, tell the client nothing exploitable. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
    }
}
