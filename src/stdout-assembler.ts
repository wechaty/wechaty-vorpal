import cuid         from 'cuid'
import Vorpal, {
  Args,
  CommandInstance,
}                   from 'vorpal'
import {
  Message,
  UrlLink,
  Contact,
  FileBox,
}                   from 'wechaty'

import stripAnsi    from 'strip-ansi'

import {
  log,
}                 from './config'

const stdoutStore: {
  [id: string]: string[][],
} = {}

function StdoutAssembler () {
  log.verbose('WechatyVorpal', 'StdoutAssembler()')

  return function StdoutAssemblerExtension (vorpal: Vorpal) {
    log.verbose('WechatyVorpal', 'StdoutAssemblerExtension()')

    async function wechatyVorpalStdoutAssembler (
      this: CommandInstance,
      args: Args,
    ) {
      if (!args || !args.stdin) { return }

      const stdin = args.stdin      as string[]
      const id    = args.options.id as string

      if (!(id in stdoutStore)) {
        stdoutStore[id] = []
      }

      stdoutStore[id].push(stdin)
    }

    vorpal
      .command('wechatyVorpalStdoutAssembler', 'pipe stdout to our store with id')
      .hidden()
      .option('-i --id <id>', 'distinct id for this output')
      .action(wechatyVorpalStdoutAssembler)
  }
}

type CommandReturnedMessage     = FileBox | UrlLink | Contact | string
type CommandReturnedFunction    = (message: Message) => void | CommandReturnedMessage | CommandReturnedMessage[]
type CommandReturnedType        = CommandReturnedMessage | CommandReturnedFunction
export type CommandReturnedTypes = CommandReturnedType | CommandReturnedType[]

interface SimpleExecResult {
  stdout: string,
  ret: CommandReturnedTypes,
}

async function simpleExec (
  vorpal: Vorpal,
  command: string
): Promise<SimpleExecResult> {
  log.verbose('WechatyVorpal', 'simpleExec(vorpal, "%s")', command)

  const id = cuid()

  const appendPipe = ' | wechatyVorpalStdoutAssembler --id ' + id
  const ret = await vorpal.exec(command + appendPipe) as CommandReturnedTypes

  const textListList = stdoutStore[id] || []
  delete stdoutStore[id]

  const stdout = textListList
    .map(textList => textList.join(''))
    .join('\n')

  return {
    ret,
    stdout: stripAnsi(stdout),
  }
}

export {
  StdoutAssembler,
  simpleExec,
}
