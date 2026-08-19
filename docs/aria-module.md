# ADR: Aria is a separated conversational agentic layer

**Status:** accepted (2026-07-19) · **Decider:** product owner

## Decision

Aria — the candidate-facing conversational assistant — lives in its own module,
`com.taportal.aria`, separated from the recruiting domain and from the API layer.
It was extracted from `com.taportal.domain.conversation` (and `api/ChatDtos`) with
no behavior change.

The long-term intent is that Aria can be lifted out of this codebase entirely and
run as a standalone service fronting both the career site and the recruiter
portal. The career site itself will also be split into its own codebase later;
it will then embed Aria the same way any other surface does.

## Rules (enforced by convention, checked at review)

1. **Aria owns only the conversation.** Threads/`Conversation`, `Message`,
   the engine, the brains, the interpreters, and the chat DTOs. No recruiting
   business logic lives in `aria`.
2. **Dependencies point one way: `aria → domain`.** Aria may read/write domain
   objects (jobs, candidates, applications, interviews) to do its job. The
   `domain` packages must NEVER import `com.taportal.aria`. If a domain event
   should produce a chat message, a controller/webhook in `api` composes the
   two — the domain does not call Aria.
3. **`api` depends on `aria`, never the reverse.** `ChatController` is the only
   API entry point; the chat DTOs (`com.taportal.aria.ChatDtos`) belong to Aria,
   not to the API layer.
4. **The brain sits behind a seam.** `AssistantBrain` / `AnswerInterpreter`
   interfaces with scripted implementations (offline, deterministic, no key
   needed) and Claude implementations selected by `AriaConfig` when
   `app.aria.enabled=true` and `ANTHROPIC_API_KEY` is present. New intelligence
   goes behind these interfaces — callers never know which brain is active.
5. **Channel policy:** WhatsApp is not allowed (client compliance). Web chat and
   SMS only.

## Quick checks

```sh
# Nothing outside aria/ may import aria except the api layer:
grep -rl "com\.taportal\.aria" --include='*.java' src/main/java/com/taportal/domain && echo VIOLATION

# aria must not import the api layer:
grep -rn "import com\.taportal\.api" src/main/java/com/taportal/aria && echo VIOLATION
```

## Map

| Concern | Where |
| --- | --- |
| Conversation entities + repos | `aria/Conversation`, `aria/Message` |
| Flow state machine | `aria/ConversationEngine` |
| Copy generation (scripted / Claude) | `aria/ScriptedBrain`, `aria/ClaudeBrain` behind `aria/AssistantBrain` |
| Free-text understanding | `aria/ScriptedInterpreter`, `aria/ClaudeInterpreter` behind `aria/AnswerInterpreter` |
| Brain selection | `aria/AriaConfig` (`app.aria.enabled`, `app.aria.model`, `app.aria.nlu-model`) |
| Public API | `api/ChatController` → `/v1/chat/**`, DTOs in `aria/ChatDtos` |
