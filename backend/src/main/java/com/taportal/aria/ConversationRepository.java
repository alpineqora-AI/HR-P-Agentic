package com.taportal.aria;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Conversation rows (Spring Data JPA; derived queries only). */
public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    List<Conversation> findByCandidateId(UUID candidateId);

    List<Conversation> findByApplicationId(UUID applicationId);
}
