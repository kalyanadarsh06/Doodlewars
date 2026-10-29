import { pick, type Rng } from '../util/random'

export const PROMPTS = [
  'a whale wearing sunglasses',
  'a frog in a business suit',
  'a cat DJ',
  'grandma on a skateboard',
  'a toaster with a mustache',
  'a goldfish in a tiny suit',
  'a pigeon wearing a gold chain',
  'a shark wearing a tie',
  'a penguin with a briefcase',
  'a duck wearing a crown',
  'a turtle with a jetpack',
  'a llama in a party hat',
  'a crab playing guitar',
  'a dinosaur on a tricycle',
  'a snail racing a car',
  'a cow floating in space',
  'a pizza flying through space',
  'a sandwich running away',
  'the moon eating a cookie',
  'a ghost walking a dog',
  'a robot watering flowers',
  'an octopus juggling',
  'a hamster lifting weights',
  'a monkey flying a spaceship',
  'a dragon roasting marshmallows',
  'a parrot with an eyepatch',
  'a cat wearing a VR headset',
  'a dog driving a bus',
  'a bear eating a giant donut',
  'a giraffe stuck in a tiny car',
  'a sloth on a rollercoaster',
  'a fridge with legs',
  'a cactus giving a hug',
  'a skeleton at the beach',
  'an alien ordering fast food',
  'a fish riding a bicycle',
  'a volcano sneezing',
  'a cloud raining spaghetti',
  'a hot dog in a sleeping bag',
  'a chicken in a raincoat',
] as const

const SUBJECTS = ['a raccoon', 'a grumpy cactus', 'a tiny wizard', 'a penguin', 'grandpa', 'a haunted teapot', 'a confused robot', 'a snail', 'a nervous banana', 'a cat'] as const

const TWISTS = ['running for mayor', 'at the gym', 'on its first day of school', 'stuck in traffic', 'doing karaoke', 'in a thunderstorm', 'opening a bakery', 'on vacation', 'learning to skate', 'at a job interview'] as const

export function randomIdea(rng: Rng = Math.random): string {
  return `${pick(rng, SUBJECTS)} ${pick(rng, TWISTS)}`
}
