package com.taportal.domain.approval;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, UUID> {

    List<ApprovalRequest> findByOrderByCreatedAtDesc();

    List<ApprovalRequest> findByStatusOrderByCreatedAtDesc(ApprovalRequest.Status status);

    List<ApprovalRequest> findByItemTypeOrderByCreatedAtDesc(String itemType);

    long countByWfKeyAndStatus(String wfKey, ApprovalRequest.Status status);
}
