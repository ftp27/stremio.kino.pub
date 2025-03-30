const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const opn = require('opn');

class Auth extends EventEmitter {
    constructor() {
        super();
        this.CLIENT_ID = "xbmc";
        this.CLIENT_SECRET = "cgg3gtifu46urtfp2zp1nqtba0k2ezxh";
        this.API_URL = "https://api.srvkp.com/v1";
        this.OAUTH_URL = "https://api.srvkp.com/oauth2/device";
        
        // File to store auth data
        this.AUTH_FILE = path.join(os.homedir(), '.kinopub-stremio.json');
        
        // Load existing tokens if available
        this.loadAuthData();
    }
    
    loadAuthData() {
        try {
            if (fs.existsSync(this.AUTH_FILE)) {
                const data = fs.readFileSync(this.AUTH_FILE, 'utf8');
                const authData = JSON.parse(data);
                this.accessToken = authData.accessToken;
                this.refreshToken = authData.refreshToken;
                this.accessTokenExpire = authData.accessTokenExpire;
                console.log("Auth data loaded from file");
            }
        } catch (error) {
            console.error("Failed to load auth data:", error);
            this.accessToken = null;
            this.refreshToken = null;
            this.accessTokenExpire = 0;
        }
    }
    
    saveAuthData() {
        try {
            const authData = {
                accessToken: this.accessToken,
                refreshToken: this.refreshToken,
                accessTokenExpire: this.accessTokenExpire
            };
            fs.writeFileSync(this.AUTH_FILE, JSON.stringify(authData, null, 2));
            console.log("Auth data saved to file");
        } catch (error) {
            console.error("Failed to save auth data:", error);
        }
    }
    
    isAuthenticated() {
        return !!this.accessToken && this.accessTokenExpire > Date.now()/1000;
    }
    
    async authenticate() {
        if (this.refreshToken) {
            try {
                await this.refreshAccessToken();
                return true;
            } catch (error) {
                console.error("Failed to refresh token:", error);
                // If refresh fails, try device code flow
            }
        }
        
        // Device code flow
        return this.deviceCodeAuth();
    }
    
    async deviceCodeAuth() {
        try {
            // Step 1: Get device code
            const response = await axios.post(this.OAUTH_URL, {
                grant_type: 'device_code',
                client_id: this.CLIENT_ID,
                client_secret: this.CLIENT_SECRET
            });
            
            const { code, user_code, verification_uri, interval } = response.data;
            
            // Display instructions to user
            console.log(`Please visit ${verification_uri} and enter code: ${user_code}`);
            
            // Open the browser for the user
            opn(verification_uri);
            
            // Step a message for the user in Stremio
            this.emit('auth-required', {
                url: verification_uri,
                code: user_code
            });
            
            // Step 2: Poll for token
            return this.pollForToken(code, interval);
        } catch (error) {
            console.error("Device code auth error:", error.response?.data || error);
            throw error;
        }
    }
    
    async pollForToken(deviceCode, interval) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 120; // 5 minutes (30 times at ~10 second intervals)
            let attempts = 0;
            
            const poll = async () => {
                if (attempts >= maxAttempts) {
                    reject(new Error("Authentication timed out"));
                    return;
                }
                
                attempts++;
                
                try {
                    const response = await axios.post(this.OAUTH_URL, {
                        grant_type: 'device_token',
                        client_id: this.CLIENT_ID,
                        client_secret: this.CLIENT_SECRET,
                        code: deviceCode
                    });
                    
                    // Got a token!
                    this.accessToken = response.data.access_token;
                    this.refreshToken = response.data.refresh_token;
                    this.accessTokenExpire = Math.floor(Date.now()/1000) + response.data.expires_in;
                    
                    this.saveAuthData();
                    this.updateDeviceInfo();
                    
                    resolve(true);
                } catch (error) {
                    if (error.response?.data?.error === "authorization_pending") {
                        // User hasn't authorized yet, keep polling
                        setTimeout(poll, interval * 1000);
                    } else if (error.response?.data?.error === "code_expired") {
                        // Code expired, need to get a new one
                        reject(new Error("Authorization code expired"));
                    } else {
                        // Other error
                        console.error("Polling error:", error.response?.data || error);
                        setTimeout(poll, interval * 1000);
                    }
                }
            };
            
            // Start polling
            poll();
        });
    }
    
    async refreshAccessToken() {
        try {
            const response = await axios.post(this.OAUTH_URL, {
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken,
                client_id: this.CLIENT_ID,
                client_secret: this.CLIENT_SECRET
            });
            
            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            this.accessTokenExpire = Math.floor(Date.now()/1000) + response.data.expires_in;
            
            this.saveAuthData();
            console.log("Access token refreshed successfully");
            return true;
        } catch (error) {
            console.error("Failed to refresh token:", error.response?.data || error);
            throw error;
        }
    }
    
    async updateDeviceInfo() {
        try {
            const osInfo = `${os.type()} ${os.release()}`;
            const deviceName = os.hostname();
            
            await axios.post(`${this.API_URL}/device/notify`, {
                title: deviceName,
                hardware: os.arch(),
                software: `Stremio on ${osInfo}`
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            console.log("Device info updated");
        } catch (error) {
            console.error("Failed to update device info:", error);
        }
    }
    
    getAccessToken() {
        return this.accessToken;
    }
}

module.exports = { Auth };
