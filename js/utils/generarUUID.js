export function generarUUID() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    if (
        window.crypto &&
        typeof window.crypto.getRandomValues === "function"
    ) {

        const bytes = new Uint8Array(16);

        window.crypto.getRandomValues(bytes);

        bytes[6] =
            (bytes[6] & 0x0f) | 0x40;

        bytes[8] =
            (bytes[8] & 0x3f) | 0x80;

        const hex =
            Array
                .from(bytes)
                .map(
                    byte =>
                        byte
                            .toString(16)
                            .padStart(2, "0")
                )
                .join("");

        return (
            hex.substring(0, 8) +
            "-" +
            hex.substring(8, 12) +
            "-" +
            hex.substring(12, 16) +
            "-" +
            hex.substring(16, 20) +
            "-" +
            hex.substring(20, 32)
        );
    }

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 12)
    );
}