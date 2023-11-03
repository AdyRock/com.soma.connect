/*jslint node: true */
'use strict';

const Homey = require( 'homey' );
const http = require( "http" );

module.exports = class SomaConnectBridge
{
    constructor( HomeyInstance, Address, BridgeId, BridgeUSB )
    {
        //super();
        this.homey = HomeyInstance;
        this.address = Address;
        this.bridgeId = BridgeId;
        this.bridgeUSB = BridgeUSB;
        return this;
    }

    async getDevices()
    {
        const devices = [];
        const somaDevices = await this.sendMessage( 'get', 'list_devices' );
        if ( somaDevices != -1 )
        {
            this.homey.app.updateLog( "getDevices: " + this.homey.app.varToString( somaDevices ) );
            for ( const device of somaDevices.shades )
            {
                if (!this.bridgeUSB && device.count)
                {
                    // Update the bridge type if it is a Soma Connect USB
                    this.bridgeUSB = true;
                    this.homey.app.add_editBridge(this.bridgeId, this.address, this.bridgeUSB);
                }

                var iconName = "venetianblind.svg";
                var type = "tilt";
                if ( device.type )
                {
                    type = device.type;
                    if ( device.type === 'shade' )
                    {
                        iconName = "rollerblind.svg";
                    }
                }

                devices.push(
                {
                    "name": device.name,
                    "icon": iconName,
                    "data":
                    {
                        "id": device.mac
                    },
                    "settings":
                    {
                        "deviceType": type,
                        "bridgeId": this.bridgeId
                    }
                } );
            }
            this.homey.app.updateLog( "getDevices: " + this.homey.app.varToString( devices ) );
            return devices;
        }

        return devices;
    }

    async stop( mac )
    {
        if ( typeof mac != 'string' )
        {
            this.homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = null;
        if (!this.bridgeUSB)
        {
            result = await this.sendMessage( 'get', 'stop_shade/' + mac );
        }
        else
        {
            result = await this.sendMessage( 'get', 'stop_shade?mac=' + mac );
        }

        // Refresh GUI after 15 seconds regardless of polling options
        this.homey.app.setPollTime( 4, true );
        return result;
    }

    async setPosition( mac, position, upwards )
    {
        if ( typeof mac != 'string' )
        {
            this.homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = null;
        if (!this.bridgeUSB)
        {
            result = await this.sendMessage( 'get', 'set_shade_position/' + mac + '/' + position + upwards );
        }
        else
        {
            // Replace ? with & in upwards parameter
            upwards = upwards.replace('?', '&');
            result = await this.sendMessage( 'get', 'set_shade_position?mac=' + mac + '&pos=' + position + upwards );
        }

        // Refresh GUI regardless of polling options
        this.homey.app.setPollTime( 4, true );
        return result;
    }

    async getPosition( mac )
    {
        if ( typeof mac != 'string' )
        {
            this.homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }
        if (!this.bridgeUSB)
        {
            return await this.sendMessage( 'get', 'get_shade_state/' + mac );
        }
        else
        {
            return await this.sendMessage( 'get', 'get_shade_state?mac=' + mac );
        }
}

    async getBattery( mac )
    {
        if ( typeof mac != 'string' )
        {
            this.homey.app.updateLog( "getPosition (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = null;
        if (!this.bridgeUSB)
        {
            result = await this.sendMessage( 'get', 'get_battery_level/' + mac );
        }
        else
        {
            result = await this.sendMessage( 'get', 'get_battery_level?mac=' + mac );
        }

        return result;
    }

    async getLightLevel( mac )
    {
        if ( typeof mac != 'string' )
        {
            this.homey.app.updateLog( "getLightLevel (invalid mac address): " + mac + typeof mac );
            return "";
        }

        var result = null;
        if (!this.bridgeUSB)
        {
            result = await this.sendMessage( 'get', 'get_light_level/' + mac );
        }
        else
        {
            result = await this.sendMessage( 'get', 'get_light_level?mac=' + mac );
        }

        return result.light_level;
    }

    async sendMessage( method, path )
    {
        return await this.GetURL(
        {
            address: this.address,
            path: path,
        } );
    }

    async GetURL( { address, path } )
    {
        // Send a request to the specified 
        if ( this.homey.app.logEnabled )
        {
            this.homey.app.updateLog( "Get from: http://" + address + "/" + path );
        }
        return new Promise( ( resolve, reject ) =>
        {
            try
            {
                let http_options = {
                    host: address,
                    port: 3000,
                    path: "/" + path,
                    timeout: 5000
                };

                let req = http.get( http_options, ( res ) =>
                {
                    if ( res.statusCode === 200 )
                    {
                        let body = [];
                        res.on( 'data', ( chunk ) =>
                        {
                            body.push( chunk );
                        } );
                        res.on( 'end', () =>
                        {
                            let returnData = JSON.parse( Buffer.concat( body ) );
                            // if ( this.homey.app.logEnabled )
                            // {
                            //     this.homey.app.updateLog( "Get response: " + this.homey.app.varToString( returnData ) );
                            // }
                            resolve( returnData );
                        } );
                    }
                    else
                    {
                        let message = "";
                        if ( res.statusCode === 204 )
                        {
                            message = "No Data Found";
                        }
                        else if ( res.statusCode === 400 )
                        {
                            message = "Bad request";
                        }
                        else if ( res.statusCode === 401 )
                        {
                            message = "Unauthorized";
                        }
                        else if ( res.statusCode === 403 )
                        {
                            message = "Forbidden";
                        }
                        else if ( res.statusCode === 404 )
                        {
                            message = "Not Found";
                        }
                        this.homey.app.updateLog( "HTTPS Error: " + res.statusCode + ": " + message, 0 );
                        reject( new Error( "HTTP Error: " + message ) );
                        return;
                    }
                } ).on( 'error', ( err ) =>
                {
                    this.homey.app.updateLog( err, 0 );
                    reject( new Error( "HTTP Catch: " + err ) );
                    return;
                } );

                req.setTimeout( 5000, function()
                {
                    req.destroy();
                    reject( new Error( "HTTP Catch: Timeout" ) );
                    return;
                } );
            }
            catch ( err )
            {
                this.homey.app.updateLog( err, 0 );
                reject( new Error( "HTTP Catch: " + err ) );
                return;
            }
        } );
    }


};