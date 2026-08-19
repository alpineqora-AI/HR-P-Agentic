package com.taportal.config;

import java.util.UUID;

/**
 * Per-request holder of the acting user, set by {@link CurrentUserFilter} from the X-User-Id
 * header (the POC's dev "acting as"). Real SSO replaces this at delivery. Ported from the VMS
 * approval engine so the same role-gated decision logic works here.
 */
public final class CurrentUser {

    private record State(UUID id, String name, String role) {}

    private static final ThreadLocal<State> CURRENT = new ThreadLocal<>();

    private CurrentUser() {}

    public static void set(UUID id, String name, String role) {
        CURRENT.set(new State(id, name, role));
    }

    public static void clear() {
        CURRENT.remove();
    }

    public static UUID id() {
        State s = CURRENT.get();
        return s == null ? null : s.id();
    }

    public static String name() {
        State s = CURRENT.get();
        return s == null ? null : s.name();
    }

    /** ADMIN | RECRUITER | HIRING_MANAGER | COORDINATOR | VIEWER (uppercased), or null. */
    public static String role() {
        State s = CURRENT.get();
        return s == null ? null : s.role();
    }
}
