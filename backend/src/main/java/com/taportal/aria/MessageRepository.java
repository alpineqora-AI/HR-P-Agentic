package com.taportal.aria;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Message rows (Spring Data JPA; derived queries only). */
public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByConversationIdOrderByCreatedAt(UUID conversationId);

    boolean existsByConversationIdAndIntent(UUID conversationId, String intent);
}
