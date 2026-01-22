// Public Library - Add your song filenames here!
// Place songs in the 'music' folder.
const publicTracks = [
    // Example: { name: "Lost in Space", artist: "Nebula", url: "music/lost-in-space.mp3" },
];

const files = [];
let currentTrackIndex = -1;
let isPlaying = false;
let audioContext, analyser, dataArray, canvas, canvasCtx, animationId;

// DOM Elements
const audioElement = document.getElementById('audioElement');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const trackList = document.getElementById('trackList');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const volumeBar = document.getElementById('volumeBar');
const trackArt = document.getElementById('trackArt');
const trackCountEl = document.getElementById('trackCount');
canvas = document.getElementById('visualizer');
canvasCtx = canvas.getContext('2d');

// Load Public Music
function loadPublicMusic() {
    publicTracks.forEach(track => {
        files.push({
            id: 'public-' + Math.random(),
            name: track.name,
            artist: track.artist,
            url: track.url,
            isPublic: true,
            size: 'Public'
        });
    });
    updateTrackList();
    if (files.length > 0) loadTrack(0);
}

window.addEventListener('load', loadPublicMusic);

// Initialize Visualizer
function initVisualizer() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audioElement);
    analyser = audioContext.createAnalyser();

    source.connect(analyser);
    analyser.connect(audioContext.destination);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    draw();
}

function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] / 2;

        const r = 139 + (i * 2);
        const g = 92;
        const b = 246;

        canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}

// Handle File Selection
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

const saveFilesBtn = document.getElementById('saveFilesBtn');
let pendingFiles = [];

function handleFiles(selectedFiles) {
    if (!selectedFiles.length) return;

    pendingFiles = Array.from(selectedFiles);
    saveFilesBtn.style.display = 'inline-block';

    for (const file of selectedFiles) {
        if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
            const track = {
                id: Date.now() + Math.random(),
                name: file.name.replace(/\.[^/.]+$/, ""),
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                url: URL.createObjectURL(file),
                file: file
            };
            files.push(track);
        }
    }
    updateTrackList();
    if (currentTrackIndex === -1 && files.length > 0) {
        loadTrack(0);
    }
}

saveFilesBtn.addEventListener('click', () => {
    alert("Songs added to session library! To make them public for your audience, upload them to the 'music' folder on GitHub.");
    saveFilesBtn.style.display = 'none';
});

function updateTrackList() {
    trackCountEl.textContent = `${files.length} tracks`;
    if (files.length === 0) {
        trackList.innerHTML = '<div class="empty-state"><p>Your library is empty</p></div>';
        return;
    }

    trackList.innerHTML = files.map((track, index) => `
        <div class="track-item ${index === currentTrackIndex ? 'active' : ''}" onclick="loadTrack(${index})">
            <i class="fa-solid ${index === currentTrackIndex && isPlaying ? 'fa-volume-high' : 'fa-play'}"></i>
            <div class="track-info">
                <span class="t-name">${track.name}</span>
                <span class="t-size">${track.size}</span>
            </div>
        </div>
    `).join('');
}

function loadTrack(index) {
    if (index < 0 || index >= files.length) return;

    // Revoke old URL if switching
    if (currentTrackIndex !== -1 && files[currentTrackIndex].url) {
        // Optional: URL.revokeObjectURL(files[currentTrackIndex].url);
    }

    currentTrackIndex = index;
    const track = files[index];

    audioElement.src = track.url;
    trackTitle.textContent = track.name;
    trackArtist.textContent = 'User Upload';

    updateTrackList();
    playTrack();
}

function playTrack() {
    initVisualizer();
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    audioElement.play().catch(e => console.error("Playback failed:", e));
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    trackArt.classList.add('playing');
}

function pauseTrack() {
    audioElement.pause();
    isPlaying = false;
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    trackArt.classList.remove('playing');
}

// Controls
playPauseBtn.addEventListener('click', () => {
    if (currentTrackIndex === -1) return;
    if (isPlaying) pauseTrack();
    else playTrack();
});

document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentTrackIndex > 0) loadTrack(currentTrackIndex - 1);
});

document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentTrackIndex < files.length - 1) loadTrack(currentTrackIndex + 1);
});

// Audio Progress
audioElement.addEventListener('timeupdate', () => {
    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.value = isFinite(progress) ? progress : 0;

    currentTimeEl.textContent = formatTime(audioElement.currentTime);
    durationEl.textContent = formatTime(audioElement.duration);
});

progressBar.addEventListener('input', () => {
    const time = (progressBar.value / 100) * audioElement.duration;
    audioElement.currentTime = time;
});

volumeBar.addEventListener('input', () => {
    audioElement.volume = volumeBar.value;
});

audioElement.addEventListener('ended', () => {
    if (currentTrackIndex < files.length - 1) {
        loadTrack(currentTrackIndex + 1);
    } else {
        pauseTrack();
    }
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
