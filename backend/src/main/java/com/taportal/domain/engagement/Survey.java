package com.taportal.domain.engagement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A candidate-experience survey (Sense sentiment). */
@Entity
@Table(name = "survey")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Survey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    /** APPLICATION | INTERVIEW | OFFER | ONBOARDING | CANDIDATE_NPS */
    @Setter
    @Column(nullable = false)
    private String stage;

    @Setter
    @Column(nullable = false)
    private int sent;

    @Setter
    @Column(nullable = false)
    private int responses;

    @Setter
    @Column(name = "avg_sentiment", precision = 4, scale = 2)
    private BigDecimal avgSentiment;

    @Setter
    @Column
    private Integer nps;
}
