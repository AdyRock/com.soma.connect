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
        this.logEnabled = Homey.ManagerSettings.get( 'logEnabled' );

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
            if ( ( setting === 'usePolling' ) && ( Homey.ManagerSettings.get( 'usePolling' ) != this.oldUsePolling ) )
            {
                // usePolling has been changed so re-initialise the bridge
                this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ), false );
            }
            if ( ( setting === 'pollInterval' ) && ( Homey.ManagerSettings.get( 'pollInterval' ) != this.oldPollingInterval ) )
            {
                this.oldPollingInterval = Homey.ManagerSettings.get( 'pollInterval' );
                this.setPollTime( Homey.ManagerSettings.get( 'pollInterval', false ) );
            }
            if ( setting === 'logEnabled' )
            {
                this.logEnabled = Homey.ManagerSettings.get( 'logEnabled' );
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
        clearTimeout( this.timerID );
        if ( ( IgnorePollFlag || Homey.ManagerSettings.get( 'usePolling' ) ) && !this.timerProcessing )
        {
            const refreshTime = Number( NewTime ) * 1000;
            this.timerID = setTimeout( this.onPoll, refreshTime );
            if ( this.logEnabled )
            {
                this.updateLog( "Refresh in " + NewTime + "s" );
            }
        }
    }

    async onPoll()
    {
        this.timerProcessing = true;
        const promises = [];
        try
        {
            if ( this.logEnabled )
            {
                this.updateLog( "\n*** Refreshing Values ***" );
            }

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
            if ( this.logEnabled )
            {
                this.updateLog( "*** Refreshing Complete ***\n" );
            }
        }
        catch ( err )
        {
            this.updateLog( "Polling Error: " + err, true );
        }

        this.timerProcessing = false;
        this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ) );

        if ( global.gc )
        {
            try
            {
                global.gc();
            }
            catch ( err )
            {
                console.error( 'ERROR: global.gc() failed:', err );
            }
        }
        else
        {
            console.warn( 'WARNING: No GC hook! --expose-gc is not set!' );
        }
    }

    updateLog( newMessage, force = false )
    {
        this.log( newMessage );

        var oldText = Homey.ManagerSettings.get( 'diagLog' );
        if ( oldText > 10000 )
        {
            // Remove the first 5000 characters.
            oldText = oldText.substring( 1000 );
            var n = oldText.indexOf( "\n" );
            if ( n >= 0 )
            {
                // Remove up to and including the first \n so the log starts on a whole line
                oldText = oldText.substring( n + 1 );
            }
        }
        oldText += "* ";
        oldText += newMessage;
        oldText += "\n";
        Homey.ManagerSettings.set( 'diagLog', oldText );
    }

    // Compare version strings of the format x.x.x where x is a number >= 0
    // returns -1 if v1 < v2, 0 if v1 == v2 and 1 if v1 > v2
    compareVersions( v1, v2 )
    {
        let vc1 = v1.split( '.' );
        let vc2 = v2.split( '.' );

        if ( parseInt( vc1[ 0 ] ) < parseInt( vc2[ 0 ] ) ) return -1;
        if ( parseInt( vc1[ 0 ] ) > parseInt( vc2[ 0 ] ) ) return 1;
        if ( parseInt( vc1[ 1 ] ) < parseInt( vc2[ 1 ] ) ) return -1;
        if ( parseInt( vc1[ 1 ] ) > parseInt( vc2[ 1 ] ) ) return 1;
        if ( parseInt( vc1[ 2 ] ) < parseInt( vc2[ 2 ] ) ) return -1;
        if ( parseInt( vc1[ 2 ] ) > parseInt( vc2[ 2 ] ) ) return 1;

        return 0;
    }


    varToString( source )
    {
        if ( source === null )
        {
            return "null";
        }
        if ( source === undefined )
        {
            return "undefined";
        }
        if ( source instanceof Error )
        {
            let stack = source.stack.replace( '/\\n/g', '\n' );
            return source.message + '\n' + stack;
        }
        if ( typeof( source ) === "object" )
        {
            return JSON.stringify( source, null, 2 );
        }
        if ( typeof( source ) === "string" )
        {
            return source;
        }

        return source.toString();
    }
}

module.exports = SomaConnectApp;