package com.taportal.domain.approval;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * A live approval request: a real event (requisition, extension, …) submitted through a
 * configured workflow. The engine decides at submit time whether it auto-approves or which
 * approval steps it must clear; approvers then advance it step by step.
 */
@Entity
@Table(name = "approval_requests")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ApprovalRequest {

    public enum Status { PENDING, APPROVED, REJECTED, AUTO_APPROVED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Workflow key this request routed through ("w1".."w4"). */
    @Column(name = "wf_key", nullable = false, length = 40)
    private String wfKey;

    @Column(name = "item_type", nullable = false, length = 40)
    private String itemType;

    /** Reference of the underlying item (requisition code, worker name, …). */
    @Column(name = "item_ref", nullable = false)
    private String itemRef;

    @Column(nullable = false)
    private String title;

    @Column
    private String sub;

    @Setter
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    /** JSON list of the approval steps the engine required (label + role). */
    @Column(name = "required_json", nullable = false, columnDefinition = "text")
    private String requiredJson;

    /** Steps already cleared; request approves when this reaches the required count. */
    @Setter
    @Column(name = "current_step", nullable = false)
    private int currentStep;

    @Setter
    @Column(name = "decided_by")
    private String decidedBy;

    @Setter
    @Column(name = "decided_at")
    private OffsetDateTime decidedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
