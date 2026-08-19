package com.taportal.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Engagement (CRM/referrals/events/surveys) response DTOs. */
public final class EngagementDtos {

    private EngagementDtos() {}

    public record Campaign(
            UUID id,
            String name,
            String audience,
            String channel,
            String status,
            int sent,
            int opened,
            int replied,
            double openRate,
            double replyRate) {}

    public record Referral(
            UUID id,
            String referrerName,
            String candidateName,
            String jobTitle,
            String status,
            BigDecimal bonusAmount,
            OffsetDateTime createdAt) {}

    public record EventRow(
            UUID id,
            String name,
            String type,
            String location,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            String timezone,
            /** Latest approval status for this event (PENDING/APPROVED/…), null if never routed. */
            String approvalStatus,
            int registrations,
            int attended,
            int hires) {}

    /** Create payload for a new recruiting event. */
    public record EventCreate(
            String name,
            String type,
            String location,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            String timezone,
            UUID intakeFormId,
            /** Route this event down the workflow's flagged/exception path. */
            Boolean flaggedCritical) {}

    public record SurveyRow(
            UUID id,
            String name,
            String stage,
            int sent,
            int responses,
            BigDecimal avgSentiment,
            Integer nps,
            double responseRate) {}
}
