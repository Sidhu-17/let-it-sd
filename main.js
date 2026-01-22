// Public Library - Songs here are visible to EVERYONE visiting your site.
// To add: Upload to 'music' folder on GitHub and add entry here.
const publicTracks = [
    // Example: { name: "Lost in Space", artist: "Nebula", url: "music/lost-in-space.mp3" },
];

// NOTE: Songs uploaded by users via the UI are saved in THEIR OWN browser (IndexedDB).
// They are NOT shared with other users. Only the songs in publicTracks are shared.

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

// IndexedDB Setup for Persistent Storage
const dbName = "LetItSD_DB";
const storeName = "songs";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
    }
};
request.onsuccess = (e) => {
    db = e.target.result;
    initApp();
};

async function initApp() {
    // 1. Load Public Tracks first
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

    // 2. Load Saved Tracks from IndexedDB
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
        const savedTracks = getAllRequest.result;
        savedTracks.forEach(track => {
            files.push({
                ...track,
                url: URL.createObjectURL(track.blob)
            });
        });

        updateTrackList();
        if (files.length > 0 && currentTrackIndex === -1) {
            loadTrack(0);
        }
    };
}

function handleFiles(selectedFiles) {
    if (!selectedFiles.length) return;

    pendingFiles = Array.from(selectedFiles).filter(file =>
        file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)
    );

    if (pendingFiles.length > 0) {
        saveFilesBtn.style.display = 'inline-block';
    }

    for (const file of pendingFiles) {
        const track = {
            id: Date.now() + Math.random(),
            name: file.name.replace(/\.[^/.]+$/, ""),
            size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
            url: URL.createObjectURL(file),
            file: file
        };
        files.push(track);
    }
    updateTrackList();
    if (currentTrackIndex === -1 && files.length > 0) {
        loadTrack(0);
    }
}

saveFilesBtn.addEventListener('click', async () => {
    for (const file of pendingFiles) {
        await saveTrackToDB(file);
    }
    saveFilesBtn.style.display = 'none';
    alert("Songs saved permanently to your browser library! They will stay here even if you refresh.");
});

async function saveTrackToDB(trackFile) {
    const track = {
        id: Date.now() + Math.random(),
        name: trackFile.name.replace(/\.[^/.]+$/, ""),
        size: (trackFile.size / (1024 * 1024)).toFixed(2) + ' MB',
        blob: trackFile,
        timestamp: Date.now()
    };

    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).add(track);
}

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
