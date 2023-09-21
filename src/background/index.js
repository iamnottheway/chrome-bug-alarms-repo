console.info('chrome-ext template-vanilla-js background script')

import Timer from './timer'

// args - showLogs, Work Timer, Break Timer
const t = new Timer(true, '20:00', '05:00')

/**
 *
 * t.start - initializes timer
 * t.listen - starts the timer
 * t.stop - stops the timer
 * t.pause - pause the timer
 * t.resume - resume the timer
 *
 * how this timer works
 * ------------------------
 *
 * This timer functions as a regular timer but it's not quite similar to a regular timer where the timer
 * stops when the counter reaches zero. Here, when the counter reaches zero it starts another timer and it
 * does that forever.
 *
 * This timer is for a pomodoro timer
 *
 *
 */

// converts timer string to seconds
const timeString = '00:10'
const wtimer = timeString.split(':')
const wmin = parseInt(wtimer[0]) * 60 + parseInt(wtimer[1])

t.start(wmin + 1)
t.listen()
