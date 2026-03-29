/**
 * Alumni Connect Pro - Global Connectivity & Mental Well-being
 * Full Logic with Verified Firebase Configuration
 */

// 1. Firebase Configuration (Your specific credentials)
const firebaseConfig = {
  apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
  authDomain: "class-connect-b58f0.firebaseapp.com",
  databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "class-connect-b58f0",
  storageBucket: "class-connect-b58f0.firebasestorage.app",
  messagingSenderId: "836461719745",
  appId: "1:836461719745:web:f827862e4db4954626a440",
  measurementId: "G-8QT4VQ5YW5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

/**
 * 2. Authentication Monitoring
 * Verified Identity via Google to ensure privacy
 */
auth.onAuthStateChanged((u) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (u) {
        // User is logged in successfully
        loginOverlay.style.display = "none";
        
        // Use UID for secure data handling
        db.ref('users/' + u.uid).on('value', snap => {
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
        // User is logged out - Show Login Screen
        loginOverlay.style.display = "flex";
    }
});

/**
 * 3. Login with Google Handler
 */
function loginWithGoogle() {
    console.log("Attempting Google Login...");
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Login Success:", result.user.displayName);
        })
        .catch((err) => {
            console.error("Login Error:", err);
            alert("Login Failed: " + err.message + "\nCheck if pop-ups are allowed.");
        });
}

/**
 * 4. UI Update Logic
 */
function updateUI() {
    if(!user) return;
    // Header updates
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Setup Profile";
    
    // Settings/Profile updates
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst || "";
    document.getElementById('p-year').value = user.year || "";
}

/**
 * 5. Feed & Memories Management
 */
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Please update your School/College in Settings first!");
    if(!text) return;

    db.ref('posts').push({
        uid: user.uid,
        name: user.name,
        photo: user.photo,
        msg: text,
        groupKey: user.groupKey,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        showToast("Memory Shared with your batch! ❤️");
    });
}

// Real-time Feed Listener (Shows only same batch posts)
db.ref('posts').limitToLast(30).on('value', snap => {
    const container = document.getElementById('post-container'); 
    container.innerHTML = "";
    snap.forEach(child => {
        const post = child.val();
        if(user && post.groupKey === user.groupKey) {
            container.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${post.photo}" style="width:32px; height:32px; border-radius:50%;">
                        <div>
                            <div style="font-weight:bold; font-size:14px;">${post.name}</div>
                            <small style="color:gray;">${post.time}</small>
                        </div>
                    </div>
                    <p style="margin:5px 0;">${post.msg}</p>
                </div>` + container.innerHTML;
        }
    });
});

/**
 * 6. Discovery & Friend Connections
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
                        <button class="btn btn-blue" style="width:auto; padding:6px 15px;" onclick="addFriend('${uid}', '${u.name}')">Connect</button>
                    </div>`;
            }
        });
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    showToast("🤝 Successfully connected with " + fName);
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const list = document.getElementById('my-friends-list'); 
        list.innerHTML = "<h4>My Batchmates</h4>";
        snap.forEach(child => {
            const fUid = child.key; const fData = child.val();
            list.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <b>👤 ${fData.name} <span id="st-${fUid}" style="font-size:10px; margin-left:5px;"></span></b>
                    <button class="btn btn-blue" style="width:auto; padding:6px 18px;" onclick="openChat('${fUid}', '${fData.name}')">Chat</button>
                </div>`;
            
            // Check online status of friend
            db.ref('status/' + fUid).on('value', s => {
                const el = document.getElementById('st-'+fUid);
                if(el) {
                    const online = s.val()?.state === 'online';
                    el.innerText = online ? "● Online" : "";
                    el.style.color = "#2ec4b6";
                }
            });
        });
    });
}

/**
 * 7. Secure Messaging & Online Status
 */
function trackOnlineStatus() {
    const statusRef = db.ref('status/' + user.uid);
    db.ref('.info/connected').on('value', snap => {
        if(!snap.val()) return;
        statusRef.onDisconnect().set({ state: 'offline' }).then(() => {
            statusRef.set({ state: 'online' });
        });
    });
}

function openChat(fUid, fName) {
    currentChatFriendUID = fUid;
    document.getElementById('chat-with-name').innerText = fName;
    document.getElementById('chat-window').style.display = "flex";
    db.ref('chat_notifications/' + user.uid + '/' + fUid).remove();
    loadMessages();
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).push({ sender: user.uid, text: msg, timestamp: firebase.database.ServerValue.TIMESTAMP });
    db.ref('chat_notifications/' + currentChatFriendUID + '/' + user.uid).set("new");
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

/**
 * 8. Profile & Utilities
 */
function saveProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    if(!inst || !year) return alert("Please enter School/College and Year.");

    db.ref('users/' + user.uid).update({ inst, year, name: user.name, photo: user.photo })
    .then(() => showToast("✅ Profile Updated Successfully!"));
}

function showToast(msg) {
    const x = document.getElementById("toast");
    x.innerText = msg; x.className = "show";
    setTimeout(() => x.className = "", 3000);
}

function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadMyFriends();
}

function listenToChatNotifs() {
    db.ref('chat_notifications/' + user.uid).on('value', snap => {
        if(snap.exists()) showToast("💬 New message from a batchmate!");
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function logout() { auth.signOut().then(() => location.reload()); }
