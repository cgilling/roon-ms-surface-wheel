# TODO: rename project to roon-ms-surface-dial

Dumb me got the name wrong, I'll have some internal renaming of classes
to do as well.

### Newbie Note

When it comes to node.js, I have very little experience, this was hacked together as a fun project for myself and not much time was spent to discover what exactly the proper way to doing a lot of stuff is. At work I am primarily a Go developer, so if some of the code reminds you of Go, now you know why :)

### Basic Controls

Currently there is no way to configure things to be different through settings:
- single click => play/pause
- counter clockwise rotate => lower volume
- clockwise rotate => increase volume
- hold down press + counter clockwise rotate => previous track (max 1 per 0.5 seconds)
- hold down press + clockwise rotate => nex track (max 1 per 0.5 seconds)

### Installing/Running

This project was built with the idea of running it on a raspberry pi. So the instructions that follow assume that. They should be easy
enough to modify for whatever system you wish to run on.

#### Install System Components
Some places online suggest a newer version of nodejs, this one worked for me and was the easier to do.
```shell
sudo apt update
sudo apt install nodejs npm
sudo npm install pm2 -g
```

#### Setup pm2 to run on startup
`pm2` is used to manage our nodejs processes, so we want to make sure that it gets started up whenever the system boots up.

```shell
> pm2 startup
  [PM2] Init System found: systemd
  [PM2] To setup the Startup Script, copy/paste the following command:
  sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
> sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi
  ...<lots of output here>...
```

#### Pair Surface Dial

I followed these steps to pair the device: https://cuteprogramming.wordpress.com/2020/10/31/controlling-raspberry-pi-with-surface-dial/

TODO: summarize the commands here

#### Setting up pigpio for LED control

https://github.com/guymcswain/pigpio-client/wiki/Install-and-configure-pigpiod

#### Clone and startup roon-ms-surface-wheel

```shell
# assumes you're already in the parent directory you want the repo cloned into
git clone git@github.com:cgilling/roon-ms-surface-wheel.git
cd roon-ms-surface-wheel
# start the extension in production mode, will restart on crash
pm2 start app.js --name roon-ms-surface-wheel -- --production=true
# save pm2 state to ensure roon-ms-surface-wheel will startup when the system is restarted
pm2 save
```
