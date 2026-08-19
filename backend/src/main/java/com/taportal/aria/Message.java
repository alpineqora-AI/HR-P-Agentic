package com.taportal.aria;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/** A single message within a conversation. */
@Entity
@Table(name = "message")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    /** ARIA | CANDIDATE | RECRUITER | SYSTEM */
    @Setter
    @Column(nullable = false)
    private String sender;

    @Setter
    @Column(nullable = false)
    private String body;

    /** Detected intent / step tag. */
    @Setter
    @Column
    private String intent;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
