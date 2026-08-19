package com.taportal.domain.interview;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One interviewer on an interview's panel. */
@Entity
@Table(name = "interview_panelists")
@IdClass(InterviewPanelist.Key.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class InterviewPanelist {

    @Id
    @Column(name = "interview_id")
    private UUID interviewId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    public static class Key implements Serializable {
        private UUID interviewId;
        private UUID userId;

        public Key() {}

        public Key(UUID interviewId, UUID userId) {
            this.interviewId = interviewId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(interviewId, k.interviewId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(interviewId, userId);
        }
    }
}
