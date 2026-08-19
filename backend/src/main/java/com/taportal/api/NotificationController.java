package com.taportal.api;

import com.taportal.domain.notification.Notification;
import com.taportal.domain.notification.NotificationService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/notifications")
public class NotificationController {

    public record NotificationRow(
            UUID id, String kind, String title, String body, String link,
            boolean read, OffsetDateTime createdAt) {}

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<NotificationRow> rows = service.visibleToCurrentUser().stream()
                .map((n) -> new NotificationRow(
                        n.getId(), n.getKind(), n.getTitle(), n.getBody(), n.getLink(),
                        n.getReadAt() != null, n.getCreatedAt()))
                .toList();
        long unread = rows.stream().filter((r) -> !r.read()).count();
        return Map.of("items", rows, "unread", unread);
    }

    @PostMapping("/{id}/read")
    public void markRead(@PathVariable UUID id) {
        service.markRead(id);
    }

    @PostMapping("/read-all")
    public void markAllRead() {
        service.markAllRead();
    }
}
