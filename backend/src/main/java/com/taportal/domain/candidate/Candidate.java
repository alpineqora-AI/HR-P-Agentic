package com.taportal.domain.candidate;

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

/** A candidate in the talent database. */
@Entity
@Table(name = "candidate")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(nullable = false)
    private String email;

    @Setter
    @Column
    private String phone;

    @Setter
    @Column
    private String location;

    @Setter
    @Column
    private String headline;

    @Setter
    @Column(name = "years_experience", nullable = false, precision = 4, scale = 1)
    private BigDecimal yearsExperience;

    /** CAREER_SITE | REFERRAL | SOURCED | EVENT | CAMPUS | DATABASE | AGENCY */
    @Setter
    @Column(nullable = false)
    private String source;

    @Setter
    @Column(name = "preferred_language", nullable = false)
    private String preferredLanguage;

    /** ACTIVE | PASSIVE | DORMANT */
    @Setter
    @Column(nullable = false)
    private String lifecycle;

    @Setter
    @Column(name = "last_active_at")
    private OffsetDateTime lastActiveAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
