package com.taportal.domain.forms;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for FormResponse rows (Spring Data JPA; derived queries only). */
public interface FormResponseRepository extends JpaRepository<FormResponse, UUID> {

    List<FormResponse> findBySubjectTypeAndSubjectIdOrderByCreatedAt(String subjectType, UUID subjectId);
}
