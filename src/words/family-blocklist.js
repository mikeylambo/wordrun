/**
 * GENERATED — do not edit. Source: tools/family-content-blocklist.txt
 * Regenerate with: node tools/build-family-blocklist.mjs
 *
 * General-audience framing is a hard platform-eligibility requirement, and
 * the fake generator mutates real words one edit at a time — so 'clock' can
 * reach 'cock' and 'grape' can reach 'rape' without anyone authoring it.
 * makeFake() consults these two lists in its rejection predicate, alongside
 * the real-word guard, so a blocked string is never returned as a fake.
 *
 * BLOCKED_EXACT rejects the whole string; BLOCKED_PART rejects any string
 * containing it, and is reserved for terms that cannot be innocent (the
 * Scunthorpe controls that keep that list honest live in the .txt and are
 * enforced by tools/family-gate.mjs).
 */

export const BLOCKED_EXACT = new Set([
  'anal', 'anus', 'areola', 'arse', 'arsehole', 'ass', 'asshole', 'bastard',
  'behead', 'betting', 'bitch', 'blackjack', 'bloodshed', 'blowjob',
  'bollocks', 'bomb', 'bong', 'boob', 'boobs', 'breast', 'bugger', 'bullet',
  'bullshit', 'cannabis', 'carnage', 'casino', 'cigarette', 'clitoris',
  'cocaine', 'cock', 'condom', 'copulate', 'corpse', 'crack', 'crap',
  'cunt', 'dagger', 'damn', 'decapitate', 'dick', 'dickhead', 'douche',
  'drunk', 'ecstasy', 'ejaculate', 'erection', 'erotic', 'fellatio',
  'fetish', 'firearm', 'foreplay', 'fuck', 'fucker', 'fucking', 'gamble',
  'gambling', 'genital', 'genitalia', 'goddamn', 'gore', 'grenade',
  'gunshot', 'hashish', 'heroin', 'homicide', 'horny', 'incest',
  'intercourse', 'jackass', 'junkie', 'ketamine', 'labia', 'lust',
  'machete', 'manslaughter', 'marijuana', 'massacre', 'masturbate', 'meth',
  'methamphetamine', 'molest', 'motherfucker', 'murder', 'mutilate',
  'narcotic', 'nipple', 'nude', 'nudity', 'opiate', 'opium', 'orgasm',
  'orgy', 'overdose', 'penis', 'piss', 'pissed', 'pistol', 'porn',
  'pornography', 'prick', 'prostitute', 'pubic', 'rape', 'rapist',
  'revolver', 'rifle', 'roulette', 'scrotum', 'semen', 'shit', 'shite',
  'shitty', 'shotgun', 'slaughter', 'slut', 'sperm', 'stab', 'stoned',
  'strangle', 'suicide', 'testicle', 'titty', 'torture', 'twat', 'vagina',
  'vodka', 'vulva', 'wager', 'wanker', 'whiskey', 'whore',
]);

export const BLOCKED_PART = [
  'chink', 'cocaine', 'cunt', 'dyke', 'fag', 'fuck', 'heroin', 'kike',
  'masturb', 'molest', 'nigg', 'orgasm', 'paki', 'raghead', 'retard',
  'shit', 'spast', 'suicide', 'tranny', 'wetback',
];

/** True when a candidate string may not be shown to a player. */
export function isBlocked(word) {
  if (BLOCKED_EXACT.has(word)) return true;
  for (const p of BLOCKED_PART) if (word.includes(p)) return true;
  return false;
}

export default isBlocked;
