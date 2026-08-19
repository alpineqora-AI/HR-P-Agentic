package com.taportal.domain.notification;

import com.taportal.config.CurrentUser;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * In-app notifications (the top-band bell). Producers across the app call the
 * notify/broadcast helpers; the bell polls {@link #visibleToCurrentUser()}.
 */
@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    /** Normalize any role spelling ("Hiring Manager", "hiring_manager") to the stored form. */
    public static String roleKey(String raw) {
        return raw == null ? null : raw.trim().replace(' ', '_').toUpperCase();
    }

    @Transactional
    public void notifyUser(UUID userId, String kind, String title, String body, String link) {
        repository.save(new Notification(null, userId, null, kind, title, body, link, null, null));
    }

    @Transactional
    public void notifyRole(String role, String kind, String title, String body, String link) {
        repository.save(new Notification(null, null, roleKey(role), kind, title, body, link, null, null));
    }

    @Transactional
    public void broadcast(String kind, String title, String body, String link) {
        repository.save(new Notification(null, null, null, kind, title, body, link, null, null));
    }

    public List<Notification> visibleToCurrentUser() {
        return repository.findVisible(CurrentUser.id(), CurrentUser.role(), PageRequest.of(0, 30));
    }

    @Transactional
    public void markRead(UUID id) {
        repository.findById(id).ifPresent(n -> {
            if (n.getReadAt() == null) {
                n.setReadAt(OffsetDateTime.now());
                repository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead() {
        for (Notification n : visibleToCurrentUser()) {
            if (n.getReadAt() == null) {
                n.setReadAt(OffsetDateTime.now());
                repository.save(n);
            }
        }
    }
}
