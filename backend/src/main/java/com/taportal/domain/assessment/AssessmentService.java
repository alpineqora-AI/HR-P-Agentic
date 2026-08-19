package com.taportal.domain.assessment;

import com.taportal.api.AssessmentDtos.AssessmentResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
/**
 * Assessment domain service: assignment and scoring of candidate assessments.
 */
public class AssessmentService {

    private final AssessmentRepository repository;

    public AssessmentService(AssessmentRepository repository) {
        this.repository = repository;
    }

    public List<AssessmentResponse> listByApplication(UUID applicationId) {
        return repository.findByApplicationId(applicationId).stream().map(AssessmentService::toResponse).toList();
    }

    static AssessmentResponse toResponse(Assessment a) {
        return new AssessmentResponse(
                a.getId(),
                a.getApplicationId(),
                a.getType(),
                a.getName(),
                a.getStatus(),
                a.getScore(),
                a.getPercentile(),
                a.getCompletedAt());
    }
}
