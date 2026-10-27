import './styles/index.css'
import { anchorTarget, currentRoute, routeKey, type Route } from './router'
import { cta, footer } from './sections/footer'
import { header } from './sections/header'
import { faq } from './sections/faq'
import { how } from './sections/how'
import { judge } from './sections/judge'
import { landing } from './sections/landing'
import { recent } from './sections/recent'
import { roundPage } from './sections/roundpage'
import { rounds } from './sections/rounds'
import { studio } from './sections/studio'
import { suggest } from './sections/suggest'
import { h } from './ui/dom'
import { discoverWallets } from './wallet/wallet'

function view(route: Route): HTMLElement {
  switch (route.name) {
    case 'draw':
      return studio()
    case 'rounds':
      return rounds()
    case 'round':
      return roundPage(route.number)
    case 'home':
      return h('div', { class: 'home' }, landing(), how(), judge(), recent(), suggest(), faq(), cta())
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
  discoverWallets()
  app.append(header(), main, footer())
  render()
  window.addEventListener('hashchange', render)
}
