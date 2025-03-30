const axios = require('axios');

class KinoPubClient {
    constructor(auth) {
        this.auth = auth;
        this.API_URL = "https://api.srvkp.com/v1";
        this.MAX_RETRIES = 3;
    }
    
    async request(method, endpoint, data = {}, retryCount = 0) {
        // Check if authentication is needed
        if (!this.auth.isAuthenticated()) {
            await this.auth.authenticate();
        }
        
        // Prepare request config
        const config = {
            method,
            url: `${this.API_URL}/${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.auth.getAccessToken()}`,
                'User-Agent': 'Stremio KinoPub Addon',
                'Content-Type': 'application/json'
            }
        };
        
        // Add data to request
        if (method.toLowerCase() === 'get') {
            config.params = data;
        } else {
            config.data = data;
        }
        
        try {
            const response = await axios(config);
            
            // Check if response is valid
            if (response.data && response.data.status === 200) {
                return response.data;
            } else {
                throw new Error(`Invalid response: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            // Handle unauthorized error - refresh token and retry
            if (error.response && error.response.status === 401 && retryCount < this.MAX_RETRIES) {
                console.log("Unauthorized, refreshing token and retrying...");
                await this.auth.authenticate();
                return this.request(method, endpoint, data, retryCount + 1);
            }
            
            // Handle rate limiting
            if (error.response && error.response.status === 429 && retryCount < this.MAX_RETRIES) {
                console.log("Rate limited, retrying after delay...");
                await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                return this.request(method, endpoint, data, retryCount + 1);
            }
            
            // Log error details
            console.error("API request error:", error.response?.data || error.message);
            throw error;
        }
    }
    
    // Helper methods for common requests
    async get(endpoint, data = {}) {
        const response = await this.request('get', endpoint, data);
        return response;
    }
    
    async post(endpoint, data = {}) {
        const response = await this.request('post', endpoint, data);
        return response;
    }
    
    // Specific API methods
    async getItems(type, page = 1, perPage = 20) {
        return this.get('items', { type, page, perPage });
    }
    
    async searchItems(query, type = null) {
        const params = { title: query };
        if (type) params.type = type;
        return this.get('items', params);
    }
    
    async getItemById(id) {
        return this.get(`items/${id}`);
    }
    
    async getWatching() {
        return this.get('watching');
    }
    
    async getStreamUrl(itemId, videoId = 1, seasonId = null) {
        const item = await this.getItemById(itemId);
        
        if (!item || !item.item) {
            throw new Error(`Item ${itemId} not found`);
        }
        
        let videoData;
        
        if (item.item.type === 'movie' || item.item.type === 'documovie' || item.item.type === '3d') {
            // Movies have a videos array
            videoData = item.item.videos[videoId - 1];
        } else if (item.item.type === 'serial' || item.item.type === 'docuserial' || item.item.type === 'tvshow') {
            // TV shows have seasons with episodes
            if (!seasonId) {
                throw new Error('Season ID is required for TV shows');
            }
            
            const season = item.item.seasons[seasonId - 1];
            if (!season) {
                throw new Error(`Season ${seasonId} not found`);
            }
            
            videoData = season.episodes[videoId - 1];
        } else {
            throw new Error(`Unsupported item type: ${item.item.type}`);
        }
        
        if (!videoData || !videoData.files || !videoData.files.length) {
            throw new Error('No video files found');
        }
        
        // Return all available data including files, subtitles, and audio tracks
        return {
            files: videoData.files,
            subtitles: videoData.subtitles || [],
            audios: videoData.audios || [],
            duration: videoData.duration,
            title: videoData.title || ''
        };
    }
    
    async getSubtitles(itemId, videoId = 1, seasonId = null) {
        try {
            const videoData = await this.getStreamUrl(itemId, videoId, seasonId);
            return videoData.subtitles || [];
        } catch (error) {
            console.error("Failed to get subtitles:", error);
            return [];
        }
    }
    
    async getAudioTracks(itemId, videoId = 1, seasonId = null) {
        try {
            const videoData = await this.getStreamUrl(itemId, videoId, seasonId);
            return videoData.audios || [];
        } catch (error) {
            console.error("Failed to get audio tracks:", error);
            return [];
        }
    }
}

module.exports = { KinoPubClient };
