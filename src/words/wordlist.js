/**
 * DICTION DASH — standalone word-list service.
 *
 * Plain validity/difficulty-tiered word list: common, short, unambiguous words
 * at low tiers, ramping up. Deliberately built as its own module with its own
 * tests (tools/word-gates.mjs) and ZERO runtime dependencies — no runner
 * imports, no external packages — so other games can pull it in unchanged.
 * Every word is hand-curated for this game (a harvested catalog bank was
 * tried in Phase 9 and deliberately removed in Phase 11: curation beats
 * volume now that the no-repeat walk and per-attempt salt carry variety).
 *
 * Determinism contract: every function that makes a choice takes `rand`, a
 * caller-supplied () => float in [0,1). Nothing in here touches Math.random,
 * so a seeded caller always gets the same words.
 *
 * All words are lowercase a–z, no proper nouns, no hyphens or apostrophes.
 */
/**
 * Difficulty tiers, easiest first. Tier 0 is short + high-frequency; later
 * tiers get longer and lean into classically hard spellings, because a fake
 * only creates tension when the real spelling takes a beat to verify.
 */
export const TIERS = [
  // Tier 0 — short, everyday, unambiguous.
  [
    'run', 'sun', 'top', 'red', 'big', 'dog', 'cat', 'map', 'cup', 'box',
    'bed', 'hat', 'pen', 'leg', 'arm', 'sky', 'ice', 'hot', 'wet', 'dry',
    'old', 'new', 'day', 'yes', 'win', 'fun', 'sit', 'eat', 'ask', 'end',
    'egg', 'car', 'bus', 'key', 'job', 'sea', 'tea', 'six', 'ten', 'zip',
    'fox', 'owl', 'bee', 'ant', 'cow', 'pig', 'hen', 'fig', 'jam', 'pie',
    'oak', 'elm', 'fog', 'mud', 'gem', 'ink', 'kit', 'log', 'net', 'oar',
  ],
  // Tier 1 — common four/five-letter words.
  [
    'jump', 'fast', 'snow', 'tree', 'word', 'game', 'hand', 'door', 'fire',
    'wind', 'road', 'ship', 'fish', 'bird', 'milk', 'rain', 'star', 'moon',
    'time', 'gold', 'ring', 'song', 'wolf', 'bear', 'lamp', 'desk', 'wall',
    'rock', 'sand', 'wave', 'leaf', 'frog', 'king', 'coin', 'glass', 'sharp',
    'quick', 'sleep', 'bread', 'chair', 'clock', 'cloud', 'dance', 'dream',
    'green', 'happy', 'house', 'light', 'money', 'music', 'night', 'paper',
    'plant', 'river', 'smile', 'sound', 'space', 'story', 'sugar', 'table',
    'voice', 'water', 'white', 'world', 'queen', 'sword', 'tiger', 'mouse',
    'horse', 'sheep', 'snake', 'whale', 'shark', 'eagle', 'tooth', 'heart',
    'beach', 'stone', 'grass', 'storm', 'frost', 'flame', 'field', 'shore',
    'brick', 'straw', 'wheel', 'brush', 'spoon', 'knife', 'plate', 'shelf',
    'stair', 'porch', 'fence', 'crown', 'globe', 'torch', 'candy', 'peach',
    'lemon', 'apple', 'grape', 'berry', 'honey', 'toast', 'salad', 'onion',
  ],
  // Tier 2 — five/six-letter words, still common but more to scan.
  [
    'animal', 'basket', 'bottle', 'branch', 'bridge', 'bright', 'button',
    'camera', 'candle', 'castle', 'circle', 'coffee', 'copper', 'corner',
    'cousin', 'danger', 'dinner', 'doctor', 'dragon', 'engine', 'family',
    'finger', 'flower', 'forest', 'friend', 'garden', 'ground', 'guitar',
    'hammer', 'hunger', 'island', 'jacket', 'kitten', 'ladder', 'letter',
    'little', 'market', 'middle', 'minute', 'mirror', 'monkey', 'mother',
    'number', 'orange', 'pencil', 'people', 'planet', 'pocket', 'rabbit',
    'record', 'rocket', 'saddle', 'school', 'season', 'second', 'shadow',
    'silver', 'simple', 'sister', 'spider', 'spring', 'street', 'strong',
    'summer', 'sunset', 'ticket', 'tunnel', 'valley', 'window', 'winter',
    'anchor', 'barrel', 'beacon', 'border', 'breeze', 'cactus', 'canyon',
    'carpet', 'cellar', 'chapel', 'cherry', 'closet', 'cotton', 'crayon',
    'donkey', 'ember', 'fabric', 'falcon', 'feather', 'fiddle', 'flannel',
    'gallon', 'garlic', 'giant', 'ginger', 'goblin', 'harbor', 'helmet',
    'hollow', 'jungle', 'kettle', 'lantern', 'lizard', 'magnet', 'mantle',
    'marble', 'meadow', 'muffin', 'napkin', 'needle', 'nickel', 'oyster',
    'paddle', 'parrot', 'pepper', 'pillow', 'pirate', 'pistol', 'puddle',
    'puppet', 'raisin', 'ribbon', 'salmon', 'sponge', 'squash', 'temple',
    'thread', 'timber', 'turtle', 'velvet', 'violin', 'wagon', 'walnut',
    'wizard', 'yellow', 'zipper',
  ],
  // Tier 3 — longer words with spelling texture (doubles, silent letters,
  // ie/ei) where a plausible fake starts to really cost a beat.
  [
    'address', 'already', 'ancient', 'balance', 'balloon', 'because',
    'believe', 'between', 'bicycle', 'brought', 'business', 'calendar',
    'capture', 'caution', 'ceiling', 'century', 'certain', 'channel',
    'chimney', 'college', 'company', 'country', 'courage', 'curious',
    'diamond', 'distance', 'evening', 'example', 'foreign', 'fortune',
    'freedom', 'gallery', 'general', 'grammar', 'harbour', 'history',
    'journey', 'kitchen', 'library', 'machine', 'measure', 'message',
    'mineral', 'monster', 'morning', 'mystery', 'natural', 'neither',
    'october', 'opinion', 'pattern', 'picture', 'pioneer', 'problem',
    'promise', 'quarter', 'receive', 'science', 'special', 'stomach',
    'strange', 'thought', 'through', 'thunder', 'tonight', 'trouble',
    'village', 'weather', 'weight', 'whistle',
    'account', 'airport', 'anxious', 'article', 'attempt', 'autumn',
    'avenue', 'bandage', 'biscuit', 'blanket', 'blossom', 'breathe',
    'cabbage', 'cabinet', 'captain', 'caravan', 'carriage', 'cattle',
    'chamber', 'charity', 'chorus', 'climate', 'compass', 'conquer',
    'costume', 'cottage', 'crystal', 'curtain', 'cushion', 'delight',
    'descent', 'dolphin', 'drawer', 'eastern', 'echoes', 'elegant',
    'fashion', 'feature', 'fiction', 'fifteen', 'fragile', 'furnace',
    'genuine', 'glacier', 'gravity', 'harvest', 'herring', 'holiday',
    'horizon', 'hundred', 'imagine', 'instant', 'january', 'leather',
    'texture', 'theatre', 'triumph', 'vulture', 'warrior', 'weekend',
  ],
  // Tier 4 — long words and the classic traps.
  [
    'absolutely', 'accidentally', 'achievement', 'acknowledge', 'apparently',
    'appearance', 'appreciate', 'atmosphere', 'beautiful', 'beginning',
    'challenge', 'character', 'chocolate', 'committee',
    'completely', 'conscience', 'continuous', 'dangerous', 'definitely',
    'difference', 'difficulty', 'disappear', 'discipline', 'embarrass',
    'environment', 'especially', 'excellent', 'experience', 'familiar',
    'favourite', 'february', 'government', 'guarantee', 'happened',
    'immediately', 'important', 'impossible', 'incredible', 'independent',
    'interesting', 'knowledge', 'language', 'lightning', 'necessary',
    'neighbour', 'occasion', 'occurred', 'orchestra', 'parallel',
    'particular', 'personally', 'possession', 'privilege', 'pronounce',
    'quantity', 'question', 'recommend', 'restaurant', 'rhythm',
    'sandwich', 'separate', 'sincerely', 'strength', 'surprise',
    'temperature', 'tomorrow', 'vegetable', 'wednesday', 'yesterday',
    'adventure', 'ambitious', 'astonish', 'avalanche', 'boulevard',
    'breakfast', 'brilliant', 'candidate', 'celebrate', 'ceremony',
    'chandelier', 'colleague', 'community', 'conscious', 'curiosity',
    'dictionary', 'direction', 'discovery', 'education', 'emergency',
    'encourage', 'equipment', 'essential', 'exhausted', 'expensive',
    'furniture', 'gymnasium', 'hurricane', 'ignorance', 'influence',
    'invisible', 'labyrinth', 'landscape', 'magnificent', 'marvellous',
    'mountain', 'muscle', 'mysterious', 'obedient', 'obstacle',
    'peculiar', 'permanent', 'persuade', 'pneumonia', 'porcelain',
    'precious', 'president', 'psychology', 'reservoir', 'satellite',
    'scissors', 'sincere', 'souvenir', 'spaghetti', 'symphony',
    'tournament', 'twilight', 'umbrella', 'vacuum', 'wilderness',
  ],
];

