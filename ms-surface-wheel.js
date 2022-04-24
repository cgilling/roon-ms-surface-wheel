var fs = require('fs'),
    InputManager = require('./input-manager');

const devicesFilePath = '/proc/bus/input/devices'

function MSSurfaceWheel(config) {
    this.errorOccurred = config.errorOccurred
    this.configureSuccess = config.configureSuccess
    this.turnedClockwise = config.turnedClockwise
    this.turnedCounterClockwise = config.turnedCounterClockwise
    this.buttonPressed = config.buttonPressed
    this.inputManager = undefined

    this.wheelEvent = undefined
    this.wheelEventValue = undefined

    fs.readFile(devicesFilePath, 'utf8', (err, data) => this.onDeviceFileRead(err, data))
}

MSSurfaceWheel.prototype.onDeviceFileRead = function (err, data) {
    if (err) {
        this.errorOccurred('error listing input devicess: ' + err)
        setTimeout(function (self) {
            fs.readFile(devicesFilePath, 'utf8', (err, data) => self.onDeviceFileRead(err, data))
        },
            5000, this);
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
        5000, this);
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
        console.log("MSSurfaceWheel event processed", this.wheelEvent, this.wheelEventValue)
        // TODO: call a function to handle this
        this.wheelEvent = undefined
        this.wheelEventValue = undefined
    } else {
        this.wheelEvent = event
        this.wheelEventValue = inputEvent.value
    }

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