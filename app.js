var express = require('express'),
    RoonApi = require("node-roon-api"),
    RoonApiStatus = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiSettings = require("node-roon-api-settings"),
    ClickManager = require('./click-manager'),
    InputManager = require('./input-manager'),
    MSSurfaceWheel = require('./ms-surface-wheel'),
    gpio = require('rpi-gpio');

var argv = require('minimist')(process.argv.slice(2));
function is_production() {
    return argv.hasOwnProperty('production') && argv['production'] === 'true'
}
function enable_led_gpio() {
    return argv.hasOwnProperty('enable-led-gpio') && argv['enable-led-gpio'] === 'true'
}

var my_core
var current_zones

function subscribe_zones(cmd, data) {
    var changed = false
    if (cmd === 'Subscribed') {
        current_zones = Object.fromEntries(data.zones.map(z => ([z.zone_id, z])))
        changed = true
    }
    if (cmd === 'Changed') {
        if (data.hasOwnProperty('zones_removed')) {
            for (const zone_id of data.zones_removed) {
                if (current_zones.hasOwnProperty(zone_id)) {
                    delete current_zones[zone_id]
                    changed = true
                }
            }
        }
        if (data.hasOwnProperty('zones_added')) {
            current_zones = {
                ...current_zones,
                ...Object.fromEntries(data.zones_added.map(z => ([z.zone_id, z])))
            }
            changed = true
        }
    }
    if (changed) {
        console.log("Current Zones Updated", Object.values(current_zones).map(z => ({ zone_id: z.zone_id, name: z.display_name })))
    }
}

var roon = new RoonApi({
    extension_id: 'com.github.cgilling.roon-ms-surface-wheel',
    display_name: "MS Surface Wheel",
    display_version: "0.0.1",
    publisher: 'Christopher Gilling',
    email: 'cgilling@gmail.com',
    website: 'https://github.com/cgilling/roon-ms-surface-wheel',
    core_paired: function (core) {
        let transport = core.services.RoonApiTransport;
        my_core = core

        transport.subscribe_zones(subscribe_zones);
    },

    core_unpaired: function (core) {
        console.log(core.core_id,
            core.display_name,
            core.display_version,
            "-",
            "LOST");
    }
});

var mysettings = roon.load_config("settings") || {
    zone_id: "",
};

function make_layout(settings, zones) {
    var l = {
        values: settings,
        layout: [],
        has_error: false
    };

    if (zones) {
        l.layout.push({
            type: "dropdown",
            title: "Control Zone",
            values: zones.map(z => ({ title: z.display_name, value: z.zone_id })),
            setting: "zone_id",
        });
    } else {
        l.has_error = true
    }

    return l
}


var svc_status = new RoonApiStatus(roon);
var svc_settings = new RoonApiSettings(roon, {
    get_settings: function (cb) {
        cb(make_layout(mysettings, Object.values(current_zones)));
    },
    save_settings: function (req, isdryrun, settings) {
        let new_settings = settings.values
        let l = make_layout(new_settings, Object.values(current_zones));
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            mysettings = l.values;
            svc_settings.update_settings(l);
            roon.save_config("settings", mysettings);
            svc_status.set_status("All is good", false);
        }
    }
});

if (is_production()) {
    roon.log_level = 'none'
}


roon.init_services({
    required_services: [RoonApiTransport],
    provided_services: [svc_status, svc_settings],
});

svc_status.set_status("Starting up", false);

roon.start_discovery();

// returns false if everything is fine, error string otherwise
function zone_check() {
    if (!my_core) {
        return "no core"
    }

    if (!(mysettings.zone_id in current_zones)) {
        svc_status.set_status("invalid zone selected", true)
        return "invalid zone selected: " + mysettings.zone_id
    }
}

function volume_change_step(relative_step) {
    err = zone_check()
    if (err) {
        return err
    }

    for (const output of current_zones[mysettings.zone_id].outputs) {
        my_core.services.RoonApiTransport.change_volume(output, 'relative_step', relative_step, (error => {
            if (error) {
                console.log("volume up failed for output", output.output_id, error)
            }
        }))
    }
}

function play_pause() {
    err = zone_check()
    if (err) {
        return err
    }
    my_core.services.RoonApiTransport.control(mysettings.zone_id, 'playpause')
}

function next_track() {
    err = zone_check()
    if (err) {
        return err
    }
    my_core.services.RoonApiTransport.control(mysettings.zone_id, 'next')
}

function previous_track() {
    err = zone_check()
    if (err) {
        return err
    }
    my_core.services.RoonApiTransport.control(mysettings.zone_id, 'previous')
}

clickManager = new ClickManager({
    doubleClickTimeout: 2000,
    clickCallback: () => { console.log('single click') },
    doubleClickCallback: () => { console.log('double click') }

})

msSurfaceWheel = new MSSurfaceWheel({
    errorOccurred: err => {
        console.log("MSSurfaceWheel errorOccured", err)
        svc_status.set_status("Problems connecting to Surface Wheel", true);
    },
    configureSuccess: function () {
        console.log("MSSurfaceWheel configureSuccess")
        svc_status.set_status("Connected to Surface Wheel", false);
    },
    turnedClockwise: amount => {
        console.log("MSSurfaceWheel turnedClockwise", amount)
    },
    turnedCounterClockwise: amount => {
        console.log("MSSurfaceWheel turnedCounterClockwise", amount)
    },
    buttonPressed: () => {
        console.log("MSSurfaceWheel buttonPressed")
    }
})

/* NOTE: this is a proof of concept of trying to controll the onboard
 *       LEDs as a status indicator. I could get the power led to work,
 *       but couldn't figure out how to get the activity one to work
 *
 *       Tried adding the following to /boot/config.txt:
 *           dtparam=act_led_trigger=gpio
 *           dtparam=pwr_led_trigger=gpio
 *           dtparam=act-led,gpio=21
 *           dtparam=act_led_gpio=21
 *           dtparam=pwr_led_gpio=26 
 */
if (enable_led_gpio()) {
    gpio.setMode(gpio.MODE_BCM)
    gpio.setup(26, gpio.DIR_HIGH, err => {
        console.log("gpio.setup", err)
        gpio.write(26, false, err => {
            console.log("gpio.write", err)
        })
    })
}


const app = express()
const port = 3000

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.get('/volume-up', (req, res) => {
    err = volume_change_step(1)
    if (err) {
        res.send(err)
        return
    }
    res.send('Volume Up Initiated')
})

app.get('/volume-down', (req, res) => {
    err = volume_change_step(-1)
    if (err) {
        res.send(err)
        return
    }
    res.send('Volume Down Initiated')
})

app.get('/play-pause', (req, res) => {
    err = play_pause()
    if (err) {
        res.send(err)
        return
    }
    res.send('Play/Pause Initiated')
})

app.get('/next-track', (req, res) => {
    err = next_track()
    if (err) {
        res.send(err)
        return
    }
    res.send('Next Track Initiated')
})

app.get('/previous-track', (req, res) => {
    err = previous_track()
    if (err) {
        res.send(err)
        return
    }
    res.send('Previous Track Initiated')
})

app.get('/click', (req, res) => {
    clickManager.processClick()
    res.send('Click Initiated')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})