package com.taportal.aria;

import com.taportal.domain.job.KnockoutQuestion;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Offline, heuristic {@link AnswerInterpreter}. Preserves the engine's original
 * literal parsing: profile fields are taken as-typed, knockout answers are
 * passed through (the rule evaluator normalizes booleans/numbers itself), and a
 * slot is matched by leading number or exact label.
 */
public class ScriptedInterpreter implements AnswerInterpreter {

    private static final Pattern DIGITS = Pattern.compile("\\d+");

    @Override
    public String extractField(String fieldType, String userText) {
        return userText == null ? "" : userText.trim();
    }

    @Override
    public String normalizeAnswer(KnockoutQuestion question, String userText) {
        return userText == null ? "" : userText.trim();
    }

    @Override
    public int chooseSlot(List<String> slotLabels, String userText) {
        if (slotLabels == null || slotLabels.isEmpty() || userText == null) {
            return 0;
        }
        String trimmed = userText.trim();
        Matcher m = DIGITS.matcher(trimmed);
        if (m.find()) {
            int idx = Integer.parseInt(m.group());
            if (idx >= 1 && idx <= slotLabels.size()) {
                return idx;
            }
        }
        for (int i = 0; i < slotLabels.size(); i++) {
            if (slotLabels.get(i).equalsIgnoreCase(trimmed)) {
                return i + 1;
            }
        }
        return 0;
    }
}
