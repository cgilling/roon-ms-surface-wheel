var RoonApi = require("node-roon-api"),
    RoonApiStatus = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiSettings = require("node-roon-api-settings");

var my_core

var roon = new RoonApi({
    extension_id: 'com.github.cgilling.roon-ms-surface-wheel',
    display_name: "MS Surface Wheel",
    display_version: "0.0.1",
    publisher: 'Christopher Gilling',
    email: 'cgilling@gmail.com',
    website: 'https://github.com/cgilling/roon-ms-surface-wheel',
    core_paired: function (core) {
        let transport = core.services.RoonApiTransport;
        transport.get_zones((error, data) => {
            console.log(error, data)
        })
        my_core = core

        transport.subscribe_zones(function (cmd, data) {
            console.log("SUBSCRIBE ZONES!!!!", core.core_id,
                core.display_name,
                core.display_version,
                "-",
                cmd,
                JSON.stringify(data, null, '  '));
        });
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
        if (my_core) {
            my_core.services.RoonApiTransport.get_zones(
                (error, data) => {
                    let settings = mysettings
                    let zones = data.zones
                    console.log(zones)
                    cb(make_layout(settings, zones));
                }
            )
        } else {
            cb(make_layout(mysettings));
        }
    },
    save_settings: function (req, isdryrun, settings) {
        // TODO: handle if there is no my_core
        my_core.services.RoonApiTransport.get_zones(
            (error, data) => {
                let new_settings = settings.values
                let zones = error ? false : data.zones

                let l = make_layout(new_settings, zones);
                req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

                if (!isdryrun && !l.has_error) {
                    mysettings = l.values;
                    svc_settings.update_settings(l);
                    roon.save_config("settings", mysettings);
                }
            }
        )
    }
});


roon.init_services({
    required_services: [RoonApiTransport],
    provided_services: [svc_status, svc_settings],
});

svc_status.set_status("All is good", false);

/*
function process_zones(success, zones) {
    debug("%d: %s", success, zones)
}

svc_api_transport.get_zones(process_zones)
*/

roon.start_discovery();