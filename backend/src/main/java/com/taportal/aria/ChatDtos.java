package com.taportal.aria;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Aria chat request/response DTOs (the conversational apply experience). */
public final class ChatDtos {

    private ChatDtos() {}

    public record ChatMessage(
            UUID id,
            String sender,
            String body,
            String intent,
            OffsetDateTime createdAt) {
    }

    public record ChatState(
            UUID conversationId,
            String status,
            String step,
            List<ChatMessage> messages,
            List<String> options,
            UUID applicationId) {
    }

    public record StartChatRequest(UUID jobId, String channel, String language) {}

    public record ReplyRequest(String text) {}
}
