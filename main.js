import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * 🛰️ GLOBAL CLOUD CONFIGURATION
 * Paste your Firebase Config below to activate global sharing!
 */
const firebaseConfig = {
    apiKey: "PASTE_YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// Initialize Firebase
let db, storage;
let isCloudActive = false;

if (firebaseConfig.apiKey !== "PASTE_YOUR_API_KEY_HERE") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    isCloudActive = true;
}

// Public Library (Hardcoded GitHub Tracks)
const publicTracks = [
    // 🎵 ADD YOUR SONGS HERE TO SHARE WITH EVERYONE!
    // Format: { name: "Song Name", artist: "Your Name", url: "music/your-file.mp3" },
    { name: "Welcome to Let It SD", artist: "System", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
];

const files = [];
let currentLibraryTab = 'public'; // 'public' or 'private'
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
const tabGlobal = document.getElementById('tabGlobal');
const tabPrivate = document.getElementById('tabPrivate');
const uploadOverlay = document.getElementById('uploadOverlay');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadStatus = document.getElementById('uploadStatus');
canvas = document.getElementById('visualizer');
canvasCtx = canvas.getContext('2d');

// Tab Switching Logic
tabGlobal.addEventListener('click', () => switchTab('public'));
tabPrivate.addEventListener('click', () => switchTab('private'));

function switchTab(tab) {
    currentLibraryTab = tab;
    tabGlobal.classList.toggle('active', tab === 'public');
    tabPrivate.classList.toggle('active', tab === 'private');
    updateTrackList();
}

// Initialize Visualizer
function initVisualizer() {
    if (audioContext) return;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();

    const source = audioContext.createMediaElementSource(audioElement);
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

        const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');

        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}

// Handle File Selection
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

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
let localDb;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = (e) => {
    localDb = e.target.result;
    if (!localDb.objectStoreNames.contains(storeName)) {
        localDb.createObjectStore(storeName, { keyPath: "id" });
    }
};
request.onsuccess = (e) => {
    localDb = e.target.result;
    initApp();
};

async function initApp() {
    // 1. Load Public Tracks (This makes them visible to EVERYONE)
    publicTracks.forEach(track => {
        files.push({
            id: 'public-' + Math.random(),
            name: track.name,
            artist: track.artist || 'Let It SD Artist',
            url: track.url,
            isPublic: true,
            size: 'Featured'
        });
    });

    // 2. Load Private Saved Tracks (Only for the current user)
    loadSavedTracksFromDB();

    // 3. Optional: Sync from Cloud (If you decide to add Firebase later)
    if (isCloudActive) {
        syncGlobalTracks();
    }
}

function loadSavedTracksFromDB() {
    const tx = localDb.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
        const savedTracks = getAllRequest.result;
        savedTracks.forEach(track => {
            if (!files.find(f => f.id === track.id)) {
                files.push({
                    ...track,
                    url: URL.createObjectURL(track.blob),
                    isPublic: false
                });
            }
        });

        updateTrackList();
        if (files.length > 0 && currentTrackIndex === -1) {
            loadTrack(0);
        }
    };
}

function syncGlobalTracks() {
    const q = query(collection(db, "global_tracks"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                if (!files.find(f => f.id === change.doc.id)) {
                    files.push({
                        id: change.doc.id,
                        name: data.name,
                        artist: data.artist || 'Global User',
                        url: data.url,
                        isPublic: true,
                        isHardcoded: false,
                        size: data.size
                    });
                }
            }
        });
        updateTrackList();
    });
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
            file: file,
            isPublic: false
        };
        files.push(track);
    }

    // Auto switch to private tab to show uploaded tracks
    switchTab('private');

    if (currentTrackIndex === -1 && files.length > 0) {
        loadTrack(files.length - 1);
    }
}

saveFilesBtn.addEventListener('click', async () => {
    const choice = confirm("Do you want to share these songs GLOBALLY with the world?\n\n- OK: Share with everyone (Cloud)\n- Cancel: Keep private in this browser");

    if (choice) {
        if (!isCloudActive) {
            alert("Firebase not configured! Please paste your config in main.js first.");
            return;
        }
        for (const file of pendingFiles) {
            await uploadToCloud(file);
        }
    } else {
        for (const file of pendingFiles) {
            await saveTrackToDB(file);
        }
        alert("Songs saved to your Private Storage.");
    }

    saveFilesBtn.style.display = 'none';
    pendingFiles = [];
});

