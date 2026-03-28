/**
 * Alumni Connect Pro - Global Connectivity & Mental Well-being
 * Core Logic with Firebase Authentication & Real-time Database
 */

// Firebase Configuration
const firebaseConfig = { 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

/**
 * Monitor Authentication State
 * Ensures high security by verifying user identity via Google
 */
auth.onAuthStateChanged((u) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (u) {
        loginOverlay.style.display = "none";
        
        // Fetch user profile from Database using UID (Unique ID for Privacy)
        db.ref('users/' + u.uid).once('value', snap => {
            const data = snap.val();
            user = {
                uid: u.uid,
                name: u.displayName,
                email: u.email,
                photo: u.photoURL,
                inst: data ? data.inst : "",
                year: data ? data.year : "",
                groupKey: data ? (data.inst + data.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            
            updateUI();
            trackOnlineStatus();
            listenToRequests();
            listenToChatNotifs();
        });
    } else {
        loginOverlay.style.display = "flex";
    }
});

/**
 * Google Sign-In Handler
 */
function loginWithGoogle() {
    auth.signInWithPopup(provider).catch(err => {
        console.error("Auth Error:", err);
        showToast("Login Failed: " + err.message, "#ff4d6d");
    });
}

/**
 * Update UI Elements with User Data
 */
function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Setup Profile";
    
    // Settings Page Info
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
}

/**
 * UI Navigation Logic
 */
function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

/**
 * Toast Notifications
 */
function showToast(msg, color = "#333") {
    const x = document.getElementById("toast");
    x.innerText = msg; 
    x.style.backgroundColor = color;
    x.className = "show";
    setTimeout(() => x.className = "", 3000);
}

/**
 * Update Profile to Database
 */
function saveProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();

    if(!inst || !year) return showToast("Please fill Institution & Year");

    db.ref('users/' + user.uid).update({
        inst, year, city,
        name: user.name,
        photo: user.photo,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showToast("✅ Profile Synced Successfully!", "#2ec4b6");
        setTimeout(() => location.reload(), 1000);
    });
}

/**
 * Feed Logic - Share Memories
 */
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    const file = document.getElementById('imageInput').files[0];
    
    if(!user.inst) return showToast("Please update profile first!");

    const postData = {
        uid: user.uid,
        name: user.name,
        photo: user.photo,
        msg: text,
        groupKey: user.groupKey,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    };

    if(file) {
        const reader = new FileReader();
        reader.onload = () => { 
            postData.imageUrl = reader.result; 
            savePostToFirebase(postData); 
        };
        reader.readAsDataURL(file);
    } else if(text) {
        savePostToFirebase(postData);
    }
}

function savePostToFirebase(data) {
    db.ref('posts').push(data).then(() => {
        document.getElementById('msgInput').value = "";
        document.getElementById('imageInput').value = "";
        document.getElementById('preview-post').style.display = "none";
        showToast("Memory Shared! ❤️", "#4361ee");
    });
}

// Real-time Feed Listener
db.ref('posts').limitToLast(50).on('value', snap => {
    const container = document.getElementById('post-container'); 
    container.innerHTML = "";
    snap.forEach(child => {
        const post = child.val();
        if(user && post.groupKey === user.groupKey) {
            let imgHtml = post.imageUrl ? `<img src="${post.imageUrl}" class="feed-img">` : "";
            container.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${post.photo}" style="width:32px; height:32px; border-radius:50%;">
                        <div>
                            <div style="font-weight:bold; font-size:14px;">${post.name}</div>
                            <small style="color:gray;">${post.time}</small>
                        </div>
                    </div>
                    <p style="margin:5px 0; line-height:1.4;">${post.msg || ""}</p>
                    ${imgHtml}
                </div>` + container.innerHTML;
        }
    });
});

/**
 * Friends & Discovery Logic
 */
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const res = document.getElementById('my-friends-list'); 
    res.innerHTML = "Searching...";

    db.ref('users').once('value', snap => {
        res.innerHTML = "<h4>Discovery Results</h4>";
        snap.forEach(child => {
            const u = child.val();
            const uid = child.key;
            if(uid !== user.uid && (u.inst?.toUpperCase().includes(inst) || u.year === year)) {
                res.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <img src="${u.photo}" style="width:35px; height:35px; border-radius:50%;">
                            <b>${u.name}</b>
                        </div>
                        <button class="btn btn-blue" style="width:auto; padding:6px 15px;" onclick="sendRequest('${uid}', '${u.name}')">Add</button>
                    </div>`;
            }
        });
    });
}

