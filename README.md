# Let it SD - Premium Music Player

A sleek, modern music player for the web with public audience support.

## Features
- **Visualizer**: Real-time high-end audio visualizer.
- **Public Library**: Auto-loads songs from the `/music` folder for your audience.
- **User Uploads**: Support for drag-and-drop MP3/WAV files.
- **Modern Interface**: Glassmorphism design with dynamic background blobs.

## How to make Music Public for your Audience
1.  **Place your songs**: Open the `music` folder in `c:/sd/music/` and paste your MP3/WAV files there.
2.  **Update the list**: Open `main.js` and find the `publicTracks` array at the top.
3.  **Add your files**: Add an entry for each song like this:
    ```javascript
    const publicTracks = [
        { name: "My Awesome Song", artist: "Artist Name", url: "music/my-song.mp3" },
    ];
    ```
4.  **Re-upload**: Re-upload the whole folder to **Vercel** or **Cloudflare Pages**.

*Note: Your audience will now see and hear these songs as soon as they visit your site!*
