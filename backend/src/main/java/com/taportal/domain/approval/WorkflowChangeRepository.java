package com.taportal.domain.approval;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for proposed workflow changes (Spring Data JPA; derived queries only). */
public interface WorkflowChangeRepository extends JpaRepository<WorkflowChange, UUID> {

    /** The open change (draft or pending) for a workflow, if there is one. */
    Optional<WorkflowChange> findFirstByWfKeyAndStatusIn(String wfKey, Collection<String> statuses);

    List<WorkflowChange> findByStatusInOrderByUpdatedAtDesc(Collection<String> statuses);

    /** The most recent changes of any status, for the review history. */
    List<WorkflowChange> findTop50ByOrderByUpdatedAtDesc();
}
