/*jslint node: true */
module.exports = {
    async Add_EditBridge({ homey, body })
    {
        return homey.app.add_editBridge(body.bridgeId, body.bridgeIp, body.bridgeUSB);
    },
};