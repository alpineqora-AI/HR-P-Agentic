package com.taportal.domain.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for MetricDaily rows (Spring Data JPA; derived queries only). */
public interface MetricDailyRepository extends JpaRepository<MetricDaily, UUID> {

    List<MetricDaily> findByMetricKeyOrderByMetricDate(String metricKey);
}
