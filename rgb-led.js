var pigpioClient = require('pigpio-client');

function RGBLED(config) {
    if ('inverted' in config) {
        this.inverted = config.inverted
    } else {
        this.inverted = false
    }
    this.redPin = config.redPin
    this.greenPin = config.greenPin
    this.bluePin = config.bluePin
    this.pigpio = new pigpioClient.pigpio({ host: 'localhost' })
    this.pigpio.on('connected', (err, payload) => this.connected())
    this.pigpio.on('disconnected', (err, payload) => this.disconnected(err, payload))
    this.pigpio.on('error', (err, payload) => this.error(err, payload))

    /*
    this.redLED = new Gpio(config.redPin, Gpio.OUTPUT)
    this.greenLED = new Gpio(config.greenPin, Gpio.OUTPUT)
    this.blueLED = new Gpio(config.bluePin, Gpio.OUTPUT)

    this.redLED.pwmFrequency(1600)
    this.greenLED.pwmFrequency(1600)
    this.blueLED.pwmFrequency(1600)
    */
}

RGBLED.prototype.connected = function () {
    if (!this.redLED) {
        this.redLED = this.pigpio.gpio(this.redPin)
        // TODO: figure out what to do about callback???
        this.redLED.modeSet('output')
        this.redLED.setPWMfrequency(1600)
    }
    if (!this.greenLED) {
        this.greenLED = this.pigpio.gpio(this.greenPin)
        // TODO: figure out what to do about callback???
        this.greenLED.modeSet('output')
        this.greenLED.setPWMfrequency(1600)
    }
    if (!this.blueLED) {
        this.blueLED = this.pigpio.gpio(this.bluePin)
        // TODO: figure out what to do about callback???
        this.blueLED.modeSet('output')
        this.blueLED.setPWMfrequency(1600)
    }
}

RGBLED.prototype.disconnected = function (err, payload) {
    console.log("rgb-leg disconnected", err)
    this.pigpio.connect()
}

RGBLED.prototype.error = function (err, payload) {
    console.log("rgb-leg error", err)
}

RGBLED.prototype.setColor = function (r, g, b, cb) {
    if (!cb) {
        cb = (err) => { if (err) { console.log('error writing to led', err) } }
    }
    var promises = []
    if (this.redLED) {
        promises.push(this.redLED.analogWrite(Math.floor(r)))
    }
    if (this.greenLED) {
        promises.push(this.greenLED.analogWrite(Math.floor(g)))
    }
    if (this.blueLED) {
        promises.push(this.blueLED.analogWrite(Math.floor(b)))
    }
    Promise.all(promises).then(
        () => { cb() },
        (err) => { cb(err) }
    )
}

exports = module.exports = RGBLED
