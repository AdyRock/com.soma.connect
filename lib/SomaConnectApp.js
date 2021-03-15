/*jslint node: true */
'use strict';

const Homey = require( 'homey' );
const SomaConnectBridge = require( './SomaConnectBridge' );

const POLL_INTERVAL = 30000;
class SomaConnectApp extends Homey.App
{
    async onInit()
    {
        this.homey.settings.set( 'diagLog', "Starting app\r\n" );

        this.bridge = new SomaConnectBridge( this.homey );
        this.oldUsePolling = this.homey.settings.get( 'usePolling' );
        this.oldPollingInterval = this.homey.settings.get( 'pollInterval' );
        this.logEnabled = this.homey.settings.get( 'logEnabled' );

        // Make sure polling interval is set to something
        if ( !this.oldPollingInterval || ( this.oldPollingInterval < 1 ) || ( this.oldPollingInterval > 60000 ) )
        {
            this.homey.settings.set( 'pollInterval', POLL_INTERVAL );
            this.oldPollingInterval = this.homey.settings.get( 'pollInterval' );
        }

        this.homey.settings.on( 'set', function( setting )
        {
            if ( ( setting === 'usePolling' ) || ( setting === 'pollInterval' ) )
            {
                // usePolling or pollInterval has been changed
                this.homey.app.pollValues();
            }

            if ( setting === 'logEnabled' )
            {
                this.homey.app.logEnabled = this.homey.settings.get( 'logEnabled' );
            }
        } );

        this.pollValues = this.pollValues.bind( this );
        this.pollBattery = this.pollBattery.bind( this );

        this.boostTimer = 0;

        this.setPollTime();
        this.pollBattery();

        this.updateLog( '************** Soma Connect app has initialised. ***************' );
    }

    getBridge()
    {
        return this.bridge;
    }

    // Set the next poll inteval
    setPollTime( boostTime = 0 )
    {
        if ( boostTime > 0 )
        {
            this.boostTimer = boostTime;
        }

        let pollTime = 30;
        if ( this.boostTimer > 0 )
        {
            this.boostTimer--;
            pollTime = 3;
        }
        else
        {
            pollTime = this.homey.settings.get( 'pollInterval' );
        }

        this.homey.clearTimeout( this.timerPollValuesID );
        this.timerPollValuesID = this.homey.setTimeout( this.homey.app.pollValues, pollTime * 1000 );
    }

    async pollValues()
    {
        this.homey.clearTimeout( this.timerPollValuesID );

        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "\n*** Refreshing Values ***" );
        }

        const drivers = this.homey.drivers.getDrivers();
        for ( const driverId in drivers )
        {
            let driver = this.homey.drivers.getDriver( driverId );
            if ( driver.onPollValues )
            {
                try
                {
                    await driver.onPollValues();
                }
                catch ( err )
                {
                    this.homey.app.updateLog( "*** Refreshing Values Error ***\n" );
                }
            }
        }
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "*** Refreshing Values Finished ***\n" );
        }

        this.setPollTime();
    }

    async pollBattery()
    {
        this.homey.clearTimeout( this.timerPollBatteryID );

        const drivers = this.homey.drivers.getDrivers();
        for ( const driverId in drivers )
        {
            let driver = this.homey.drivers.getDriver( driverId );
            if ( driver.onPollBattery )
            {
                await driver.onPollBattery();
            }
        }

        this.timerPollBatteryID = this.homey.setTimeout( this.pollBattery, 60 * 60 * 1000 );
    }

    updateLog( newMessage, force = false )
    {
        this.log( newMessage );

        var oldText = this.homey.settings.get( 'diagLog' );
        if ( oldText.length >= 10000 )
        {
            // Remove characters from the start to make space for the new text.
            let removeSize = ( oldText.length - 10000 ) + newMessage.length;
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
        this.homey.settings.set( 'diagLog', oldText );
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