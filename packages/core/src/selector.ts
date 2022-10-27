import { defineProperty } from 'cosmokit'
import { Context } from '.'
import { Session } from './session'

export type Filter = (session: Session) => boolean

/* eslint-disable max-len */
declare module '.' {
  interface Context {
    selector: Selector
    filter: Filter
    any(): this
    never(): this
    union(arg: Filter | this): this
    intersect(arg: Filter | this): this
    exclude(arg: Filter | this): this
    user(...values: string[]): this
    self(...values: string[]): this
    guild(...values: string[]): this
    channel(...values: string[]): this
    platform(...values: string[]): this
    private(...values: string[]): this
  }
}
/* eslint-enable max-len */

function property<K extends keyof Session>(ctx: Context, key: K, ...values: Session[K][]) {
  return ctx.intersect((session: Session) => {
    return values.length ? values.includes(session[key]) : !!session[key]
  })
}

export class Selector {
  static readonly methods = [
    'any', 'never', 'union', 'intersect', 'exclude',
    'user', 'self', 'guild', 'channel', 'platform', 'private',
  ]

  constructor(private app: Context) {
    defineProperty(this, Context.current, app)

    app.filter = () => true
    app.on('internal/runtime', (runtime) => {
      if (!runtime.uid) return
      runtime.ctx.filter = (session) => {
        return runtime.children.some(p => p.ctx.filter(session))
      }
    })
  }

  protected get caller() {
    return this[Context.current] as Context
  }

  any() {
    return this.caller.extend({ filter: () => true })
  }

  never() {
    return this.caller.extend({ filter: () => false })
  }

  union(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) || filter(s) })
  }

  intersect(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && filter(s) })
  }

  exclude(arg: Filter | Context) {
    const caller = this.caller
    const filter = typeof arg === 'function' ? arg : arg.filter
    return this.caller.extend({ filter: s => caller.filter(s) && !filter(s) })
  }

  user(...values: string[]) {
    return property(this.caller, 'userId', ...values)
  }

  self(...values: string[]) {
    return property(this.caller, 'selfId', ...values)
  }

  guild(...values: string[]) {
    return property(this.caller, 'guildId', ...values)
  }

  channel(...values: string[]) {
    return property(this.caller, 'channelId', ...values)
  }

  platform(...values: string[]) {
    return property(this.caller, 'platform', ...values)
  }

  private(...values: string[]) {
    return property(this.caller.exclude(property(this.caller, 'guildId')), 'userId', ...values)
  }
}
