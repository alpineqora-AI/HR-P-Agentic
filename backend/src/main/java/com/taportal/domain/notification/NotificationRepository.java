package com.taportal.domain.notification;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** Everything visible to a user: their own, their role's, and broadcasts. */
    @Query("""
            select n from Notification n
            where n.recipientUserId = :uid
               or n.recipientRole = :role
               or (n.recipientUserId is null and n.recipientRole is null)
            order by n.createdAt desc
            """)
    List<Notification> findVisible(@Param("uid") UUID uid, @Param("role") String role, Pageable page);
}
