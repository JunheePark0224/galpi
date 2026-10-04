const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** Final consonants per syllable block; index 8 is ㄹ. */
const FINALS = 28;
const RIEUL = 8;

/**
 * The Korean particle "(으)로" for a rod's name (toast "'{이름}'으로 옮겼어요"): 로 after a last syllable with no final
 * consonant or with ㄹ, 으로 after any other final; "(으)로" when the name does not end in Hangul (numbers, Latin, emoji).
 */
export function toParticle(name: string): "로" | "으로" | "(으)로" {
  const last = name.trim().codePointAt(name.trim().length - 1) ?? 0;
  if (last < HANGUL_FIRST || last > HANGUL_LAST) return "(으)로";
  const final = (last - HANGUL_FIRST) % FINALS;
  return final === 0 || final === RIEUL ? "로" : "으로";
}