function sendRequest(targetUid, targetName) {
    db.ref('requests/' + targetUid + '/' + user.uid).set({ 
        name: user.name, 
        photo: user.photo 
    }).then(() => showToast("📩 Friend Request Sent!", "#4361ee"));
}

function listenToRequests() {
    db.ref('requests/' + user.uid).on('value', snap => {
        const dot = document.getElementById('friend-dot');
        const area = document.getElementById('req-area');
        const list = document.getElementById('req-list');
        if(snap.exists()) {
            dot.style.display = "block"; 
            area.style.display = "block"; 
            list.innerHTML = "";
            snap.forEach(child => {
                const req = child.val();
                list.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <img src="${req.photo}" style="width:25px; height:25px; border-radius:50%;">
                            <span><b>${req.name}</b></span>
                        </div>
                        <button class="btn btn-blue" style="width:auto; padding:5px 12px; font-size:12px;" onclick="acceptRequest('${child.key}', '${req.name}')">Accept</button>
                    </div>`;
            });
        } else { 
            dot.style.display = "none"; 
            area.style.display = "none"; 
        }
    });
}

function acceptRequest(fUid, fName) {
    db.ref('friends/'+user.uid+'/'+fUid).set({ name: fName });
    db.ref('friends/'+fUid+'/'+user.uid).set({ name: user.name });
    db.ref('requests/'+user.uid+'/'+fUid).remove().then(() => {
        showToast("🤝 Connected with " + fName, "#2ec4b6");
    });
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const container = document.getElementById('my-friends-list'); 
        container.innerHTML = "<h4>My Connections</h4>";
        snap.forEach(child => {
            const fUid = child.key;
            const fData = child.val();
            container.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>👤 ${fData.name} <span id="st-${fUid}" style="font-size:10px; margin-left:5px;"></span></b>
                    <button class="btn btn-blue" style="width:auto; padding:6px 18px;" onclick="openChat('${fUid}', '${fData.name}')">Chat</button>
                </div>`;
            
            // Listen for Friend's Online Status
            db.ref('status/' + fUid).on('value', statusSnap => {
                const statusEl = document.getElementById('st-'+fUid);
                if(statusEl) {
                    const isOnline = statusSnap.val()?.state === 'online';
                    statusEl.innerText = isOnline ? "● Online" : "";
                    statusEl.style.color = isOnline ? "#2ec4b6" : "transparent";
                }
            });
        });
    });
}

/**
 * Privacy-focused Chat & Online Status
 */
function trackOnlineStatus() {
    const statusRef = db.ref('status/' + user.uid);
    db.ref('.info/connected').on('value', snap => {
        if(!snap.val()) return;
        statusRef.onDisconnect().set({ 
            state: 'offline', 
            lastSeen: firebase.database.ServerValue.TIMESTAMP 
        }).then(() => {
            statusRef.set({ state: 'online' });
        });
    });
}

function openChat(fUid, fName) {
    currentChatFriendUID = fUid;
    const title = document.getElementById('chat-with-name');
    document.getElementById('chat-window').style.display = "flex";
    
    db.ref('status/' + fUid).on('value', snap => {
        const s = snap.val();
        title.innerHTML = (s?.state === 'online') 
            ? `${fName} <br><small style="color:#2ec4b6;">● Active Now</small>` 
            : `${fName} <br><small style="color:gray;">Offline</small>`;
    });

    db.ref('chat_notifications/' + user.uid + '/' + fUid).remove();
    loadMessages();
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    
    db.ref('private_messages/' + chatId).push({ 
        sender: user.uid, 
        text: msg,
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    });
    
    db.ref('chat_notifications/' + currentChatFriendUID + '/' + user.uid).set("new_msg");
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const container = document.getElementById('chat-messages'); 
        container.innerHTML = "";
        snap.forEach(child => {
            const m = child.val();
            container.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

function listenToChatNotifs() {
    db.ref('chat_notifications/' + user.uid).on('value', snap => {
        if(snap.exists()) showToast("💬 New Private Message Received!");
    });
}

/**
 * Utility Functions
 */
function previewFile(inputId, imgId) {
    const file = document.getElementById(inputId).files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            const img = document.getElementById(imgId);
            img.src = e.target.result; 
            img.style.display = "block"; 
        };
        reader.readAsDataURL(file);
    }
}

function closeChat() { 
    document.getElementById('chat-window').style.display = "none"; 
}

function logout() { 
    auth.signOut().then(() => { 
        localStorage.clear(); 
        location.reload(); 
    }); 
}
