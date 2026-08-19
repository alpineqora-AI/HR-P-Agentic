package com.taportal.aria;

import com.taportal.aria.ChatDtos.ChatMessage;
import com.taportal.aria.ChatDtos.ChatState;
import com.taportal.aria.ChatDtos.StartChatRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Orchestrates Aria conversations and maps entities to chat DTOs. */
@Service
@Transactional(readOnly = true)
public class ConversationService {

    private final ConversationEngine engine;
    private final ConversationRepository conversations;
    private final MessageRepository messages;

    public ConversationService(
            ConversationEngine engine,
            ConversationRepository conversations,
            MessageRepository messages) {
        this.engine = engine;
        this.conversations = conversations;
        this.messages = messages;
    }

    @Transactional
    public ChatState start(StartChatRequest request) {
        Conversation conversation = new Conversation();
        conversation.setJobId(request.jobId());
        conversation.setChannel(defaultIfBlank(request.channel(), "WEB_CHAT"));
        conversation.setLanguage(defaultIfBlank(request.language(), "en"));
        conversation.setKind("APPLY");
        conversation.setStatus("OPEN");
        conversation = conversations.save(conversation);

        ConversationEngine.Turn turn = engine.start(conversation);
        // Reload to pick up engine-side mutations (context, status, ids).
        Conversation fresh = conversations.findById(conversation.getId()).orElseThrow();
        return toState(fresh, turn.options());
    }

    @Transactional
    public ChatState reply(UUID conversationId, String text) {
        Conversation conversation = load(conversationId);
        ConversationEngine.Turn turn = engine.reply(conversation, text);
        Conversation fresh = conversations.findById(conversationId).orElseThrow();
        return toState(fresh, turn.options());
    }

    public ChatState get(UUID conversationId) {
        Conversation conversation = load(conversationId);
        return toState(conversation, engine.optionsFor(conversation));
    }

    /** Latest conversation tied to an application (recruiter-facing transcript), or null. */
    public ChatState getByApplication(UUID applicationId) {
        return conversations.findByApplicationId(applicationId).stream()
                .max(java.util.Comparator.comparing(Conversation::getCreatedAt))
                .map(c -> toState(c, engine.optionsFor(c)))
                .orElse(null);
    }

    // ---- mapping ----

    private ChatState toState(Conversation conversation, List<String> options) {
        List<ChatMessage> transcript =
                messages.findByConversationIdOrderByCreatedAt(conversation.getId()).stream()
                        .map(this::toMessage)
                        .toList();
        return new ChatState(
                conversation.getId(),
                conversation.getStatus(),
                engine.currentStep(conversation),
                transcript,
                options,
                conversation.getApplicationId());
    }

    private ChatMessage toMessage(Message m) {
        return new ChatMessage(m.getId(), m.getSender(), m.getBody(), m.getIntent(), m.getCreatedAt());
    }

    private Conversation load(UUID id) {
        return conversations.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    private static String defaultIfBlank(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }
}
