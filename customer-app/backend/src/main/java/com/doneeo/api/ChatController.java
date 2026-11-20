package com.doneeo.api;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api")
public class ChatController {
    private final CustomerConversations conversations;

    public ChatController(CustomerConversations conversations) {
        this.conversations = conversations;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "mode", "github-planner",
                "plannerCommit", "03925c28ca7c0d7580ea04cb93a51ea741d8e0d8");
    }

    @GetMapping("/chat/latest")
    public JsonNode latest(Authentication authentication) {
        return conversations.latest(authentication.getName());
    }

    @PostMapping("/chat")
    public JsonNode chat(Authentication authentication,
                         @RequestBody CustomerConversations.ChatInput input) {
        return conversations.reply(authentication.getName(), input);
    }
}
