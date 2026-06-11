/**
 * Generation engine (Phase 4+).
 *
 * This module is intentionally kept separate from the UI. It will hold the
 * prompt-template engine that combines a project's country, brand style, and
 * trip configuration into copy-paste prompts (Mode 1) and, later, direct LLM
 * calls (Mode 2 / Phase 12).
 *
 * Keeping templates out of components from day one avoids refactoring the
 * shell when generation lands.
 */

export {};
