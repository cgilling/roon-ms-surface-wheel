
/**
 * Adapted From https://github.com/risacher/input-event/blob/master/lib/input-event.js
 * Read Linux Inputs in node.js
 * Author: Daniel Risacher (dan@risacher.org)
 *
 * Adapted from keyboard.js by...
 * Author: William Petit (william.petit@lookingfora.name)
 *
 * Adapted from Tim Caswell's nice solution to read a linux joystick
 * http://nodebits.org/linux-joystick
 * https://github.com/nodebits/linux-joystick
 */

var fs = require('fs')

function InputManager(config) {
    //    this.wrap('onOpen');
    var self = this;
    this.wrap('onRead');
    this.wrap('tryOpen');
    this.dev = config.dev;
    this.eventReceived = config.eventReceived
    this.errorOccurred = config.errorOccurred
    this.bufferSize = 24;
    this.buf = new Buffer.alloc(this.bufferSize);
    fs.open('/dev/input/' + this.dev, 'r', function (err, fd) { self.onOpen(err, fd) });
}


InputManager.prototype.wrap = function (name) {
    var self = this;
    var fn = this[name];
    this[name] = function (err) {
        if (err) return self.errorOccurred(err);
        return fn.apply(self, Array.prototype.slice.call(arguments, 1));
    };
};

InputManager.prototype.onOpen = function (err, fd) {
    var self = this;
    if (err) {
        setTimeout(function (s) {
            fs.open('/dev/input/' + s.dev, 'r',
                function (err, fd) { s.onOpen(err, fd) })
        },
            5000, self);
    } else {
        this.fd = fd;
        this.startRead();
    }
};

InputManager.prototype.startRead = function () {
    fs.read(this.fd, this.buf, 0, this.bufferSize, null, this.onRead);
};

InputManager.prototype.onRead = function (bytesRead) {
    var event = parse(this, this.buf);
    if (event) {
        event.dev = this.dev;
        this.eventReceived(event)
    }
    if (this.fd) this.startRead();
};

InputManager.prototype.close = function (callback) {
    fs.close(this.fd, (function () { console.log(this); }));
    this.fd = undefined;
};


/**
 * Parse Input data
 */

function parse(input, buffer) {

    var event, value;
    var evtype = buffer.readUInt16LE(8)
    //    console.log(buffer.toString('hex'), " ", buffer.length);
    if (process.arch === 'x64') {
        event = {
            timeS: buffer.readUInt64LE(0),
            timeMS: buffer.readUInt64LE(8),
            type: buffer.readUInt16LE(16),
            code: buffer.readUInt16LE(18),
            value: buffer.readInt32LE(20)
        };
    } else { // arm or ia32
        event = {
            timeS: buffer.readUInt32LE(0),
            timeMS: buffer.readUInt32LE(4),
            type: buffer.readUInt16LE(8),
            code: buffer.readUInt16LE(10),
            value: buffer.readInt32LE(12)
        };
    }

    return event;
};

exports = module.exports = InputManager