async function uploadToCloud(file) {
    uploadOverlay.style.display = 'flex';
    const storageRef = ref(storage, 'music/' + Date.now() + '_' + file.name);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgressBar.style.width = progress + '%';
                uploadStatus.textContent = `Uploading: ${Math.round(progress)}%`;
            },
            (error) => {
                console.error(error);
                uploadOverlay.style.display = 'none';
                reject(error);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, "global_tracks"), {
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    url: downloadURL,
                    size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                    timestamp: Date.now()
                });
                uploadOverlay.style.display = 'none';
                resolve();
            }
        );
    });
}

async function saveTrackToDB(trackFile) {
    const track = {
        id: Date.now() + Math.random(),
        name: trackFile.name.replace(/\.[^/.]+$/, ""),
        size: (trackFile.size / (1024 * 1024)).toFixed(2) + ' MB',
        blob: trackFile,
        timestamp: Date.now()
    };

    const tx = localDb.transaction(storeName, "readwrite");
    tx.objectStore(storeName).add(track);
}

function updateTrackList() {
    trackList.innerHTML = '';

    const filteredTracks = files.filter(f => currentLibraryTab === 'public' ? f.isPublic : !f.isPublic);

    if (filteredTracks.length === 0) {
        trackList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>${currentLibraryTab === 'public' ? 'No global hits yet.' : 'Your private library is empty.'}</p>
            </div>
        `;
        return;
    }

    filteredTracks.forEach((track, index) => {
        const originalIndex = files.indexOf(track);
        const div = document.createElement('div');
        div.className = `track-item ${originalIndex === currentTrackIndex ? 'active' : ''}`;
        div.innerHTML = `
            <div class="track-info">
                <div class="track-name">${track.name}</div>
                <div class="track-meta">${track.artist || 'Unknown Artist'} • ${track.size}</div>
            </div>
            <i class="fa-solid ${originalIndex === currentTrackIndex && isPlaying ? 'fa-pause' : 'fa-play'}"></i>
        `;
        div.onclick = () => {
            if (originalIndex === currentTrackIndex) {
                togglePlay();
            } else {
                loadTrack(originalIndex);
                playTrack();
            }
        };
        trackList.appendChild(div);
    });
}

function loadTrack(index) {
    if (index < 0 || index >= files.length) return;

    currentTrackIndex = index;
    const track = files[index];

    audioElement.src = track.url;
    trackTitle.textContent = track.name;
    trackArtist.textContent = track.artist || 'Unknown Artist';

    if (track.url.startsWith('blob:')) {
        trackArt.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="color: var(--primary)"></i>';
    } else {
        trackArt.innerHTML = '<i class="fa-solid fa-music"></i>';
    }

    updateTrackList();

    audioElement.onloadedmetadata = () => {
        durationEl.textContent = formatTime(audioElement.duration);
        progressBar.max = audioElement.duration;
    };
}

function togglePlay() {
    if (files.length === 0) return;
    if (isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
}

function playTrack() {
    initVisualizer();
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    audioElement.play();
    isPlaying = true;
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    updateTrackList();
}

function pauseTrack() {
    audioElement.pause();
    isPlaying = false;
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    updateTrackList();
}

// Controls
playPauseBtn.onclick = togglePlay;

document.getElementById('prevBtn').onclick = () => {
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) newIndex = files.length - 1;
    loadTrack(newIndex);
    playTrack();
};

document.getElementById('nextBtn').onclick = () => {
    let newIndex = (currentTrackIndex + 1) % files.length;
    loadTrack(newIndex);
    playTrack();
};

audioElement.ontimeupdate = () => {
    progressBar.value = audioElement.currentTime;
    currentTimeEl.textContent = formatTime(audioElement.currentTime);
};

progressBar.oninput = () => {
    audioElement.currentTime = progressBar.value;
};

volumeBar.oninput = () => {
    audioElement.volume = volumeBar.value;
};

audioElement.onended = () => {
    let newIndex = (currentTrackIndex + 1) % files.length;
    loadTrack(newIndex);
    playTrack();
};

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * GLOBAL SHARING (FIREBASE)
 * Once you have your Firebase config, paste it below to enable Global Uploads!
 */
/*
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
*/
