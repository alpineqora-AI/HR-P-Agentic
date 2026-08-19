package com.taportal.aria;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires Aria's brain + interpreter. When {@code app.aria.enabled} is true AND an
 * {@code ANTHROPIC_API_KEY} is present in the environment, Aria is LLM-powered
 * (Claude copy + free-text understanding). Otherwise it runs fully offline on
 * the scripted implementations — so the funnel works with no key and never
 * depends on a network call to complete.
 */
@Configuration
public class AriaConfig {

    private static final Logger log = LoggerFactory.getLogger(AriaConfig.class);

    @Bean
    public AssistantBrain assistantBrain(
            @Value("${app.aria.enabled:true}") boolean enabled,
            @Value("${app.aria.model:claude-opus-4-8}") String model) {
        ScriptedBrain scripted = new ScriptedBrain();
        if (enabled && hasKey()) {
            log.info("Aria copy: Claude-powered (model={})", model);
            return new ClaudeBrain(client(), model, scripted);
        }
        log.info("Aria copy: scripted (ai-enabled={}, key-present={})", enabled, hasKey());
        return scripted;
    }

    @Bean
    public AnswerInterpreter answerInterpreter(
            @Value("${app.aria.enabled:true}") boolean enabled,
            @Value("${app.aria.nlu-model:claude-opus-4-8}") String nluModel) {
        ScriptedInterpreter scripted = new ScriptedInterpreter();
        if (enabled && hasKey()) {
            log.info("Aria understanding: Claude-powered (model={})", nluModel);
            return new ClaudeInterpreter(client(), nluModel, scripted);
        }
        return scripted;
    }

    private static boolean hasKey() {
        String k = System.getenv("ANTHROPIC_API_KEY");
        return k != null && !k.isBlank();
    }

    /** A fresh client per bean; both read ANTHROPIC_API_KEY from the environment. */
    private static AnthropicClient client() {
        return AnthropicOkHttpClient.fromEnv();
    }
}
