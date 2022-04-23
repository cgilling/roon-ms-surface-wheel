/*
    Heavily influence by https://medium.com/zattoo_tech/repeatable-double-click-and-hybrid-clicks-solution-with-usedoubleclick-hook-c6c64449abf7
*/

const DEFAULT_DOUBLE_CLICK_TIMEOUT = 200

/**
ClickManager.                                   
 * @class ClickManager
 * @param {object} config - Information about your extension. Used by Roon to display to the end user what is trying to access Roon.
 * @param {number} config.doubleClickTimeout - A unique ID for this extension. Something like @com.your_company_or_name.name_of_extension@.
 * @param {ClickManager~clickCallback} [config.clickCallback] - Called when a single click is detected.
 * @param {ClickManager~doubleClickCallback} [config.doubleClickCallback] - Called when a double click is detected.
 */
/**
 * @callback RoonApi~clickCallback
 */
/**
 * @callback RoonApi~doubleClickCallback
 */

function ClickManager(config) {
    if (config.doubleClickTimeout) {
        this.doubleClickTimeout = config.doubleClickTimeout
    } else {
        this.doubleClickTimeout = DEFAULT_DOUBLE_CLICK_TIMEOUT
    }
    this.clickCallback = config.clickCallback
    this.doubleClickCallback = config.doubleClickCallback

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
        if (this.clickCount === 1) {
            this.clickCallback()
        }
        this.clickCount = 0
    }, this.doubleClickTimeout);

    if (this.clickCount % 2 === 0) {
        this.doubleClickCallback()
    }
}

exports = module.exports = ClickManager
