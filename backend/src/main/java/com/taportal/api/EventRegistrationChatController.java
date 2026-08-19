package com.taportal.api;

import com.taportal.aria.EventRegistrationChat;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aria's conversational event registration (the QR booth flow). Thin HTTP
 * shell over {@link EventRegistrationChat}; the api layer composes aria and
 * domain — neither calls the other directly.
 */
@RestController
public class EventRegistrationChatController {

    public record ReplyRequest(@NotBlank String text) {}

    private final EventRegistrationChat chat;

    public EventRegistrationChatController(EventRegistrationChat chat) {
        this.chat = chat;
    }

    /** Scan the QR, open the chat: greeting + first question. */
    @PostMapping("/v1/aria/events/{eventId}/registration-chat")
    public EventRegistrationChat.Turn start(@PathVariable UUID eventId) {
        return chat.start(eventId);
    }

    /** One student reply; the form's rules pick the next question. */
    @PostMapping("/v1/aria/registration-chat/{conversationId}")
    public EventRegistrationChat.Turn reply(
            @PathVariable UUID conversationId,
            @jakarta.validation.Valid @RequestBody ReplyRequest request) {
        return chat.reply(conversationId, request.text());
    }
}
