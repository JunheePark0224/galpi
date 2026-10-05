/** Made-up ISBN-13s for a draw of `n` books (tests): 9790000000000, 9790000000001, … — v3 tickets sign the draw's books. */
export const isbnsOf = (n: number, from = 0): string[] => Array.from({ length: n }, (_, i) => `979000000${String(from + i).padStart(4, "0")}`);
