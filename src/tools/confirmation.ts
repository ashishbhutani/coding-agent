/**
 * Confirmation System
 *
 * Human-in-the-loop approval for dangerous operations.
 * Tools call requestConfirmation() — the CLI registers a handler
 * that prompts the user. In tests, a mock handler is used.
 *
 * Default behavior (no handler registered): DENY all requests.
 */

/**
 * A function that presents a confirmation prompt to the user
 * and returns true (approved) or false (denied).
 */
export type ConfirmationHandler = (prompt: string) => boolean;

/** The active handler. Defaults to deny-all for safety. */
let handler: ConfirmationHandler = () => false;

/**
 * Register a confirmation handler (called once by the CLI at startup).
 */
export function setConfirmationHandler(fn: ConfirmationHandler): void {
    handler = fn;
}

/**
 * Reset to the default deny-all handler (used in tests).
 */
export function resetConfirmationHandler(): void {
    handler = () => false;
}

/**
 * Request user confirmation for a dangerous operation.
 *
 * @param prompt — Description shown to the user (what the agent wants to do)
 * @returns true if the user approves, false if denied
 */
export function requestConfirmation(prompt: string): boolean {
    return handler(prompt);
}
