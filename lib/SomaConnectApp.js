'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( './SomaConnectBridge' );

const POLL_INTERVAL = 30000;
class SomaConnectApp extends Homey.App
{
    async onInit()
    {
        this.bridge = new SomaConnectBridge();
        this.oldUsePolling = Homey.ManagerSettings.get( 'usePolling' );
        this.oldPollingInterval = Homey.ManagerSettings.get( 'pollInterval' );
        this.timerProcessing = false;

        this.onPoll = this.onPoll.bind( this );

        // Make sure polling interval is set to something
        if ( !this.oldPollingInterval || ( this.oldPollingInterval < 1 ) || ( this.oldPollingInterval > 60000 ) )
        {
            Homey.ManagerSettings.set( 'pollInterval', POLL_INTERVAL );
            this.oldPollingInterval = Homey.ManagerSettings.get( 'pollInterval' );
        }

        Homey.ManagerSettings.set( 'diagLog', "Starting app\r\n" );

        Homey.ManagerSettings.on( 'set', function( setting )
        {
            if ( ( setting === 'usePolling' ) && ( Homey.ManagerSettings.get( 'usePolling' ) != Homey.app.oldUsePolling ) )
            {
                // usePolling has been changed so re-initialise the bridge
                Homey.app.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ), false );
            }
            if ( ( setting === 'pollInterval' ) && ( Homey.ManagerSettings.get( 'pollInterval' ) != Homey.app.oldPollingInterval ) )
            {
                Homey.app.oldPollingInterval = Homey.ManagerSettings.get( 'pollInterval' );
                Homey.app.setPollTime( Homey.ManagerSettings.get( 'pollInterval', false ) );
            }
        } );

        this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ) );

        this.updateLog( '************** Soma Connect app has initialised. ***************' );
    }

    getBridge()
    {
        return this.bridge;
    }

    setPollTime( NewTime, IgnorePollFlag )
    {
        clearTimeout( Homey.app.timerID );
        if ( ( IgnorePollFlag || Homey.ManagerSettings.get( 'usePolling' ) ) && !Homey.app.timerProcessing )
        {
            const refreshTime = Number( NewTime ) * 1000;
            Homey.app.timerID = setTimeout( Homey.app.onPoll, refreshTime );
            this.updateLog( "Refresh in " + NewTime + "s" );
        }
    }

    async onPoll()
    {
        this.timerProcessing = true;
        const promises = [];
        try
        {
            this.updateLog( "\r\n*** Refreshing Values ***" );

            // Fetch the list of drivers for this app
            const drivers = Homey.ManagerDrivers.getDrivers();
            for ( const driver in drivers )
            {
                let devices = Homey.ManagerDrivers.getDriver( driver ).getDevices();
                for ( var i = 0; i < devices.length; i++ )
                {
                    let device = devices[ i ];
                    if ( device.getDeviceValues )
                    {
                        promises.push( device.getDeviceValues() );
                    }

                    if ( device.getBatteryValues )
                    {
                        promises.push( device.getBatteryValues() );
                    }
                }
            }

            await Promise.all( promises );
            this.updateLog( "*** Refreshing Complete ***\r\n" );
        }
        catch ( err )
        {
            this.updateLog( "Polling Error: " + err );
        }

        this.timerProcessing = false;
        this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ) );
    }

    updateLog( newMessage, force = false )
    {
        this.log( newMessage );

        if (!force && !Homey.ManagerSettings.get( 'logEnabled' ) )
        {
            return;
        }

        var oldText = Homey.ManagerSettings.get( 'diagLog' );
        oldText += "* ";
        oldText += newMessage;
        oldText += "\r\n";
        Homey.ManagerSettings.set( 'diagLog', oldText );
    }
}

module.exports = SomaConnectApp;