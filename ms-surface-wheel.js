var fs = require('fs'),
    InputManager = require('./input-manager');

const devicesFilePath = '/proc/bus/input/devices'

function MSSurfaceWheel(config) {
    this.errorOccurred = config.errorOccurred
    this.configureSuccess = config.configureSuccess
    this.turned = config.turned
    this.buttonUp = config.buttonUp
    this.buttonDown = config.buttonDown
    this.inputManager = undefined

    this.turnStepsPerClick = 50

    this.wheelEvent = undefined
    this.wheelEventValue = undefined

    this.isButtonDown = false

    this.currentEvent = undefined
    this.currentEventTurnValueTotal = 0
    this.currentEventTurnClicksProcessed = 0

    fs.readFile(devicesFilePath, 'utf8', (err, data) => this.onDeviceFileRead(err, data))
}

MSSurfaceWheel.prototype.onDeviceFileRead = function (err, data) {
    if (err) {
        this.errorOccurred('error listing input devices: ' + err)
        setTimeout(function (self) {
            fs.readFile(devicesFilePath, 'utf8', (err, data) => self.onDeviceFileRead(err, data))
        },
            500, this);
        return
    }
    parts = data.split("\n\n")
    for (const part of parts) {
        if (part.indexOf('Name="Surface Dial System Multi Axis"') == -1) {
            continue
        }
        const handlersPrefix = 'H: Handlers='
        let index = part.indexOf(handlersPrefix)
        if (index === -1) {
            console.log("failed to find handler line for ms wheel part")
            continue
        }
        this.dev = part.substr(index + handlersPrefix.length).split('\n')[0].trim()
        this.inputManager = new InputManager({
            dev: this.dev,
            eventReceived: event => this.eventReceived(event),
            errorOccurred: err => this.eventErrorOccurred(err)
        })
        this.configureSuccess()
        return
    }
    this.errorOccurred('could not find Surface Wheel device')
    setTimeout(function (self) {
        fs.readFile(devicesFilePath, 'utf8', (err, data) => self.onDeviceFileRead(err, data))
    },
        500, this);
}

const EV_TURN = 'TURN',
    EV_BUTTON_ACTIVATED = "BUTTON_ACTIVATED",
    // value === 1: button down,  value === 0: button up
    EV_BUTTON_PRESS = "BUTTON_PRESS",
    EV_END = 'END'

const eventDefinitions = [
    {
        type: 2,
        code: 7,
        event: EV_TURN
    },
    {
        type: 4,
        code: 4,
        event: EV_BUTTON_ACTIVATED
    },
    {
        type: 1,
        code: 256,
        event: EV_BUTTON_PRESS
    },
    {
        type: 0,
        code: 0,
        event: EV_END
    }
]

MSSurfaceWheel.prototype.eventReceived = function (inputEvent) {
    var event = undefined
    for (const d of eventDefinitions) {
        if (inputEvent.type === d.type && inputEvent.code == d.code) {
            event = d.event
            break
        }
    }
    if (event == EV_END) {
        //console.log("MSSurfaceWheel event processed", this.wheelEvent, this.wheelEventValue)
        this.processWheelEvent(this.wheelEvent, this.wheelEventValue)
        this.wheelEvent = undefined
        this.wheelEventValue = undefined
    } else {
        this.wheelEvent = event
        this.wheelEventValue = inputEvent.value
    }
}

MSSurfaceWheel.prototype.processWheelEvent = function (event, value) {
    if (event === EV_TURN) {
        if (this.currentEvent !== EV_TURN) {
            this.currentEventTurnClicksProcessed = 0
            this.currentEventTurnValueTotal = 0
        }
        // we reset stuff if the wheel start spinning in the opposite direction
        if (this.currentEventTurnValueTotal < 0 && value > 0 ||
            this.currentEventTurnValueTotal > 0 && value < 0) {
            this.currentEventTurnClicksProcessed = 0
            this.currentEventTurnValueTotal = 0
        }

        this.currentEventTurnValueTotal += value
        let desiredClicks = Math.trunc(this.currentEventTurnValueTotal / this.turnStepsPerClick)
        if (desiredClicks != this.currentEventTurnClicksProcessed) {
            let newClicks = desiredClicks - this.currentEventTurnClicksProcessed
            this.turned(newClicks)
            this.currentEventTurnClicksProcessed = desiredClicks
        }
    }
    if (event == EV_BUTTON_PRESS) {
        if (value == 1) {
            this.isButtonDown = true
            if (this.buttonDown) {
                this.buttonDown()
            }
        }
        if (value == 0) {
            this.isButtonDown = false
            if (this.buttonUp) {
                this.buttonUp()
            }
        }
    }
    this.currentEvent = event
}

MSSurfaceWheel.prototype.eventErrorOccurred = function (err) {
    console.log("MSSurfaceWheel.eventErrorOccurred", err)
    // in the event that we encounter an error we want to re-initialize the input
    this.inputManager = undefined
    this.errorOccurred(err)
    var self = this
    fs.readFile(devicesFilePath, 'utf8', (err, data) => self.onDeviceFileRead(err, data))
}

exports = module.exports = MSSurfaceWheel