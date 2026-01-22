const files = [];
let currentTrackIndex = -1;
let isPlaying = false;

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

function handleFiles(selectedFiles) {
    for (const file of selectedFiles) {
        if (file.type === 'audio/mpeg' || file.type === 'audio/wav' || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
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
    
    currentTrackIndex = index;
    const track = files[index];
    
    audioElement.src = track.url;
    trackTitle.textContent = track.name;
    trackArtist.textContent = 'Uploaded Audio';
    
    updateTrackList();
    playTrack();
}

function playTrack() {
    audioElement.play();
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
    loadTrack(currentTrackIndex - 1);
});

document.getElementById('nextBtn').addEventListener('click', () => {
    loadTrack(currentTrackIndex + 1);
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
    loadTrack(currentTrackIndex + 1);
});

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}
