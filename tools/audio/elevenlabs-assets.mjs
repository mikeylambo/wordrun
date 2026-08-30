/**
 * Generation spec for the authored SFX set.
 *
 * Phase 15 rewrote every prompt. The file ids were re-pointed to this
 * game's world phases ago (corruption_*, interference_*), but the prompts
 * underneath still described an alpine downhill game with a mountain
 * creature — so regenerating from this spec would have quietly
 * reintroduced ski Foley into a word runner. The ids are unchanged (the
 * manifest and the mix depend on them); only what they mean is now
 * correct: a runner of light on a manuscript track, chased by the Redline.
 */

export const SFX_ASSETS = [
  {
    id: 'page_grain_bed', duration: 14, loop: true, influence: 0.48,
    prompt: 'Seamless quiet paper-room ambience, fine dry paper fibre hiss, distant pages settling in a still archive, soft air over open books, no voices, no music, no footsteps, clean game ambience, natural stereo field.'
  },
  {
    id: 'page_turn_loop', duration: 8, loop: true, influence: 0.58,
    prompt: 'Seamless steady rhythm of paper pages turning and sliding past each other at pace, dry crisp sheet rustle, no voice, no music, no footsteps, isolated game Foley.'
  },
  {
    id: 'ink_bloom_loop', duration: 8, loop: true, influence: 0.58,
    prompt: 'Seamless low soft wet-ink bloom spreading through thick paper, muffled dark resonant swell, slow breathing texture, no voice, no music, isolated game ambience.'
  },
  {
    id: 'carve_hard', duration: 1.8, loop: false, influence: 0.62,
    prompt: 'One fast sweeping stroke of a pen drawn hard across heavy paper, dry fibrous rasp with a bright leading edge, single confident gesture, close clean game Foley, no voice, no music.'
  },
  {
    id: 'takeoff_big_air', duration: 1.6, loop: false, influence: 0.56,
    prompt: 'A sheet of paper snatched into fast motion, sharp fibrous rasp opening into a rising airy whoosh, light and weightless, stylized game Foley, no voice, no music.'
  },
  {
    id: 'landing_clean', duration: 1.8, loop: false, influence: 0.62,
    prompt: 'A thick stack of paper landing squarely on a desk, deep satisfying compressed thump with a soft fibrous tail, clean and precise, no voice, no music.'
  },
  {
    id: 'landing_heavy', duration: 2.2, loop: false, influence: 0.62,
    prompt: 'A heavy book dropped flat and hard, dense low impact, pages splaying and settling, short rough recovery rustle, no voice, no music.'
  },
  {
    id: 'tumble_paper', duration: 2.8, loop: false, influence: 0.58,
    prompt: 'Loose pages scattering and tumbling across a hard floor, layered light impacts and dry sheet flutter, playful arcade tone, no voice, no music.'
  },
  {
    id: 'tree_hit', duration: 1.5, loop: false, influence: 0.67,
    prompt: 'A hard strike into a dense stack of bound paper, woody spine knock, sheets shocked loose, short bright fibrous scrape, no voice, no music, isolated game impact.'
  },
  {
    id: 'rock_hit', duration: 1.5, loop: false, influence: 0.67,
    prompt: 'A blunt impact into a heavy desk edge, dense wooden knock with a short dry rattle, punchy and brief, no voice, no music, isolated game Foley.'
  },
  {
    id: 'beast_main_distant', duration: 4.5, loop: false, influence: 0.52,
    prompt: 'Distant low mechanical proofreading pass sweeping across an empty archive, deep resonant hum with tape-like drag and faint paper displacement, impersonal and inevitable, no human speech, no music.'
  },
  {
    id: 'beast_main_step', duration: 1.2, loop: false, influence: 0.68,
    prompt: 'Single heavy rubber stamp slammed onto a document, low body-weight thump with a short paper compression and faint metal ring, no voice, no music, isolated game Foley.'
  },
  {
    id: 'beast_main_leap', duration: 2.1, loop: false, influence: 0.58,
    prompt: 'A long red stroke accelerating across a page in one lunge, explosive fibrous attack into a heavy rushing whoosh, brief pressurized exertion, no human voice, no music.'
  },
  {
    id: 'frost_beast_enter', duration: 3.0, loop: false, influence: 0.58,
    prompt: 'A sudden burst of brittle static and torn paper as a second correction mark cuts into the page, glassy digital crackle over dry fibre, strange and uncanny, no human voice, no music.'
  },
  {
    id: 'frost_beast_charge', duration: 3.2, loop: false, influence: 0.62,
    prompt: 'A sharp correction mark driving diagonally across a document at speed, rapid fibrous impacts, rushing air, brittle glassy rattle and interference crackle, no human voice, no music.'
  },
  {
    id: 'frost_beast_vault', duration: 2.8, loop: false, influence: 0.60,
    prompt: 'A glassy insertion mark vaulting over a line of text, explosive brittle takeoff, rising resonant whoosh, crystalline ring, firm paper landing tail, no voice, no music.'
  },
  {
    id: 'frost_beast_kill', duration: 2.4, loop: false, influence: 0.60,
    prompt: 'Final redaction climax for an arcade word game, heavy stamp impact, sharp brittle crack and a low collapsing hum, dramatic but not gory, no human scream, no music.'
  },
  {
    id: 'go_rush', duration: 3.0, loop: true, influence: 0.54,
    prompt: 'Seamless stylized high-speed acceleration rush, compressed air opening into a bright aerodynamic whoosh with a subtle paper-flutter shimmer, energetic game boost texture, no engine, no voice, no music.'
  }
];

export default SFX_ASSETS;
