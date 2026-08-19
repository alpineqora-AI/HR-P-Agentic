package com.taportal.domain.onboarding;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for OnboardingTask rows (Spring Data JPA; derived queries only). */
public interface OnboardingTaskRepository extends JpaRepository<OnboardingTask, UUID> {

    List<OnboardingTask> findByApplicationId(UUID applicationId);
}
