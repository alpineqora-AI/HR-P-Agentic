package com.taportal.domain.engagement;

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

/** An employee referral (Sense). */
@Entity
@Table(name = "referral")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Referral {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "referrer_name", nullable = false)
    private String referrerName;

    @Setter
    @Column(name = "referrer_email")
    private String referrerEmail;

    @Setter
    @Column(name = "candidate_id")
    private UUID candidateId;

    @Setter
    @Column(name = "job_id")
    private UUID jobId;

    @Setter
    @Column(name = "link_code", nullable = false)
    private String linkCode;

    /** SUBMITTED | IN_REVIEW | HIRED | CLOSED */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(name = "bonus_amount", precision = 12, scale = 2)
    private BigDecimal bonusAmount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
