#!/usr/bin/env ts-node

import {
  test,
}          from 'tstest'

import {
  createFixture,
}                   from 'wechaty-mocker'
import {
  mock,
}                   from 'wechaty-puppet-mock'

import {
  WechatyVorpal,
  Vorpal,
  CommandContext,
}                     from '../src/mod'

test('WechatyVorpal integration smoke testing', async t => {
  for await (const fixture of createFixture()) {
    /**
     * Install Vorpal Plugin & Ask Extension
     */
    const DING    = 'ding'
    const DONG    = 'dong'
    const COMMAND = 'dingdong'

    let ANSWER: any

    const VorpalExtension = (vorpal: Vorpal) => {
      vorpal
        .command(COMMAND)
        .action(async function action (this: CommandContext) {
          ANSWER = await this.ask(DING)
        })
    }

    const WechatyVorpalPlugin = WechatyVorpal({
      contact: true,
      use: VorpalExtension,
    })

    fixture.wechaty.wechaty.use(WechatyVorpalPlugin)

    const onPlayerMessage = (message: mock.MessageMock) => {
      const text = message.text()
      const talker = message.talker()
      if (text === DING) {
        fixture.mocker.player.say(DONG).to(talker)
      }
    }
    fixture.mocker.player.on('message', onPlayerMessage)

    fixture.mocker.player.say(COMMAND).to(fixture.mocker.bot)
    await new Promise(setImmediate)

    t.equal(ANSWER, DONG, 'should get dong as the answer of the ask command')
  }
})
