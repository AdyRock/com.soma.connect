'use strict';

const Homey = require( 'homey' );

class somaShade extends Homey.Driver
{

    async onInit()
    {
        this.log( 'somaShade has been init' );

        this.valuesTimerProcessing = false;
        this.batteryTimerProcessing = false;
        this.settingPollTime = false;

        this.valueTimerID = null;
        this.batteryTimerID = null;

        this.onPollValues = this.onPollValues.bind( this );
        this.onPollBattery = this.onPollBattery.bind( this );


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

        this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ) );
    }

    // this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
    onPairListDevices( data, callback )
    {
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

    setPollTime( NewTime, IgnorePollFlag )
    {
        if (!this.settingPollTime)
        {
            this.settingPollTime = true;
            clearTimeout( this.valueTimerID );
            if ( ( IgnorePollFlag || Homey.ManagerSettings.get( 'usePolling' ) ) && !this.valuesTimerProcessing )
            {
                const refreshTime = Number( NewTime ) * 1000;
                this.valueTimerID = setTimeout( this.onPollValues, refreshTime );
                if ( this.logEnabled )
                {
                    this.updateLog( "Refresh in " + NewTime + "s" );
                }
            }

            this.settingPollTime = false;
        }
    }

    async onPollValues()
    {
        if (!this.valuesTimerProcessing)
        {
            this.valuesTimerProcessing = true;
            const promises = [];
            try
            {
                if ( this.logEnabled )
                {
                    this.updateLog( "\n*** Refreshing Values ***" );
                }

                let devices = this.getDevices();
                
                for ( var i = 0; i < devices.length; i++ )
                {
                    let device = devices[ i ];
                    if (device.valueInitialised)
                    {
                        promises.push( device.getDeviceValues() );
                    }
                }
            }
            catch ( err )
            {
                this.updateLog( "Values Polling Error: " + err, true );
            }
                
            await Promise.all( promises );
                
            if ( Homey.app.logEnabled )
            {
                Homey.app.updateLog( "*** Refreshing Values Finished ***\n" );
            }

            this.valuesTimerProcessing = false;
            this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ) );
        }
    }

    async onPollBattery()
    {
        if (!this.batteryTimerProcessing)
        {
            this.batteryTimerProcessing = true;
            const promises = [];
            try
            {
                if ( this.logEnabled )
                {
                    this.updateLog( "\n*** Refreshing Battery Values ***" );
                }

                let devices = this.getDevices();
                
                for ( var i = 0; i < devices.length; i++ )
                {
                    let device = devices[ i ];
                    if (device.batteryInitialised)
                    {
                        promises.push( device.getBatteryValues() );
                    }
                }
            }
            catch ( err )
            {
                this.updateLog( "Battery Polling Error: " + err, true );
            }
                
            await Promise.all( promises );
                
            if ( Homey.app.logEnabled )
            {
                Homey.app.updateLog( "*** Refreshing Battery Finished ***\n" );
            }

            clearTimeout( this.batteryTimerID );
            this.batteryTimerID = setTimeout( this.onPollBattery, 60 * 60 * 1000 );
            if ( this.logEnabled )
            {
                this.updateLog( "Battery Status Refresh in 1hr" );
            }

            this.batteryTimerProcessing = false;
        }
    }
}

module.exports = somaShade;