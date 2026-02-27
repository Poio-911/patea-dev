/**
 * Utilerías para el manejo de IA
 */

/**
 * Envuelve una promesa con un timeout.
 * Útil para evitar que las acciones de servidor cuelguen por IA lenta o caída.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 25_000): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`AI timeout after ${ms}ms`));
        }, ms);
    });

    return Promise.race([
        promise,
        timeoutPromise
    ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
}
