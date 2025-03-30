const { addonBuilder } = require("stremio-addon-sdk");
const { KinoPubClient } = require("./lib/client");
const { Auth } = require("./lib/auth");

// Initialize auth and client
const auth = new Auth();
const client = new KinoPubClient(auth);

// Define manifest
const manifest = {
    "id": "org.kinopub.stremio",
    "version": "1.0.0",
    "name": "KinoPub",
    "description": "Unofficial KinoPub addon for Stremio with audio and subtitle selection",
    "resources": [
        "catalog",
        "stream",
        "meta",
        "subtitles"
    ],
    "types": ["movie", "series"],
    "catalogs": [
        {
            type: 'movie',
            id: 'kinopub-movies',
            name: 'KinoPub Movies',
            extra: [
                { name: 'search', isRequired: false }
            ]
        },
        {
            type: 'series',
            id: 'kinopub-series',
            name: 'KinoPub Series',
            extra: [
                { name: 'search', isRequired: false }
            ]
        }
    ],
    "idPrefixes": ["kp_"]
};

const builder = new addonBuilder(manifest);

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (!auth.isAuthenticated()) {
        await auth.authenticate();
    }
    
    try {
        let endpoint = "";
        let data = {};
        
        // Handle search or default catalog
        if (extra && extra.search) {
            endpoint = "items";
            data = { 
                type: type === "movie" ? "movie" : "serial",
                title: extra.search
            };
        } else {
            endpoint = "items/fresh";
            data = { 
                type: type === "movie" ? "movie" : "serial"
            };
        }
        
        const response = await client.get(endpoint, data);
        
        // Map response to meta previews
        const metas = response.items.map(item => {
            return {
                id: `kp_${item.id}`,
                type: type,
                name: item.title,
                poster: item.posters?.big || "",
                background: item.posters?.wide || "",
                description: item.plot,
                releaseInfo: item.year?.toString() || "",
                imdbRating: item.imdb_rating || item.kinopoisk_rating || null,
            };
        });
        
        return { metas };
    } catch (error) {
        console.error("Catalog error:", error);
        return { metas: [] };
    }
});

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
    if (!auth.isAuthenticated()) {
        await auth.authenticate();
    }
    
    try {
        // Parse the Stremio ID format
        // For movies: kp_12345
        // For series episodes: kp_12345:1:2 (item:season:episode)
        const idParts = id.split(':');
        const itemId = idParts[0].replace('kp_', '');
        
        let seasonNumber = null;
        let episodeNumber = 1;
        
        // For series, extract season and episode
        if (idParts.length === 3) {
            seasonNumber = parseInt(idParts[1]);
            episodeNumber = parseInt(idParts[2]);
        }
        
        // Get detailed item information
        const itemData = await client.get(`items/${itemId}`);
        const item = itemData.item;
        
        // Get streams based on item type
        let streams = [];
        
        if (type === "movie" || (type === "series" && !seasonNumber)) {
            // For movies or when no specific episode is requested
            const video = item.videos?.[0];
            if (video && video.files) {
                streams = await processVideoStreams(video, itemId, 1);
            }
        } else if (type === "series" && seasonNumber) {
            // For series with specific episode
            if (item.seasons && seasonNumber <= item.seasons.length) {
                const season = item.seasons[seasonNumber - 1];
                if (season.episodes && episodeNumber <= season.episodes.length) {
                    const episode = season.episodes[episodeNumber - 1];
                    streams = await processVideoStreams(episode, itemId, episodeNumber, seasonNumber);
                }
            }
        }
        
        return { streams };
    } catch (error) {
        console.error("Stream error:", error);
        return { streams: [] };
    }
});

