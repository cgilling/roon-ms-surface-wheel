var RoonApi = require("node-roon-api"),
    RoonApiStatus = require("node-roon-api-status"),
    RoonApiTransport = require("node-roon-api-transport"),
    RoonApiSettings = require("node-roon-api-settings");

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
        transport.get_zones((error, data) => {
            console.log(error, data)
        })
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
        }
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