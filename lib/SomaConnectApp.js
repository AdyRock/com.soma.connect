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
        this.logEnabled = Homey.ManagerSettings.get( 'logEnabled' );

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
                // usePolling has been changed
                this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ), false );
            }

            if ( ( setting === 'pollInterval' ) && ( Homey.ManagerSettings.get( 'pollInterval' ) != this.oldPollingInterval ) )
            {
                // pollInterval has been changed
                this.setPollTime( Homey.ManagerSettings.get( 'pollInterval' ), false );
            }

            if ( setting === 'logEnabled' )
            {
                Homey.app.logEnabled = Homey.ManagerSettings.get( 'logEnabled' );
            }
        } );

        this.updateLog( '************** Soma Connect app has initialised. ***************' );
    }

    getBridge()
    {
        return this.bridge;
    }

    setPollTime( NewTime, IgnorePollFlag )
    {
        // Update each driver
        this.oldPollingInterval = Homey.ManagerSettings.get( 'pollInterval' );

        const driverIDs = Homey.ManagerDrivers.getDrivers();
        for ( const driverID in driverIDs )
        {
            const driver = Homey.ManagerDrivers.getDriver( driverID )
            driver.setPollTime( NewTime, IgnorePollFlag );
        }
    }

    updateLog( newMessage, force = false )
    {
        this.log( newMessage );

        var oldText = Homey.ManagerSettings.get( 'diagLog' );
        if ( oldText.length >= 10000 )
        {
            // Remove characters from the start to make space for the new text.
            let removeSize = (oldText.length - 10000) + newMessage.length;
            oldText = oldText.substring( removeSize );
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