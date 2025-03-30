# Stremio KinoPub Addon

Unofficial KinoPub addon for Stremio that allows you to access KinoPub content through Stremio.

## Features

- Browse KinoPub movies and TV shows
- Search for specific titles
- Stream content in various qualities
- Multiple audio track support
- Subtitle selection for videos
- Automatic authentication handling

## Installation

### Local Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/stremio.kino.pub.git
   cd stremio.kino.pub
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the addon:
   ```
   npm start
   ```

4. Add the addon to Stremio:
   - Open Stremio
   - Go to the addons page
   - Click "Add addon" at the top right
   - Enter the URL shown in the console (e.g., `http://127.0.0.1:7000/manifest.json`) in the "Addon URL" field
   - Click "Install"

### Port Configuration

By default, the addon will try to use port 7000. If this port is already in use, it will automatically try the next available port.

You can also set a specific port using the PORT environment variable:

### Remote Installation

If you deploy this addon to a server, you can install it in Stremio by adding the URL:
`https://your-domain.com/manifest.json`

## Authentication

When you first use the addon, you'll need to authenticate with your KinoPub account:

1. The addon will open a browser window with the KinoPub authentication page
2. Enter the displayed code on that page
3. Log in with your KinoPub credentials
4. The addon will automatically receive the access token and start working

## Audio and Subtitle Selection

The addon provides support for multiple audio tracks and subtitles:

- **Audio Tracks**: If a video has multiple audio tracks (e.g., different languages), they will be available through the player's audio track menu.
- **Subtitles**: Videos with subtitle options will show them in the player's subtitle menu.

Note: The availability of these features depends on the player you're using with Stremio and whether the content has multiple audio tracks or subtitles.

## Development

To modify the addon:

1. Edit the files in the repository
2. Restart the server to apply changes
3. Clear Stremio cache if needed

## Important Disclaimer

This is an unofficial addon created by a third-party developer and is not affiliated with, endorsed by, or in any way connected to KinoPub or Stremio. This addon is provided for educational and personal use only.

The developer of this addon does not host, distribute, or provide access to any copyrighted content. This addon merely acts as a bridge between the KinoPub service and the Stremio application for users who have legitimate access to both services.

Users are responsible for ensuring they have the appropriate rights and subscriptions to access any content through the KinoPub service. The usage of this addon should comply with the terms of service of both KinoPub and Stremio, as well as all applicable laws in your jurisdiction.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
