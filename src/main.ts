import './styles/index.css'
import { loadLive } from './game/live'
import { anchorTarget, currentRoute, routeKey, type Route } from './router'
import { cta, footer } from './sections/footer'
import { header } from './sections/header'
import { faq } from './sections/faq'
import { finalPage } from './sections/finalpage'
import { how } from './sections/how'
import { judge } from './sections/judge'
import { landing } from './sections/landing'
import { payout } from './sections/payout'
import { recent } from './sections/recent'
import { roundPage } from './sections/roundpage'
import { rounds } from './sections/rounds'
import { studio } from './sections/studio'
import { suggest } from './sections/suggest'
import { hall, winnersPage } from './sections/winners'
import { h } from './ui/dom'

function view(route: Route): HTMLElement {
  switch (route.name) {
    case 'draw':
      return studio()
    case 'rounds':
      return rounds()
    case 'winners':
      return winnersPage()
    case 'round':
      return roundPage(route.number)
    case 'final':
      return finalPage(route.number)
    case 'home':
      return h('div', { class: 'home' }, landing(), payout(), how(), judge(), hall(), recent(), h('div', { class: 'home-pair' }, faq(), suggest()), cta())
  }
}

const cache = new Map<string, HTMLElement>()
const main = h('main')
let shown: string | null = null

function render(): void {
  const route = currentRoute()
  const key = routeKey(route)
  if (key === shown) return
  const page = cache.get(key) ?? view(route)
  cache.set(key, page)
  main.replaceChildren(page)
  shown = key
  document.body.dataset.route = route.name
  const target = anchorTarget()
  if (target) target.scrollIntoView({ behavior: 'instant' })
  else window.scrollTo({ top: 0, behavior: 'instant' })
}

const app = document.querySelector<HTMLDivElement>('#app')

if (app) {
  loadLive().then(() => {
    app.append(header(), main, footer())
    render()
    window.addEventListener('hashchange', render)
  })
}
