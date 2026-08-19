package com.taportal.domain.onboarding;

import com.taportal.api.OnboardingDtos.OnboardingTaskResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
/**
 * Onboarding domain service: checklist generation and task completion for new hires.
 */
public class OnboardingService {

    private final OnboardingTaskRepository repository;

    public OnboardingService(OnboardingTaskRepository repository) {
        this.repository = repository;
    }

    public List<OnboardingTaskResponse> listByApplication(UUID applicationId) {
        return repository.findByApplicationId(applicationId).stream().map(OnboardingService::toResponse).toList();
    }

    static OnboardingTaskResponse toResponse(OnboardingTask t) {
        return new OnboardingTaskResponse(
                t.getId(),
                t.getApplicationId(),
                t.getName(),
                t.getCategory(),
                t.getStatus(),
                t.getDueDate());
    }
}