/**
 * Common English words that are NOT in the shipped tiers but that a one-edit
 * mutation could accidentally form ("two" -> "tow", "form" -> "from"). A fake
 * that lands on any of these would punish a correct read, so the generator
 * rejects against VALID ∪ this guard, not VALID alone.
 */
const COMMON_GUARD = [
  'a', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is',
  'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'act', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'all', 'and', 'ant',
  'any', 'ape', 'apt', 'arc', 'are', 'art', 'ate', 'axe', 'bad', 'bag',
  'ban', 'bar', 'bat', 'bay', 'bee', 'beg', 'bet', 'bid', 'bin', 'bit',
  'boa', 'bog', 'bow', 'boy', 'bud', 'bug', 'bun', 'but', 'buy', 'cab',
  'can', 'cap', 'cod', 'cog', 'con', 'cop', 'cot', 'cow', 'coy', 'cry',
  'cub', 'cue', 'cut', 'dam', 'den', 'dew', 'did', 'die', 'dig', 'dim',
  'din', 'dip', 'doe', 'dot', 'dip', 'due', 'dug', 'dun', 'dye', 'ear',
  'eel', 'ebb', 'eke', 'elf', 'elk', 'elm', 'era', 'eve', 'eye', 'fan',
  'far', 'fat', 'fax', 'fed', 'fee', 'few', 'fig', 'fin', 'fit', 'fix',
  'flu', 'fly', 'foe', 'fog', 'for', 'fox', 'fry', 'gap', 'gas', 'gel',
  'gem', 'get', 'gig', 'gin', 'got', 'gum', 'gun', 'gut', 'guy', 'gym',
  'had', 'ham', 'has', 'hay', 'hen', 'her', 'hew', 'hey', 'hid', 'him',
  'hip', 'his', 'hit', 'hoe', 'hog', 'hop', 'how', 'hub', 'hue', 'hug',
  'hum', 'hut', 'ill', 'imp', 'ink', 'inn', 'ion', 'ire', 'irk', 'its',
  'ivy', 'jab', 'jam', 'jar', 'jaw', 'jay', 'jet', 'jig', 'jog', 'jot',
  'joy', 'jug', 'keg', 'kid', 'kin', 'kit', 'lab', 'lad', 'lag', 'lap',
  'law', 'lay', 'lea', 'led', 'lee', 'let', 'lid', 'lie', 'lip', 'lit',
  'lob', 'log', 'lot', 'low', 'mad', 'man', 'mat', 'maw', 'may', 'men',
  'met', 'mid', 'mix', 'mob', 'mop', 'mow', 'mud', 'mug', 'nab', 'nag',
  'nap', 'net', 'nub', 'net', 'nil', 'nip', 'nit', 'nod', 'nor', 'not',
  'now', 'nun', 'nut', 'oak', 'oar', 'oat', 'odd', 'ode', 'off', 'oft',
  'oil', 'one', 'opt', 'orb', 'ore', 'our', 'out', 'owe', 'owl', 'own',
  'pad', 'pal', 'pan', 'par', 'pat', 'paw', 'pay', 'pea', 'peg', 'pet',
  'pie', 'pig', 'pin', 'pit', 'ply', 'pod', 'pop', 'pot', 'pro', 'pry',
  'pub', 'pun', 'pup', 'put', 'rag', 'ram', 'ran', 'rap', 'rat', 'raw',
  'ray', 'rib', 'rid', 'rig', 'rim', 'rip', 'rob', 'rod', 'roe', 'rot',
  'row', 'rub', 'rue', 'rug', 'rum', 'rut', 'rye', 'sad', 'sag', 'sap',
  'sat', 'saw', 'say', 'set', 'sew', 'she', 'shy', 'sin', 'sip', 'sir',
  'ski', 'sly', 'sob', 'sod', 'son', 'sow', 'soy', 'spa', 'spy', 'sty',
  'sub', 'sue', 'sum', 'tab', 'tag', 'tan', 'tap', 'tar', 'tax', 'the',
  'thy', 'tie', 'tin', 'tip', 'toe', 'ton', 'too', 'tot', 'tow', 'toy',
  'try', 'tub', 'tug', 'two', 'urn', 'use', 'van', 'vat', 'vet', 'via',
  'vie', 'vow', 'wag', 'war', 'was', 'wax', 'way', 'web', 'wed', 'wee',
  'who', 'why', 'wig', 'wit', 'woe', 'won', 'woo', 'wry', 'yak', 'yam',
  'yap', 'yaw', 'yet', 'yew', 'you', 'zap', 'zoo',
  'ability', 'able', 'about', 'above', 'accept', 'across', 'action',
  'after', 'again', 'agree', 'ahead', 'alive', 'alone', 'along', 'also',
  'always', 'among', 'angle', 'anger', 'angry', 'answer', 'apple', 'area',
  'argue', 'arrow', 'aside', 'attack', 'aunt', 'autumn', 'awake', 'away',
  'back', 'ball', 'band', 'bank', 'base', 'bath', 'beach', 'bean', 'beat',
  'been', 'beer', 'bell', 'belt', 'bend', 'best', 'bird', 'bite', 'black',
  'blade', 'blame', 'blank', 'blind', 'block', 'blood', 'blow', 'blue',
  'board', 'boat', 'body', 'boil', 'bold', 'bone', 'book', 'boot', 'born',
  'boss', 'both', 'bowl', 'brain', 'brand', 'brave', 'break', 'brick',
  'bring', 'broad', 'broke', 'brown', 'brush', 'build', 'burn', 'burst',
  'busy', 'cake', 'call', 'calm', 'came', 'camp', 'card', 'care', 'cart',
  'case', 'cash', 'cast', 'cave', 'cell', 'cent', 'chain', 'chalk',
  'charm', 'chart', 'chase', 'cheap', 'check', 'cheese', 'chest', 'chief',
  'child', 'chin', 'chip', 'choice', 'city', 'claim', 'class', 'clay',
  'clean', 'clear', 'climb', 'cling', 'close', 'cloth', 'club', 'coach',
  'coal', 'coast', 'coat', 'code', 'cold', 'come', 'cook', 'cool', 'cope',
  'copy', 'cord', 'core', 'corn', 'cost', 'count', 'court', 'cover',
  'crack', 'craft', 'crash', 'cream', 'crew', 'crime', 'crop', 'cross',
  'crowd', 'crown', 'cure', 'curl', 'curve', 'dare', 'dark', 'data',
  'date', 'dawn', 'dead', 'deal', 'dear', 'debt', 'deck', 'deep', 'deer',
  'depth', 'dirt', 'dish', 'dive', 'done', 'doubt', 'down', 'dozen',
  'draft', 'drag', 'drain', 'draw', 'dress', 'drew', 'drift', 'drink',
  'drive', 'drop', 'drum', 'duck', 'dull', 'dust', 'duty', 'each',
  'early', 'earn', 'earth', 'ease', 'east', 'easy', 'edge', 'eight',
  'either', 'else', 'empty', 'enemy', 'enjoy', 'enter', 'equal', 'even',
  'event', 'ever', 'every', 'exact', 'exit', 'extra', 'face', 'fact',
  'fade', 'fail', 'fair', 'faith', 'fall', 'false', 'fame', 'farm',
  'fate', 'fault', 'fear', 'feed', 'feel', 'fell', 'felt', 'fence',
  'field', 'fifth', 'fight', 'file', 'fill', 'film', 'final', 'find',
  'fine', 'firm', 'first', 'five', 'flag', 'flame', 'flash', 'flat',
  'flesh', 'float', 'flood', 'floor', 'flow', 'fold', 'folk', 'food',
  'foot', 'force', 'fork', 'form', 'fort', 'forth', 'found', 'four',
  'frame', 'free', 'fresh', 'from', 'front', 'frost', 'fruit', 'fuel',
  'full', 'fund', 'gain', 'gate', 'gave', 'gear', 'gift', 'girl', 'give',
  'glad', 'globe', 'glory', 'glove', 'glow', 'goal', 'goat', 'gone',
  'good', 'grace', 'grade', 'grain', 'grand', 'grant', 'grass', 'grave',
  'gray', 'great', 'grew', 'grey', 'grip', 'group', 'grow', 'guard',
  'guess', 'guest', 'guide', 'hair', 'half', 'hall', 'halt', 'hang',
  'hard', 'harm', 'have', 'head', 'heal', 'heap', 'hear', 'heart', 'heat',
  'heavy', 'heel', 'held', 'hell', 'help', 'here', 'hero', 'hide', 'high',
  'hill', 'hint', 'hire', 'hold', 'hole', 'holy', 'home', 'honey', 'hook',
  'hope', 'horn', 'horse', 'host', 'hour', 'huge', 'hunt', 'hurt', 'idea',
  'inch', 'into', 'iron', 'item', 'join', 'joint', 'joke', 'judge',
  'juice', 'just', 'keen', 'keep', 'kept', 'kick', 'kill', 'kind', 'knee',
  'knew', 'knife', 'knock', 'known', 'lace', 'lack', 'lady', 'laid',
  'lake', 'land', 'lane', 'large', 'last', 'late', 'laugh', 'lawn',
  'lead', 'lean', 'leap', 'learn', 'least', 'leave', 'left', 'lend',
  'less', 'level', 'lift', 'like', 'limb', 'limit', 'line', 'link',
  'lion', 'list', 'live', 'load', 'loaf', 'loan', 'local', 'lock',
  'lodge', 'lone', 'long', 'look', 'loop', 'loose', 'lord', 'lose',
  'loss', 'lost', 'loud', 'love', 'luck', 'lunch', 'lung', 'made', 'mail',
  'main', 'make', 'male', 'many', 'march', 'mark', 'mass', 'match',
  'mate', 'math', 'meal', 'mean', 'meat', 'meet', 'melt', 'mend', 'mere',
  'mess', 'might', 'mild', 'mile', 'mill', 'mind', 'mine', 'miss', 'mist',
  'mode', 'more', 'most', 'moth', 'mount', 'mouse', 'mouth', 'move',
  'much', 'must', 'nail', 'name', 'near', 'neat', 'neck', 'need', 'nest',
  'news', 'next', 'nice', 'nine', 'noble', 'noise', 'none', 'noon',
  'north', 'nose', 'note', 'noun', 'nurse', 'obey', 'ocean', 'offer',
  'often', 'once', 'only', 'onto', 'open', 'order', 'other', 'ought',
  'ounce', 'oven', 'over', 'pace', 'pack', 'page', 'paid', 'pain',
  'paint', 'pair', 'pale', 'palm', 'pant', 'park', 'part', 'pass',
  'past', 'path', 'peace', 'peak', 'pearl', 'pick', 'piece', 'pile',
  'pine', 'pink', 'pipe', 'pitch', 'place', 'plain', 'plan', 'plate',
  'play', 'plot', 'poem', 'point', 'pole', 'pond', 'pool', 'poor',
  'port', 'pose', 'post', 'pour', 'power', 'press', 'price', 'pride',
  'prime', 'print', 'prize', 'proof', 'proud', 'prove', 'pull', 'pump',
  'pure', 'push', 'quit', 'quite', 'race', 'rack', 'rage', 'raise',
  'range', 'rank', 'rapid', 'rare', 'rate', 'reach', 'read', 'ready',
  'real', 'rear', 'rent', 'rest', 'rice', 'rich', 'ride', 'rise', 'risk',
  'roar', 'roast', 'roll', 'roof', 'room', 'root', 'rope', 'rose',
  'rough', 'round', 'route', 'royal', 'rude', 'rule', 'rush', 'rust',
  'safe', 'sail', 'sake', 'sale', 'salt', 'same', 'save', 'scale',
  'scare', 'scene', 'scope', 'score', 'seal', 'seat', 'seed', 'seek',
  'seem', 'seen', 'self', 'sell', 'send', 'sense', 'sent', 'serve',
  'seven', 'shade', 'shake', 'shall', 'shame', 'shape', 'share', 'shed',
  'sheep', 'sheet', 'shelf', 'shell', 'shift', 'shine', 'shirt', 'shock',
  'shoe', 'shook', 'shoot', 'shop', 'shore', 'short', 'shot', 'shout',
  'show', 'shut', 'sick', 'side', 'sigh', 'sight', 'sign', 'silk',
  'since', 'sing', 'sink', 'site', 'size', 'skill', 'skin', 'skirt',
  'slave', 'slid', 'slide', 'slip', 'slope', 'slow', 'small', 'smart',
  'smell', 'smoke', 'snake', 'soap', 'sock', 'soft', 'soil', 'sold',
  'sole', 'solid', 'solve', 'some', 'soon', 'sore', 'sorry', 'sort',
  'soul', 'south', 'speak', 'speed', 'spell', 'spend', 'spent', 'spin',
  'spite', 'split', 'spoke', 'sport', 'spot', 'spray', 'spread', 'stab',
  'staff', 'stage', 'stair', 'stake', 'stamp', 'stand', 'stare', 'start',
  'state', 'stay', 'steal', 'steam', 'steel', 'steep', 'steer', 'stem',
  'step', 'stick', 'stiff', 'still', 'stock', 'stole', 'stone', 'stood',
  'stop', 'store', 'storm', 'stove', 'strap', 'straw', 'strip', 'stuck',
  'study', 'stuff', 'style', 'such', 'suit', 'sure', 'sweep', 'sweet',
  'swim', 'swing', 'sword', 'take', 'tale', 'talk', 'tall', 'tank',
  'tape', 'task', 'taste', 'teach', 'team', 'tear', 'tell', 'tend',
  'tent', 'term', 'test', 'text', 'than', 'that', 'them', 'then', 'there',
  'these', 'they', 'thick', 'thin', 'thing', 'think', 'third', 'this',
  'those', 'three', 'threw', 'throw', 'thumb', 'thus', 'tide', 'tidy',
  'tight', 'till', 'tilt', 'tiny', 'tire', 'title', 'today', 'told',
  'tone', 'tool', 'tooth', 'total', 'touch', 'tough', 'tour', 'toward',
  'tower', 'town', 'trace', 'track', 'trade', 'trail', 'train', 'trap',
  'tray', 'treat', 'trend', 'trial', 'tribe', 'trick', 'trim', 'trip',
  'truck', 'true', 'trunk', 'trust', 'truth', 'tube', 'tune', 'turn',
  'twin', 'twist', 'type', 'uncle', 'under', 'union', 'unit', 'until',
  'upon', 'upper', 'urge', 'used', 'user', 'usual', 'value', 'verb',
  'verse', 'very', 'view', 'visit', 'vital', 'vote', 'wage', 'wait',
  'wake', 'walk', 'want', 'ward', 'warm', 'warn', 'wash', 'waste',
  'watch', 'wear', 'week', 'well', 'went', 'were', 'west', 'what',
  'wheat', 'wheel', 'when', 'where', 'which', 'while', 'whip', 'whole',
  'whom', 'whose', 'wide', 'wife', 'wild', 'will', 'wine', 'wing',
  'wipe', 'wire', 'wise', 'wish', 'with', 'woke', 'woman', 'wood',
  'wool', 'wore', 'work', 'worm', 'worn', 'worry', 'worse', 'worst',
  'worth', 'would', 'wound', 'wrap', 'wrist', 'write', 'wrong', 'wrote',
  'yard', 'yarn', 'year', 'yell', 'young', 'your', 'youth', 'zero',
  'zone',
];

