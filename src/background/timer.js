function id() {
  return '_' + Math.random().toString(36).substr(2, 9)
}

function percentage(partialValue, totalValue) {
  return ((100 * partialValue) / totalValue).toFixed(0)
}

class Timer {
  constructor(showLogs, wt, bt) {
    // session contains information about a session
    // like number of timers, state about counters
    // each timer session is a session object and is added to the session state
    // once a timer is done, the old session is removed.
    this.sessions = {}
    this.currentSession = null
    this.showLogs = showLogs || false
    this.initialWorkTimer = wt || '20:00'
    this.initialBreakTimer = bt || '05:00'
  }

  getCurrentSession() {
    return this.sessions[this.currentSession]
  }

  getAllSessions() {
    return this.sessions
  }

  start(stopIn, type = 'work_timer', onStart = () => {}) {
    const st = type
    if (this.currentSession) {
      if (this.sessions[this.currentSession]) {
        delete this.sessions[this.currentSession]
      }
    }

    onStart()

    const sessionName = 'session' + id()
    this.currentSession = sessionName

    const sessionState = {
      sessionName,
      lastActiveTimer: null,
      counter: stopIn,
      secondaryCounter: stopIn,
      initialTime: stopIn,
      stopIn: 0,
      isPaused: false,
      isStopped: false,
      isReset: false,
      status: 'idle',
      endAfterSession: false,
      sessionType: st, // work_timer | break_timer
      currentAlarmId: undefined,
      alarm_ids: [], // ALREADY TRIGGERED ALARMS
    }

    console.log('current session details -', this.getCurrentSession())
    console.log('starting timer type:', this.getCurrentSession()?.sessionType)

    // add new session to session state
    this.sessions[sessionName] = sessionState

    this.getCurrentSession().stopIn = stopIn
    if (this.getCurrentSession().status === 'idle') {
      this.createAlarm()
      this.getCurrentSession().status = 'running'
    }
  }

  createAlarm() {
    // only start the timer if the status is stopped.

    const tid = `ALARM_${Date.now()}`
    chrome.alarms.create(tid, {
      when: Date.now() + 1000,
    })

    // this.getCurrentSession().alarm_ids.push(tid);

    this.getCurrentSession().currentAlarmId = tid
    this.getCurrentSession().secondaryCounter--

    if (this.getCurrentSession().isPaused) {
      this.getCurrentSession().counter = this.getCurrentSession().counter
      this.getCurrentSession().status = 'paused'
    } else {
      this.getCurrentSession().counter--
      this.getCurrentSession().status = 'running'
    }
  }

  clearLastTimer() {
    chrome.alarms.clearAll((x) => {
      //   console.log('cleared all alarms:', x);
    })
  }

  log() {
    if (this.showLogs) {
      console.log(
        `INFO : ${this.getCurrentSession().sessionName} ${
          this.getCurrentSession().currentAlarmId
        } counter ${this.getCurrentSession().counter} | 2nd counter ${
          this.getCurrentSession().secondaryCounter
        } | Status ${this.getCurrentSession().status} | Status ${
          this.getCurrentSession().sessionType
        }`,
      )
    }
  }

  getPauseStatus() {
    return this.getCurrentSession().isPaused
  }

  pause(seconds = 0) {
    if (!seconds) {
      this.getCurrentSession().isPaused = true
    } else {
      if (this.getCurrentSession().counter === seconds) {
        this.getCurrentSession().isPaused = true
      }
    }
  }

  resume(seconds = 0) {
    if (!seconds) {
      this.getCurrentSession().isPaused = false
    } else {
      if (
        this.getCurrentSession().secondaryCounter - this.getCurrentSession().counter ===
        seconds
      ) {
        this.getCurrentSession().isPaused = false
      }
    }
  }

  stop(type = '') {
    if (type === 'forceStop') {
      const timerType = this.getCurrentSession()?.sessionType
      if (timerType === 'work_timer') {
        this.registerFocusTime()
      }

      this.onStop()
      chrome.alarms.onAlarm.removeListener(this.onAlarmFired)
    } else {
      this.getCurrentSession().isStopped = true
    }
  }

  onStop() {
    console.log(`INFO: timer stopped in ${this.getCurrentSession().counter} second(s)`)

    this.getCurrentSession().status = 'idle'
    this.getCurrentSession().isStopped = true
    this.getCurrentSession().isReset = true
    this.getCurrentSession().currentAlarmId = undefined
    this.getCurrentSession().alarm_ids = []

    this.clearLastTimer()

    // maybe put this under endAfterSession so it only resets for one sessions
    // or force cleanup
    this.resetTimer()
  }

  resetTimer() {
    this.getCurrentSession().counter = 0
    this.getCurrentSession().secondaryCounter = 0
    this.getCurrentSession().isStopped = false
    this.getCurrentSession().isReset = false
  }

  startBreakMode(breakTimerString = '05:00') {
    console.log('starting break timer...')
    this.getCurrentSession().sessionType = 'break_timer'
    const btimer = breakTimerString.split(':')
    const bmin = parseInt(btimer[0]) * 60 + parseInt(btimer[1])

    this.start(bmin + 1, 'break_timer')
  }

  startWorkMode(workTimerString = '25:00') {
    console.log('starting work timer...')
    this.getCurrentSession().sessionType = 'work_timer'
    const wtimer = workTimerString.split(':')
    const wmin = parseInt(wtimer[0]) * 60 + parseInt(wtimer[1])
    this.start(wmin + 1, 'work_timer')
  }

  onAlarmFired(alarm, onTick, callback) {
    const aids = this.getCurrentSession().alarm_ids

    // this condition is to make sure that the timer is only run once.
    // for some reason, it triggers multiple times. We do this by assigning an ID to an alarm
    // Then if there are multiple alarms with the same ID, only one of them is fired.
    if (!aids.includes(alarm.name)) {
      let timerMinutes = Math.floor(this.getCurrentSession().counter / 60)
      let timerSeconds = this.getCurrentSession().counter - timerMinutes * 60
      let timerString = `${timerMinutes}:${timerSeconds <= 9 ? `0${timerSeconds}` : timerSeconds}`

      console.log('timer -', timerString)
      this.log()

      onTick(timerString)

      const timerType = this.getCurrentSession()?.sessionType

      if (!this.getCurrentSession().isStopped) {
        if (this.getCurrentSession().counter > 0) {
          this.clearLastTimer()
          this.getCurrentSession().alarm_ids.push(alarm.name)

          this.createAlarm()
        } else {
          // stops when the timer runs out
          // if endAfterSession is set to true, end timer and switch to main screen
          // else create a new timer for break
          if (this.getCurrentSession().endAfterSession) {
            this.endAfterSession()
          } else {
            // the reason the timer starts again after its stopped is bc
            // the code after the stop function runs.
            this.onStop()
            const timerType = this.getCurrentSession()?.sessionType

            if (timerType === 'work_timer') {
              this.startBreakMode(this.initialBreakTimer)
            }

            if (timerType === 'break_timer') {
              this.startWorkMode(this.initialWorkTimer)
            }
          }
        }
      } else {
        // stops when manually stopped by changing flags
        console.log('timer manually stopped')

        this.onStop()
      }
    } else {
      console.log('not triggered')
    }
    return true
  }

  listen(onTick = () => {}, callback = () => {}) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.onAlarmFired(alarm, onTick, callback)
    })
  }
}

export default Timer
