const { serveHTTP } = require("stremio-addon-sdk");
const addonInterface = require("./addon");
const http = require('http');

// Try to use the port from environment variables or default to 7000
const PORT = process.env.PORT || 7000;
const MAX_PORT_ATTEMPTS = 10;

// Function to find an available port
function findAvailablePort(startPort, callback) {
    let currentPort = startPort;
    let attempts = 0;
    
    function tryPort(port) {
        if (attempts >= MAX_PORT_ATTEMPTS) {
            console.error(`Could not find an available port after ${attempts} attempts.`);
            process.exit(1);
            return;
        }
        
        attempts++;
        
        const server = http.createServer();
        server.listen(port, () => {
            server.once('close', () => {
                callback(port);
            });
            server.close();
        });
        
        server.on('error', () => {
            console.log(`Port ${port} is in use, trying ${port + 1}...`);
            tryPort(port + 1);
        });
    }
    
    tryPort(currentPort);
}

// Find an available port and start the server
findAvailablePort(PORT, (port) => {
    serveHTTP(addonInterface, { port });
    console.log(`KinoPub Stremio addon running at http://127.0.0.1:${port}`);
    console.log(`To install in Stremio, use: http://127.0.0.1:${port}/manifest.json`);
});
