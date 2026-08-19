package com.taportal.aria;

import com.anthropic.client.AnthropicClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.taportal.domain.job.KnockoutQuestion;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Claude-backed {@link AnswerInterpreter}: understands natural-language replies
 * (e.g. "I'll graduate next spring" → a knockout answer, "the Tuesday one" → a
 * slot) and converts them to the canonical value the engine expects. Every
 * method falls back to {@link ScriptedInterpreter} on error, empty output, or
 * low confidence, so the deterministic funnel is never blocked.
 */
public class ClaudeInterpreter implements AnswerInterpreter {

    private static final String SYSTEM =
            "You convert a recruiting candidate's free-text reply into a single canonical value. "
                    + "Output ONLY the value — no explanation, no quotes, no extra words.";

    private static final Pattern INT = Pattern.compile("-?\\d+");

    private final AnthropicClient client;
    private final String model;
    private final ScriptedInterpreter fallback;

    public ClaudeInterpreter(AnthropicClient client, String model, ScriptedInterpreter fallback) {
        this.client = client;
        this.model = model;
        this.fallback = fallback;
    }

    private String complete(String userPrompt) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(48L)
                .system(SYSTEM)
                .addUserMessage(userPrompt)
                .build();
        Message resp = client.messages().create(params);
        return resp.content().stream()
                .flatMap(b -> b.text().stream())
                .map(t -> t.text())
                .reduce("", String::concat)
                .trim();
    }

    @Override
    public String extractField(String fieldType, String userText) {
        String type = fieldType == null ? "" : fieldType.toUpperCase();
        String what = switch (type) {
            case "NAME" -> "the person's full name";
            case "EMAIL" -> "the email address";
            case "PHONE" -> "the phone number";
            default -> null;
        };
        if (what == null) {
            return fallback.extractField(fieldType, userText);
        }
        try {
            String out = complete("Extract " + what + " from this reply: \"" + safe(userText)
                    + "\". Output only the value, or NONE if it isn't present.");
            if (out.isBlank() || out.equalsIgnoreCase("NONE")) {
                return fallback.extractField(fieldType, userText);
            }
            return out;
        } catch (RuntimeException ex) {
            return fallback.extractField(fieldType, userText);
        }
    }

    @Override
    public String normalizeAnswer(KnockoutQuestion question, String userText) {
        String type = question == null || question.getAnswerType() == null
                ? "" : question.getAnswerType().toUpperCase();
        String prompt = question == null ? "" : safe(question.getPrompt());
        try {
            switch (type) {
                case "BOOLEAN" -> {
                    String out = complete("Screening question: \"" + prompt + "\". Candidate reply: \""
                            + safe(userText) + "\". Does the reply mean yes or no? "
                            + "Output exactly 'true' for yes, 'false' for no, or 'UNSURE'.");
                    String l = out.toLowerCase();
                    if (l.contains("true")) {
                        return "true";
                    }
                    if (l.contains("false")) {
                        return "false";
                    }
                    return fallback.normalizeAnswer(question, userText);
                }
                case "CHOICE" -> {
                    String choices = question.getChoices() == null ? "" : question.getChoices();
                    if (choices.isBlank()) {
                        return fallback.normalizeAnswer(question, userText);
                    }
                    String out = complete("Options: [" + choices + "]. Candidate reply: \""
                            + safe(userText) + "\". Output exactly the one option that best matches, "
                            + "or NONE.");
                    if (out.isBlank() || out.equalsIgnoreCase("NONE")) {
                        return fallback.normalizeAnswer(question, userText);
                    }
                    // Map back to the canonical choice spelling if close.
                    for (String c : choices.split(",")) {
                        if (c.trim().equalsIgnoreCase(out.trim())) {
                            return c.trim();
                        }
                    }
                    return out;
                }
                case "NUMBER" -> {
                    String out = complete("Extract the number from this reply: \"" + safe(userText)
                            + "\". Output only the number, or NONE.");
                    Matcher m = INT.matcher(out);
                    if (m.find()) {
                        return m.group();
                    }
                    return fallback.normalizeAnswer(question, userText);
                }
                default -> {
                    return fallback.normalizeAnswer(question, userText);
                }
            }
        } catch (RuntimeException ex) {
            return fallback.normalizeAnswer(question, userText);
        }
    }

    @Override
    public int chooseSlot(List<String> slotLabels, String userText) {
        if (slotLabels == null || slotLabels.isEmpty()) {
            return 0;
        }
        try {
            StringBuilder sb = new StringBuilder("The candidate was offered these interview times:\n");
            for (int i = 0; i < slotLabels.size(); i++) {
                sb.append(i + 1).append(". ").append(slotLabels.get(i)).append("\n");
            }
            sb.append("Candidate reply: \"").append(safe(userText)).append("\". ")
                    .append("Output only the number of the time they chose, or 0 if unclear.");
            String out = complete(sb.toString());
            Matcher m = INT.matcher(out);
            if (m.find()) {
                int idx = Integer.parseInt(m.group());
                if (idx >= 1 && idx <= slotLabels.size()) {
                    return idx;
                }
                if (idx == 0) {
                    return fallback.chooseSlot(slotLabels, userText);
                }
            }
            return fallback.chooseSlot(slotLabels, userText);
        } catch (RuntimeException ex) {
            return fallback.chooseSlot(slotLabels, userText);
        }
    }

    private static String safe(String s) {
        if (s == null) {
            return "";
        }
        String t = s.replace("\n", " ").trim();
        return t.length() > 400 ? t.substring(0, 400) : t;
    }
}
