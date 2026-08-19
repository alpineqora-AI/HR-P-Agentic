package com.taportal.domain.platform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A daily metric rollup point (Paradox analytics). */
@Entity
@Table(name = "metric_daily")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class MetricDaily {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Setter
    @Column(name = "metric_key", nullable = false)
    private String metricKey;

    @Setter
    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal value;
}
