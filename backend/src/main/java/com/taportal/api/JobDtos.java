package com.taportal.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Job request/response DTOs. */
public final class JobDtos {

    private JobDtos() {}

    public record JobSummary(
            UUID id,
            String title,
            String department,
            String location,
            String workMode,
            String employmentType,
            String family,
            String status,
            int openings,
            BigDecimal payMin,
            BigDecimal payMax,
            String payPeriod,
            long applicants,
            OffsetDateTime postedAt,
            String summary) {
    }

    public record SkillRef(UUID id, String name, String category, BigDecimal weight, boolean required) {}

    public record Knockout(
            UUID id,
            int ordinal,
            String prompt,
            String answerType,
            List<String> choices,
            boolean required) {
    }

    public record Preview(String headline, String mediaUrl, String dayInLife) {}

    public record JobDetail(
            UUID id,
            String title,
            String department,
            String location,
            String workMode,
            String employmentType,
            String family,
            String status,
            int openings,
            BigDecimal payMin,
            BigDecimal payMax,
            String payPeriod,
            long applicants,
            OffsetDateTime postedAt,
            String summary,
            String description,
            String hiringManager,
            String recruiter,
            List<SkillRef> skills,
            List<Knockout> knockoutQuestions,
            Preview preview,
            List<String> languages,
            Map<String, Long> stageCounts) {
    }

    public record CreateJobRequest(
            String title,
            String department,
            String location,
            String workMode,
            String employmentType,
            String family,
            String status,
            Integer openings,
            UUID hiringManagerId,
            UUID recruiterId,
            String summary,
            String description,
            BigDecimal payMin,
            BigDecimal payMax,
            String payPeriod,
            String previewHeadline,
            String previewMediaUrl,
            String previewDayInLife,
            String heroImageUrl,
            String languages) {
    }

    public record UpdateJobRequest(
            String title,
            String department,
            String location,
            String workMode,
            String employmentType,
            String family,
            String status,
            Integer openings,
            UUID hiringManagerId,
            UUID recruiterId,
            String summary,
            String description,
            BigDecimal payMin,
            BigDecimal payMax,
            String payPeriod,
            String previewHeadline,
            String previewMediaUrl,
            String previewDayInLife,
            String heroImageUrl,
            String languages) {
    }
}