/** Every shipped, playable word. Order: tier by tier, list order. */
export const ALL_WORDS = TIERS.flat();

/** Validity set for gameplay: the shipped tiers. */
const VALID = new Set(ALL_WORDS);

/** Rejection set for the fake generator: shipped words ∪ common guard. */
const GUARD = new Set([...ALL_WORDS, ...COMMON_GUARD]);

/**
 * The validity checker the acceptance gate names: a real (shipped) word must
 * NEVER be rejected. Case- and whitespace-forgiving so no UI plumbing can
 * manufacture a false negative.
 */
export function isValidWord(word) {
  return VALID.has(String(word ?? '').trim().toLowerCase());
}

export function tierCount() { return TIERS.length; }

/** Words available at a tier (clamped, so a too-high tier never throws). */
export function tierWords(tier) {
  const t = Math.max(0, Math.min(TIERS.length - 1, tier | 0));
  return TIERS[t];
}

/** Deterministically pick one real word from a tier. */
export function pickWord(tier, rand) {
  const words = tierWords(tier);
  return words[Math.floor(rand() * words.length) % words.length];
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/**
 * The no-repeat draw (Phase 9): the k-th word of a seeded coprime walk
 * through a tier. `rand` must be a FRESH rng seeded per (run, tier) — two
 * draws fix the walk's offset and stride — so for a given lane every k maps
 * to a distinct word until the whole tier cycles (940-2,200 words: longer
 * than any run's stay in a tier). Kills both back-to-back duplicates and
 * the birthday-problem repeats a uniform draw guarantees.
 */
export function pickWordCycle(tier, k, rand) {
  const words = tierWords(tier);
  const n = words.length;
  const offset = Math.floor(rand() * n) % n;
  let stride = 1 + (Math.floor(rand() * (n - 1)) % (n - 1));
  while (gcd(stride, n) !== 1) stride = (stride % (n - 1)) + 1;
  return words[(offset + (k % n) * stride) % n];
}

const VOWELS = 'aeiou';

/** The mutation strategies, all one honest "misread" away from the source. */
const MUTATIONS = [
  // Swap two adjacent letters: recieve.
  (w, i) => (i < w.length - 1 && w[i] !== w[i + 1]
    ? w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2) : null),
  // Double a letter: dinnner without the drama — winnter.
  (w, i) => w.slice(0, i + 1) + w[i] + w.slice(i + 1),
  // Drop a letter (never below 3 chars): begining.
  (w, i) => (w.length > 3 ? w.slice(0, i) + w.slice(i + 1) : null),
  // Substitute a vowel with a different vowel: definately.
  (w, i) => {
    const c = w[i];
    if (!VOWELS.includes(c)) return null;
    const alt = VOWELS[(VOWELS.indexOf(c) + 1 + Math.floor(i / 2)) % VOWELS.length];
    return alt === c ? null : w.slice(0, i) + alt + w.slice(i + 1);
  },
];

