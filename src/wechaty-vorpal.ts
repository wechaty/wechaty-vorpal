import {
  Wechaty,
  WechatyPlugin,
  Message,
  log,
}                   from 'wechaty'
import {
  matchers,
}                   from 'wechaty-plugin-contrib'
import {
  Vorpal,
}                   from './vorpal/mod'
import { VorpalIo } from './vorpal-io'

type VorpalExtensionFunction = (vorpal: Vorpal, options: any) => void
type VorpalExtension = string | VorpalExtensionFunction
type VorpalExtensions = VorpalExtension | VorpalExtension[]

export interface WechatyVorpalConfig {
  use: VorpalExtensions,

  contact? : matchers.ContactMatcherOptions,
  room?    : matchers.RoomMatcherOptions,
  mention? : boolean,
  silent?  : boolean,
}

function WechatyVorpal (config: WechatyVorpalConfig): WechatyPlugin {
  log.verbose('WechatyVorpal', 'WechatyVorpal(%s) (use will not show at here)', JSON.stringify(config))

  const matchContact = typeof config.contact === 'undefined'
    ? () => true
    : matchers.contactMatcher(config.contact)

  const matchRoom    = typeof config.room === 'undefined'
    ? () => true
    : matchers.roomMatcher(config.room)

  const vorpal = new Vorpal()

  /**
   * Remove the default `exit` command
   */
  const exit = vorpal.find('exit')
  if (exit) { exit.remove() }

  /**
   * Load all Vorpal Extensions
   */
  const extensionList = config.use
    ? Array.isArray(config.use)
      ? config.use
      : [config.use]
    : []

  extensionList.forEach(m => vorpal.use(m))
  log.verbose('WechatyVorpal', 'WechatyVorpal() %s vorpal module installed', config.use.length)

  const matchPlugin = (message: Message): boolean => {
    if (message.self())                       { return false }
    if (message.type() !== Message.Type.Text) { return false }

    return true
  }

  const matchConfig = async (message: Message): Promise<boolean> => {
    const room = message.room()
    const from = message.talker()

    if (room) {
      if (!await matchRoom(room))                 { return false }
      const mentionSelf = await message.mentionSelf()
      if (config.mention && !mentionSelf)         { return false }
    } else if (from) {
      if (!await matchContact(from))              { return false }
    } else                                        { return false }

    return true
  }

  /**
   * Connect with Wechaty
   */
  return function WechatyVorpalPlugin (wechaty: Wechaty) {
    log.verbose('WechatyVorpal', 'WechatyVorpalPlugin(%s)', wechaty)

    async function onMessage (message: Message) {
      log.verbose('WechatyVorpal', 'WechatyVorpalPlugin() onMessage(%s)', message)

      if (!await matchPlugin(message))  { return }
      if (!await matchConfig(message))  { return }

      const io = VorpalIo.from(message)
      if (io.busy())                    { return }

      const command = await message.mentionText()
      const { match } = vorpal.parseCommand(command)
      if (!match && config.silent)      { return }

      try {
        const obsio = io.open()

        const ret = await vorpal.exec(
          command,
          undefined,
          obsio,
        )

        if (ret !== 0) {
          log.error('WechatyVorpal', 'WechatyVorpalPlugin() onMessage() command<%s> exit code %s', command, ret)
        }

      } finally {
        await new Promise(setImmediate)
        io.close()
      }

    }

    wechaty.on('message', onMessage)
    return () => wechaty.off('message', onMessage)

  }
}

export { WechatyVorpal }
