const firebaseConfig = {
    apiKey: "AIzaSyAWZ2ky33M2U5xSWL-XSkU32y25U-Bwyrc",
    authDomain: "class-connect-b58f0.firebaseapp.com",
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "class-connect-b58f0",
    storageBucket: "class-connect-b58f0.appspot.com",
    messagingSenderId: "836461719745",
    appId: "1:836461719745:web:f827862e4db4954626a440"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let user = null;
let currentChatFriendUID = "";

// --- AUTH ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { uid: u.uid, name: u.displayName, photo: d?.photo || u.photoURL, inst: d?.inst||"", year: d?.year||"" };
            updateUI(u);
            loadFeed();
            listenForRequests(); // రిక్వెస్ట్ ల కోసం వెతకడం
        });
    } else {
        document.getElementById('login-overlay').style.display = "flex";
    }
});

function updateUI(u) {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
}

// --- FRIEND REQUEST LOGIC ---
function sendFriendRequest(targetUID, targetName) {
    db.ref('friend_requests/' + targetUID + '/' + user.uid).set({
        fromName: user.name,
        time: Date.now()
    }).then(() => showToast("Request sent to " + targetName));
}

function listenForRequests() {
    db.ref('friend_requests/' + user.uid).on('value', snap => {
        const list = document.getElementById('requests-list');
        const section = document.getElementById('requests-section');
        const dot = document.getElementById('request-dot');
        list.innerHTML = "";
        if (snap.exists()) {
            section.style.display = "block";
            dot.style.display = "block";
            snap.forEach(s => {
                const req = s.val();
                list.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span><b>${req.fromName}</b></span>
                    <button class="btn-blue" style="width:auto; padding:5px 10px;" onclick="acceptFriend('${s.key}')">Accept</button>
                </div>`;
            });
        } else {
            section.style.display = "none";
            dot.style.display = "none";
        }
    });
}

function acceptFriend(friendUID) {
    db.ref('friends/' + user.uid + '/' + friendUID).set(true);
    db.ref('friends/' + friendUID + '/' + user.uid).set(true);
    db.ref('friend_requests/' + user.uid + '/' + friendUID).remove();
    showToast("Friend Added!");
}

// --- SEARCH ---
function searchAlumni() {
    const sInst = document.getElementById('s-inst').value.toUpperCase();
    const sYear = document.getElementById('s-year').value;
    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "<h4>Results</h4>";
        snap.forEach(c => {
            const u = c.val();
            if(c.key === user.uid) return;
            if((u.inst && u.inst.toUpperCase().includes(sInst)) || u.year == sYear) {
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst}</small></div>
                    <button class="btn-blue" style="width:auto; padding:8px 15px;" onclick="checkAndChat('${c.key}','${u.name}')">Chat/Add</button>
                </div>`;
            }
        });
    });
}

function checkAndChat(uid, name) {
    db.ref('friends/' + user.uid + '/' + uid).once('value', snap => {
        if(snap.exists()) {
            openChat(uid, name);
        } else {
            if(confirm("Send friend request to start chat?")) {
                sendFriendRequest(uid, name);
            }
        }
    });
}

// --- CHAT ---
function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    loadMessages();
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}

function loadMessages() {
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/'+cid).on('value', snap => {
        const c = document.getElementById('chat-messages'); c.innerHTML = "";
        snap.forEach(s => {
            const m = s.val();
            c.innerHTML += `<div class="msg-bubble ${m.sender === user.uid?'mine':'theirs'}">${m.text}</div>`;
        });
        c.scrollTop = c.scrollHeight;
    });
}

// --- UTILS ---
function show(id, event, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
}
function showToast(m) { 
    const t = document.getElementById("toast"); t.innerText = m; t.classList.add("show"); 
    setTimeout(() => t.classList.remove("show"), 3000); 
}
function loginWithGoogle() { auth.signInWithPopup(provider); }
function logout() { auth.signOut().then(() => location.reload()); }
function closeChat() { document.getElementById('chat-window').style.display = "none"; }
function saveProfile() {
    db.ref('users/'+user.uid).update({
        inst: document.getElementById('p-inst').value,
        year: document.getElementById('p-year').value
    }).then(() => showToast("Profile Saved!"));
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
