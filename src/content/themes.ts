import { pick, type Rng } from '../util/random'

export const THESES = [
  'AI agents will launch their own memecoins',
  'a cat becomes the next billion-dollar coin',
  'Robinhood Chain summer starts this week',
  'your grandma is buying memecoins by 2027',
  'robots replace every day trader',
  'the moon is just a giant coin',
  'frogs are the next big meta',
  'a dog CEO takes a company public',
  'the next bull run starts on a Tuesday',
  'pigeons are secretly whales',
  'toasters will mine crypto',
  'aliens are buying the dip',
  'your fridge will trade for you',
  'the next big coin is a sandwich',
  'whales are just big fish with wallets',
  'the dip is actually a trampoline',
  'every chart goes up if you draw it right',
  'memecoins will pay for your lunch',
  'a goldfish beats every hedge fund',
  'the bear market goes into hibernation',
] as const

const ADJECTIVES = ['Wobbly', 'Melancholy', 'Feral', 'Cosmic', 'Soggy', 'Grumpy', 'Electric', 'Tiny', 'Haunted', 'Glorious', 'Crunchy', 'Sleepy'] as const

const NOUNS = ['Cloud', 'Sun', 'Blob', 'Goblin', 'Toast', 'Moon', 'Frog', 'Bean', 'Comet', 'Pickle', 'Noodle', 'Ghost'] as const

export function randomTitle(rng: Rng = Math.random): string {
  return `${pick(rng, ADJECTIVES)}_${pick(rng, NOUNS)}`
}
