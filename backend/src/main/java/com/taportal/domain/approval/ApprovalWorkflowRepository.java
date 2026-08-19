package com.taportal.domain.approval;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalWorkflowRepository extends JpaRepository<ApprovalWorkflowRecord, UUID> {

    List<ApprovalWorkflowRecord> findByOrderByWfKey();

    /** Display order: newest workflows first. */
    List<ApprovalWorkflowRecord> findByOrderByCreatedAtDesc();

    Optional<ApprovalWorkflowRecord> findByWfKey(String wfKey);

    Optional<ApprovalWorkflowRecord> findFirstByTriggerTypeIgnoreCaseAndEnabledTrue(String triggerType);
}
