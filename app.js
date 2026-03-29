/**
 * Alumni Connect Pro - App Logic
 */

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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

// Auth State Monitor
auth.onAuthStateChanged((u) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (u) {
        loginOverlay.style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const data = snap.val();
            user = {
                uid: u.uid,
                name: u.displayName,
                email: u.email,
                photo: u.photoURL,
                inst: data?.inst || "",
                year: data?.year || "",
                city: data?.city || "",
                studyingClass: data?.studyingClass || "",
                groupKey: data ? (data.inst + data.year).replace(/\s+/g,'').toUpperCase() : ""
            };
            updateUI();
            trackOnlineStatus();
        });
    } else {
        loginOverlay.style.display = "flex";
    }
});

function loginWithGoogle() {
    auth.signInWithPopup(provider).catch(err => alert("Login Error: " + err.message));
}

function updateUI() {
    if(!user) return;
    document.getElementById('header-user-name').innerText = user.name;
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('header-group-tag').innerText = user.inst ? "🎓 " + user.inst : "Complete Profile";
    
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.studyingClass;
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

// PROFILE LOGIC
function saveProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const sc = document.getElementById('p-class').value.trim();

    if(!inst || !year) return alert("Institution and Year are required to connect with batchmates!");

    db.ref('users/' + user.uid).update({
        inst, year, city, studyingClass: sc,
        name: user.name, photo: user.photo
    }).then(() => showToast("✅ Profile Updated Successfully!"));
}

// FEED LOGIC
function handleFeedPost() {
    const text = document.getElementById('msgInput').value.trim();
    if(!user.inst) return alert("Update profile first to post to your batch!");
    if(!text) return;

    db.ref('posts').push({
        uid: user.uid, name: user.name, photo: user.photo,
        msg: text, groupKey: user.groupKey,
        time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
    }).then(() => {
        document.getElementById('msgInput').value = "";
        showToast("Shared with batchmates! ❤️");
    });
}

db.ref('posts').limitToLast(20).on('value', snap => {
    const cont = document.getElementById('post-container'); cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(user && p.groupKey === user.groupKey) {
            cont.innerHTML = `
                <div class="card">
                    <div class="post-info">
                        <img src="${p.photo}">
                        <div><b>${p.name}</b><br><span class="post-meta">${p.time}</span></div>
                    </div>
                    <p style="margin:0; line-height:1.5;">${p.msg}</p>
                </div>` + cont.innerHTML;
        }
    });
});

// SEARCH & FRIENDS LOGIC
function searchAlumni() {
    const inst = document.getElementById('s-inst').value.toUpperCase();
    const year = document.getElementById('s-year').value;
    const city = document.getElementById('s-city').value.toUpperCase();
    const sClass = document.getElementById('s-class').value.toUpperCase();
    const res = document.getElementById('my-friends-list');
    res.innerHTML = "Searching...";

    db.ref('users').once('value', snap => {
        res.innerHTML = "<h4>Search Results</h4>";
        let found = false;
        snap.forEach(c => {
            const u = c.val();
            const uid = c.key;
            
            // Advanced Multi-filter Logic
            const matchInst = inst && u.inst?.toUpperCase().includes(inst);
            const matchYear = year && u.year === year;
            const matchCity = city && u.city?.toUpperCase().includes(city);
            const matchClass = sClass && u.studyingClass?.toUpperCase().includes(sClass);

            if(uid !== user.uid && (matchInst || matchYear || matchCity || matchClass)) {
                found = true;
                res.innerHTML += `
                    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <img src="${u.photo}" style="width:40px; height:40px; border-radius:50%;">
                            <div>
                                <b>${u.name}</b><br>
                                <small style="color:gray;">${u.city || 'Unknown City'} | ${u.studyingClass || 'Class Unknown'}</small>
                            </div>
                        </div>
                        <button class="btn btn-blue" style="width:auto; padding:6px 15px;" onclick="addFriend('${uid}', '${u.name}')">Connect</button>
                    </div>`;
            }
        });
        if(!found) res.innerHTML = "<p style='text-align:center; color:gray;'>No friends found matching these details.</p>";
    });
}

function addFriend(fUid, fName) {
    db.ref('friends/' + user.uid + '/' + fUid).set({ name: fName });
    db.ref('friends/' + fUid + '/' + user.uid).set({ name: user.name });
    showToast("🤝 Connected with " + fName);
}

function loadMyFriends() {
    db.ref('friends/' + user.uid).on('value', snap => {
        const l = document.getElementById('my-friends-list'); l.innerHTML = "<h4>My Connections</h4>";
        snap.forEach(c => {
            const fUid = c.key; const fData = c.val();
            l.innerHTML += `
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>👤 ${fData.name}</b> <span id="st-${fUid}" style="font-size:10px; margin-left:5px;"></span></div>
                    <button class="btn btn-blue" style="width:auto; padding:6px 15px;" onclick="openChat('${fUid}', '${fData.name}')">Chat</button>
                </div>`;
            db.ref('status/' + fUid).on('value', s => {
                const el = document.getElementById('st-'+fUid);
                if(el) {
                    const isOnline = s.val()?.state === 'online';
                    el.innerText = isOnline ? "● Online" : "";
                    el.style.color = isOnline ? "#2ec4b6" : "transparent";
                }
            });
        });
    });
}

// CHAT & REAL-TIME STATUS
function trackOnlineStatus() {
    const sRef = db.ref('status/' + user.uid);
    db.ref('.info/connected').on('value', snap => {
        if(!snap.val()) return;
        sRef.onDisconnect().set({ state: 'offline' }).then(() => sRef.set({ state: 'online' }));
    });
}

function openChat(fUid, fName) {
    currentChatFriendUID = fUid;
    document.getElementById('chat-with-name').innerText = fName;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function sendPrivateMessage() {
    const msg = document.getElementById('privateMsgInput').value.trim();
    if(!msg) return;
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).push({ sender: user.uid, text: msg });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const chatId = user.uid < currentChatFriendUID ? `${user.uid}_${currentChatFriendUID}` : `${currentChatFriendUID}_${user.uid}`;
    db.ref('private_messages/' + chatId).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender===user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function logout() { auth.signOut().then(() => location.reload()); }
