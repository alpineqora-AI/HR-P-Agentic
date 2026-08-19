package com.taportal.api;

import com.taportal.api.ApplicationDtos.ApplicationRow;
import java.util.List;
import java.util.UUID;

/** Candidate response DTOs. */
public final class CandidateDtos {

    private CandidateDtos() {}

    public record CandidateSummary(
            UUID id,
            String name,
            String email,
            String location,
            String headline,
            java.math.BigDecimal yearsExperience,
            String source,
            String lifecycle,
            String preferredLanguage,
            long applicationCount,
            List<String> topSkills) {
    }

    public record CandidateSkillRef(
            String name,
            String category,
            int proficiency,
            java.math.BigDecimal years,
            boolean inferred) {
    }

    public record CandidateDetail(
            UUID id,
            String name,
            String email,
            String location,
            String headline,
            java.math.BigDecimal yearsExperience,
            String source,
            String lifecycle,
            String preferredLanguage,
            long applicationCount,
            List<String> topSkills,
            String phone,
            List<CandidateSkillRef> skills,
            List<ApplicationRow> applications) {
    }
}
