'use strict';

const Homey = require( 'homey' );

class somaShade extends Homey.Driver
{

    async onInit()
    {
        this.log( 'somaShade has been init' );

        this.deviceOnlineStateTrigger = new Homey.FlowCardTriggerDevice( 'deviceOnlineState' );
        this.deviceOnlineStateTrigger
            .register()

        let stopAction = new Homey.FlowCardAction( 'stop' );
        stopAction
            .register()
            .registerRunListener( async ( args, state ) =>
            {
                return args.my_device.stop(); // Promise<void>
            } )
    }

    // this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
    onPairListDevices( data, callback )
    {
        // Required properties:
        //"data": { "id": "abcd" },

        // Optional properties, these overwrite those specified in app.json:
        // "name": "My Device",
        // "icon": "/my_icon.svg", // relative to: /drivers/<driver_id>/assets/
        // "capabilities": [ "onoff", "dim" ],
        // "capabilitiesOptions: { "onoff": {} },

        // Optional properties, device-specific:
        // "store": { "foo": "bar" },
        // "settings": { "my_setting": "my_value" },

        Homey.app.getBridge().getDevices().then( function( devices )
        {
            //console.log( devices );
            callback( null, devices );

        } ).catch( function( err )
        {
            callback( err, [] );
        } );
    }

    async triggerDeviceOnlineStateChange( Device, Value )
    {
        // trigger the card
        if ( Homey.app.logEnabled )
        {
            Homey.app.updateLog( "Triggering device Online State with: " + Value );
        }
        
        let tokens = { 'state': Value };
        let state = {};

        this.deviceOnlineStateTrigger.trigger( Device, tokens, state )
            .then( this.log )
            .catch( this.error )
    }
}

module.exports = somaShade;