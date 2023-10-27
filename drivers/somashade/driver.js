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
        const QuietMoveAction = this.homey.flow.getActionCard( 'windowcoverings_set_speed' );
        QuietMoveAction
            .registerRunListener( async ( args, state ) =>
            {
                return args.my_device.onCapabilityPosition( args.windowcoverings_set, {'slow': true} ); // Promise<void>
            } );
    }

    // this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
    async onPairListDevices()
    {
        return this.homey.app.getDevices();
    }
    async onRepair(session, device)
    {
        session.setHandler('showView', async (view) =>
        { 
            if (view === 'loading')
            {       
                const bridgeId = await device.findBridgeWithDevice();
                if (bridgeId)
                {
                    device.getDeviceValues();
                    await session.nextView();
                }
                else
                {
                    device.setOffline( "No Bridge detected that hosts this device", true );
                    await session.nextView();
                }
            }
        });
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
                if ( device.initialised )
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
                if ( device.initialised )
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

    async onPollLightLevel()
    {
        try
        {
            if ( this.homey.app.logEnabled )
            {
                this.homey.app.updateLog( "\n*** Refreshing Light Level Values ***" );
            }

            let devices = this.getDevices();

            for ( var i = 0; i < devices.length; i++ )
            {
                let device = devices[ i ];
                if ( device.initialised )
                {
                    await device.getLightValues();
                }
            }
        }
        catch ( err )
        {
            this.homey.app.updateLog( "Light Level Polling Error: " + err, true );
        }

        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "*** Refreshing Light Level Finished ***\n" );
        }
    }
}

module.exports = somaShade;