'use strict';

const Homey = require( 'homey' );
//const { EventEmitter } = require( 'events' );
const fetch = require( 'node-fetch' );

module.exports = class SomaConnectBridge
{
    constructor()
    {
        //super();
        return this;
    }

    async getDevices()
    {
        const devices = [];
        const somaDevices = await this.sendMessage( 'get', 'list_devices' );
        if ( somaDevices != -1 )
        {
            for ( const device of somaDevices[ 'shades' ] )
            {
                var iconName = "venetianblind.svg";
                var data = {};
                data = {
                    "id": device[ 'mac' ],
                };
                devices.push(
                {
                    "name": device[ 'name' ],
                    "icon": iconName,
                    data
                } )
            }
            return devices;
        }

        return devices;
    }

    async stop( mac )
    {
        if ( typeof mac != 'string' )
        {
            Homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = await this.sendMessage( 'get', 'stop_shade/' + mac );

        // Refresh GUI after 15 seconds regardless of polling options
        Homey.app.setPollTime( 15, true );
        return result;
    }

    async setPosition( mac, position )
    {
        if ( typeof mac != 'string' )
        {
            Homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = await this.sendMessage( 'get', 'set_shade_position/' + mac + '/' + position );

        // Refresh GUI after 15 seconds regardless of polling options
        Homey.app.setPollTime( 15, true );
        return result;
    }

    async getPosition( mac )
    {
        if ( typeof mac != 'string' )
        {
            Homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }
        return result = await this.sendMessage( 'get', 'get_shade_state/' + mac );
    }

    async getBattery( mac )
    {
        if ( typeof mac != 'string' )
        {
            Homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = await this.sendMessage( 'get', 'get_battery_level/' + mac );
        return result[ 'battery_level' ];
    }

    async sendMessage( method, path )
    {
        let hubIP = Homey.ManagerSettings.get( 'hubIP' );
        if (hubIP == "")
        {
            throw new Error("Hub IP has not been setup in Apps - Somma Connect - Configure App");
        }
        hubIP = hubIP + ":3000/";
        return await this._call(
        {
            method: method,
            address: hubIP,
            path: path,
            body: "",
        } );
    }

    async _call(
    {
        address,
        method = 'get',
        path = '/',
        body,
    } )
    {
        if ( !address )
        {
            throw new Error( 'Missing URL' );
        }

        const url = `http://${address}${path}`;
        const opts = {
            method,
            headers:
            {
                'content-type': 'application/json',
            },
        }

        const res = await fetch( url, opts );

        var bodyText;
        if ( res.status === 200 )
        {
            // Get the reply in JSON format
            bodyText = await res.json();
        }
        else
        {
            // Get the reply as text as it will possibly be an error message
            bodyText = await res.text();
        }

        // Make sure there is something to return and the status was good
        if ( bodyText && ( res.status === 200 ) )
        {
            return bodyText;
        }

        if ( !res.ok )
        {
            // The result was bad so throw an error
            // console.log('status: ', res.status);
            const err = new Error( ( bodyText && bodyText.error && bodyText.error.message ) || ( bodyText ) || 'Unknown Error' );
            err.code = res.status;
            throw new Error(err);
        }

        return bodyText;
    }
}