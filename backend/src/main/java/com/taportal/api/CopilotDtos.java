package com.taportal.api;

import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.UUID;

/** AI copilot response + request DTOs. */
public final class CopilotDtos {

    private CopilotDtos() {}

    public record CopilotArtifactResponse(
            UUID id, String kind, String jobTitle, String content, OffsetDateTime createdAt) {}

    /** {@code kind} is one of JD | OUTREACH | INTERVIEW_QUESTIONS | SUMMARY | REWRITE. */
    public record GenerateRequest(@NotBlank String kind, UUID jobId, String prompt) {}
}
