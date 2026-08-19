package com.taportal.api;

import java.util.List;
import java.util.UUID;

/** Talent intelligence response DTOs. */
public final class TalentDtos {

    private TalentDtos() {}

    public record Pool(UUID id, String name, String description, long memberCount) {}

    /** Create a talent pool. */
    public record CreatePoolRequest(String name, String description) {}

    /** Add a candidate to a pool. */
    public record AddPoolMemberRequest(UUID candidateId) {}

    public record MatchRow(
            UUID candidateId,
            String candidateName,
            String headline,
            int fitScore,
            String explanation,
            List<String> matchedSkills,
            List<String> gapSkills) {}

    public record SourcingRow(
            UUID candidateId,
            String candidateName,
            String headline,
            String location,
            int fitScore,
            String lifecycle,
            String source) {}

    public record MobilityRow(
            UUID employeeId,
            String employeeName,
            String currentRole,
            UUID jobId,
            String jobTitle,
            int fitScore,
            String rationale) {}
}