/**
 * Build a plausible misspelling of `word` — guaranteed to differ from the
 * source and to NOT be a recognized word (shipped list or common guard), so a
 * player who reads correctly is never punished for our generator's luck.
 *
 * Deterministic for a given (word, rand-stream). Termination is guaranteed:
 * after bounded random attempts it sweeps every mutation × position, and a
 * finite guard set cannot absorb every single-edit variant of a word.
 */
export function makeFake(word, rand) {
  const w = String(word).toLowerCase();
  const bad = (f) => !f || f === w || GUARD.has(f);

  for (let attempt = 0; attempt < 24; attempt++) {
    const m = MUTATIONS[Math.floor(rand() * MUTATIONS.length) % MUTATIONS.length];
    const i = Math.floor(rand() * w.length) % w.length;
    const f = m(w, i);
    if (!bad(f)) return f;
  }
  // Deterministic sweep — rand no longer consulted.
  for (const m of MUTATIONS) {
    for (let i = 0; i < w.length; i++) {
      const f = m(w, i);
      if (!bad(f)) return f;
    }
  }
  // Last resort: substitute each position with each letter until unrecognized.
  for (let i = w.length - 1; i >= 0; i--) {
    for (const c of 'zxqjkvw') {
      if (w[i] === c) continue;
      const f = w.slice(0, i) + c + w.slice(i + 1);
      if (!bad(f)) return f;
    }
  }
  return w + 'x'; // unreachable in practice; still not a guard word
}
