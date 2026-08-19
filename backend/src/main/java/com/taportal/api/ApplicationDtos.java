package com.taportal.api;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Application / pipeline request and response DTOs. */
public final class ApplicationDtos {

    private ApplicationDtos() {}

    public record ApplicationRow(
            UUID id,
            UUID candidateId,
            String candidateName,
            UUID jobId,
            String jobTitle,
            String stage,
            String source,
            Integer fitScore,
            Boolean knockoutPassed,
            OffsetDateTime appliedAt,
            OffsetDateTime updatedAt) {
    }

    public record PipelineColumn(String stage, long count, List<ApplicationRow> cards) {}

    public record UpdateApplicationRequest(String stage, Integer fitScore, String rejectionReason) {}
}