// Function to process video streams with audio and subtitle options
async function processVideoStreams(video, itemId, videoNumber, seasonNumber = null) {
    try {
        const streams = [];
        
        // Get extended video data including subtitles and audio tracks
        let videoData;
        try {
            videoData = await client.getStreamUrl(itemId, videoNumber, seasonNumber);
        } catch (error) {
            console.error("Error getting stream data:", error);
            // Fallback to basic files if we can't get the extended data
            videoData = { files: video.files || [] };
        }
        
        // Process each quality option
        for (const file of videoData.files || []) {
            // Prepare stream object
            const stream = {
                title: `KinoPub ${file.quality}`,
                url: file.url.hls || file.url.http || "",
                quality: mapQualityLabel(file.quality)
            };
            
            // Add subtitle tracks if available
            if (videoData.subtitles && videoData.subtitles.length > 0) {
                stream.subtitles = videoData.subtitles.map(sub => ({
                    id: sub.lang || 'unknown',
                    url: sub.url,
                    lang: sub.lang || 'unknown'
                }));
            }
            
            // Add behavior hints for audio track selection
            // Note: Stremio doesn't directly support audio track selection in the same way as subtitles,
            // but we can provide the information via behaviorHints for compatible players
            if (videoData.audios && videoData.audios.length > 0) {
                if (!stream.behaviorHints) {
                    stream.behaviorHints = {};
                }
                
                // Some players might use this format to recognize audio tracks
                stream.behaviorHints.audioTracks = videoData.audios.map(audio => ({
                    id: audio.lang || 'unknown',
                    title: audio.title || audio.lang || 'Unknown',
                    lang: audio.lang || 'unknown'
                }));
            }
            
            streams.push(stream);
        }
        
        return streams;
    } catch (error) {
        console.error("Error processing video streams:", error);
        return [];
    }
}

// Define a subtitles handler
builder.defineSubtitlesHandler(async ({ type, id, extra }) => {
    if (!auth.isAuthenticated()) {
        await auth.authenticate();
    }
    
    try {
        // Parse the Stremio ID format
        const idParts = id.split(':');
        const itemId = idParts[0].replace('kp_', '');
        
        let seasonNumber = null;
        let episodeNumber = 1;
        
        // For series, extract season and episode
        if (idParts.length === 3) {
            seasonNumber = parseInt(idParts[1]);
            episodeNumber = parseInt(idParts[2]);
        }
        
        // Get subtitles for the requested content
        const subtitles = await client.getSubtitles(itemId, episodeNumber, seasonNumber);
        
        // Format the subtitles for Stremio
        const subtitlesList = subtitles.map(sub => ({
            id: sub.lang || 'unknown',
            url: sub.url,
            lang: sub.lang || 'unknown'
        }));
        
        return { subtitles: subtitlesList };
    } catch (error) {
        console.error("Subtitles error:", error);
        return { subtitles: [] };
    }
});

// Meta handler for detailed item information
builder.defineMetaHandler(async ({ type, id }) => {
    if (!auth.isAuthenticated()) {
        await auth.authenticate();
    }
    
    try {
        const itemId = id.replace('kp_', '');
        const itemData = await client.get(`items/${itemId}`);
        const item = itemData.item;
        
        // Basic meta object
        const meta = {
            id,
            type,
            name: item.title,
            poster: item.posters?.big || "",
            background: item.posters?.wide || "",
            description: item.plot,
            releaseInfo: item.year?.toString() || "",
            runtime: item.duration?.toString() || "",
            imdbRating: item.imdb_rating || null,
            year: item.year,
            country: item.countries?.map(c => c.title).join(", ") || "",
            genres: item.genres?.map(g => g.title) || [],
            cast: item.cast?.split(",").map(actor => actor.trim()) || [],
            director: item.director || "",
        };
        
        // Add videos/episodes for series
        if (type === "series" && item.seasons) {
            meta.videos = [];
            
            item.seasons.forEach((season, seasonIndex) => {
                if (season.episodes) {
                    season.episodes.forEach((episode, episodeIndex) => {
                        meta.videos.push({
                            id: `${id}:${seasonIndex+1}:${episodeIndex+1}`,
                            title: episode.title || `Episode ${episodeIndex+1}`,
                            season: seasonIndex+1,
                            episode: episodeIndex+1,
                            released: new Date(episode.added).toISOString()
                        });
                    });
                }
            });
        }
        
        return { meta };
    } catch (error) {
        console.error("Meta error:", error);
        return { meta: {} };
    }
});

function mapQualityLabel(quality) {
    // Map API quality values to Stremio quality values
    const qualityMap = {
        "1080p": "1080p",
        "720p": "720p",
        "480p": "480p",
        "360p": "360p"
    };
    
    return qualityMap[quality] || quality;
}

module.exports = builder.getInterface();
