/*
    Heavily influence by https://medium.com/zattoo_tech/repeatable-double-click-and-hybrid-clicks-solution-with-usedoubleclick-hook-c6c64449abf7
*/

const DEFAULT_MULTI_CLICK_TIMEOUT = 250

/**
ClickManager.                                   
 * @class ClickManager
 * @param {object} config - Information about your extension. Used by Roon to display to the end user what is trying to access Roon.
 * @param {number} config.multiClickTimeout - How many milliseconds to allow between clicks when collecting them
 * @param {ClickManager~clickCallback} [config.clickCallback] - called after clicks have been collected
 */
/**
 * @callback RoonApi~clickCallback
 * @param clickCount
 */
/**
 * @callback RoonApi~doubleClickCallback
 */

function ClickManager(config) {
    if (config.multiClickTimeout) {
        this.multiClickTimeout = config.multiClickTimeout
    } else {
        this.multiClickTimeout = DEFAULT_MULTI_CLICK_TIMEOUT
    }
    this.clickCallback = config.clickCallback

    this.clickCount = 0
    this.clickTimeout = undefined

    this.clearClickTimeout = () => {
        if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = undefined;
        }
    }
}

ClickManager.prototype.processClick = function () {
    this.clearClickTimeout();

    this.clickCount += 1
    this.clickTimeout = setTimeout(() => {
        this.clickCallback(this.clickCount)
        this.clickCount = 0
    }, this.clickCount <= 1 ? this.multiClickTimeout : this.multiClickTimeout * 2);
}

exports = module.exports = ClickManager
