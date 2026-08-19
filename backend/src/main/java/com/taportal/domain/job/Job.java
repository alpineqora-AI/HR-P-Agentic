package com.taportal.domain.job;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** A job / requisition (ATS spine + career-site listing). */
@Entity
@Table(name = "job")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Job {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String title;

    @Setter
    @Column(nullable = false)
    private String department;

    @Setter
    @Column(nullable = false)
    private String location;

    /** ONSITE | HYBRID | REMOTE */
    @Setter
    @Column(name = "work_mode", nullable = false)
    private String workMode;

    /** FULL_TIME | PART_TIME | CONTRACT | SEASONAL */
    @Setter
    @Column(name = "employment_type", nullable = false)
    private String employmentType;

    /** HOURLY | CORPORATE | EARLY_CAREER | TECH */
    @Setter
    @Column(nullable = false)
    private String family;

    /** DRAFT | OPEN | PAUSED | FILLED | CLOSED */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(nullable = false)
    private int openings;

    @Setter
    @Column(name = "hiring_manager_id")
    private UUID hiringManagerId;

    @Setter
    @Column(name = "recruiter_id")
    private UUID recruiterId;

    @Setter
    @Column
    private String summary;

    @Setter
    @Column
    private String description;

    @Setter
    @Column(name = "pay_min", precision = 12, scale = 2)
    private BigDecimal payMin;

    @Setter
    @Column(name = "pay_max", precision = 12, scale = 2)
    private BigDecimal payMax;

    /** HOUR | YEAR */
    @Setter
    @Column(name = "pay_period")
    private String payPeriod;

    @Setter
    @Column(name = "preview_headline")
    private String previewHeadline;

    @Setter
    @Column(name = "preview_media_url")
    private String previewMediaUrl;

    @Setter
    @Column(name = "preview_day_in_life")
    private String previewDayInLife;

    @Setter
    @Column(name = "hero_image_url")
    private String heroImageUrl;

    /** comma list of supported languages */
    @Setter
    @Column
    private String languages;

    @Setter
    @Column(name = "posted_at")
    private OffsetDateTime postedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
