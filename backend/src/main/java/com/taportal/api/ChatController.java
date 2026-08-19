package com.taportal.api;

import com.taportal.aria.ChatDtos.ChatState;
import com.taportal.aria.ChatDtos.ReplyRequest;
import com.taportal.aria.ChatDtos.StartChatRequest;
import com.taportal.aria.ConversationService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The candidate-facing Aria chat endpoints (scripted, LLM-ready engine). */
@RestController
@RequestMapping("/v1/chat")
public class ChatController {

    private final ConversationService conversationService;

    public ChatController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping("/start")
    public ChatState start(@RequestBody StartChatRequest request) {
        return conversationService.start(request);
    }

    @PostMapping("/{conversationId}/reply")
    public ChatState reply(@PathVariable UUID conversationId, @RequestBody ReplyRequest request) {
        return conversationService.reply(conversationId, request.text());
    }

    @GetMapping("/{conversationId}")
    public ChatState get(@PathVariable UUID conversationId) {
        return conversationService.get(conversationId);
    }

    /** Recruiter-facing: the Aria transcript for an application (null if none). */
    @GetMapping("/by-application/{applicationId}")
    public ChatState byApplication(@PathVariable UUID applicationId) {
        return conversationService.getByApplication(applicationId);
    }
}
