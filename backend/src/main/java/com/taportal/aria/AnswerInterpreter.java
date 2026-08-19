package com.taportal.aria;

import com.taportal.domain.job.KnockoutQuestion;
import java.util.List;

/**
 * Turns a candidate's free-text reply into the canonical value the deterministic
 * {@link ConversationEngine} expects. The engine still owns every decision
 * (knockout pass/fail, slot booking, candidate creation) — the interpreter only
 * understands the input. Two implementations: {@link ScriptedInterpreter}
 * (regex/heuristic, offline) and {@link ClaudeInterpreter} (LLM-backed, with
 * scripted fallback). Wired by {@link AriaConfig}.
 */
public interface AnswerInterpreter {

    /** Extract a profile field ({@code NAME}, {@code EMAIL}, {@code PHONE}) from free text. */
    String extractField(String fieldType, String userText);

    /**
     * Normalize a knockout answer into the canonical form the rule evaluator
     * expects (BOOLEAN → "true"/"false"; CHOICE → one of the choices; NUMBER →
     * a number string; otherwise the cleaned text).
     */
    String normalizeAnswer(KnockoutQuestion question, String userText);

    /**
     * Resolve which offered interview slot the candidate picked.
     *
     * @return a 1-based index into {@code slotLabels}, or 0 if none matched.
     */
    int chooseSlot(List<String> slotLabels, String userText);
}
