package com.taportal.api;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Assessment DTOs (per CONTRACT.md). */
public final class AssessmentDtos {

    private AssessmentDtos() {}

    public record AssessmentResponse(
            UUID id,
            UUID applicationId,
            String type,
            String name,
            String status,
            Integer score,
            Integer percentile,
            OffsetDateTime completedAt) {
    }
}
