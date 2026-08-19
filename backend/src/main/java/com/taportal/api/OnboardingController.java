package com.taportal.api;

import com.taportal.api.OnboardingDtos.OnboardingTaskResponse;
import com.taportal.domain.onboarding.OnboardingService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/onboarding")
/**
 * Onboarding task endpoints: per-hire checklists and completion tracking.
 */
public class OnboardingController {

    private final OnboardingService onboardingService;

    public OnboardingController(OnboardingService onboardingService) {
        this.onboardingService = onboardingService;
    }

    @GetMapping
    public List<OnboardingTaskResponse> list(@RequestParam UUID applicationId) {
        return onboardingService.listByApplication(applicationId);
    }
}
