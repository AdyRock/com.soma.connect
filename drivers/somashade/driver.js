/*jslint node: true */
'use strict';

const Homey = require( 'homey' );

class somaShade extends Homey.Driver
{

    async onInit()
    {
        this.log( 'somaShade has been init' );

        this.deviceOnlineStateTrigger = this.homey.flow.getDeviceTriggerCard( 'deviceOnlineState' );

        const stopAction = this.homey.flow.getActionCard( 'stop' );
        stopAction
            .registerRunListener( async ( args, state ) =>
            {
                return args.my_device.stop(); // Promise<void>
            } );
    }

    // this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
    async onPairListDevices()
    {
        return this.homey.app.getDevices();
    }

    async triggerDeviceOnlineStateChange( Device, Value )
    {
        // trigger the card
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "Triggering device Online State with: " + Value );
        }

        let tokens = { 'state': Value };
        let state = {};

        this.deviceOnlineStateTrigger.trigger( Device, tokens, state )
            .then( this.log )
            .catch( this.error );
    }

    async onPollValues()
    {
        try
        {
            let devices = this.getDevices();
            for ( var i = 0; i < devices.length; i++ )
            {
                let device = devices[ i ];
                if ( device.valueInitialised )
                {
                    await device.getDeviceValues();
                }
            }
        }
        catch ( err )
        {
            this.homey.app.updateLog( "Values Polling Error: " + err, true );
        }
    }

    async onPollBattery()
    {
        try
        {
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( "\n*** Refreshing Battery Values ***" );
            }

            let devices = this.getDevices();

            for ( var i = 0; i < devices.length; i++ )
            {
                let device = devices[ i ];
                if ( device.batteryInitialised )
                {
                    await device.getBatteryValues();
                }
            }
        }
        catch ( err )
        {
            this.homey.app.updateLog( "Battery Polling Error: " + err, true );
        }

        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "*** Refreshing Battery Finished ***\n" );
        }
    }
}

module.exports = somaShade;