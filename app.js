// --- CONFIGURATION ---
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
let initialRequestLoad = true;

// --- NOTIFICATION ENGINE ---
function notify(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.borderLeft = type === "success" ? "5px solid #22c55e" : "5px solid #6366f1";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
}

// --- AUTHENTICATION & SECURE SESSION ---
auth.onAuthStateChanged((u) => {
    if (u) {
        document.getElementById('login-overlay').style.display = "none";
        db.ref('users/' + u.uid).on('value', snap => {
            const d = snap.val();
            user = { 
                uid: u.uid, name: u.displayName, email: u.email, photo: d?.photo || u.photoURL, 
                inst: d?.inst || "", city: d?.city || "", uClass: d?.uClass || "", year: d?.year || "" 
            };
            updateUI();
            loadFeed();
            listenForRequests();
            listenForMessages();
        });
    } else { 
        document.getElementById('login-overlay').style.display = "flex"; 
    }
});

function updateUI() {
    document.getElementById('header-user-img').src = user.photo;
    document.getElementById('p-img-large').src = user.photo;
    document.getElementById('p-name-display').innerText = user.name;
    document.getElementById('p-email-display').innerText = user.email;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-city').value = user.city;
    document.getElementById('p-class').value = user.uClass;
    document.getElementById('p-year').value = user.year;
}

// --- VALIDATED PROFILE UPDATE ---
function saveProfile() {
    const inst = document.getElementById('p-inst').value.trim();
    const city = document.getElementById('p-city').value.trim();
    const uClass = document.getElementById('p-class').value.trim();
    const year = document.getElementById('p-year').value.trim();

    if(!inst || !city || !uClass || !year) {
        notify("All educational fields are required for verification!");
        return;
    }

    db.ref('users/' + user.uid).update({ inst, city, uClass, year })
    .then(() => notify("Profile Successfully Registered!", "success"))
    .catch(() => notify("Failed to update profile. Check connection."));
}

// --- AUTOMATIC GROUP FEED (VERIFIED ONLY) ---
async function handleFeedPost() {
    const txt = document.getElementById('msgInput').value.trim();
    if(!txt) return;

    if(!user.inst || !user.year) {
        notify("Please complete your profile to post to your batch!");
        return;
    }

    const groupKey = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    const file = document.getElementById('feedPhotoInput').files[0];
    let imgData = "";
    
    if(file) {
        if(file.size > 2 * 1024 * 1024) { // 2MB Limit
            notify("Image too large. Max limit is 2MB.");
            return;
        }
        const reader = new FileReader();
        imgData = await new Promise(r => { reader.onload = e => r(e.target.result); reader.readAsDataURL(file); });
    }

    db.ref('posts').push({ 
        uid: user.uid, name: user.name, msg: txt, img: imgData, time: Date.now(), filterKey: groupKey 
    }).then(() => {
        notify("Post published successfully!");
        document.getElementById('msgInput').value = "";
        document.getElementById('feedPhotoInput').value = "";
    });
}

function loadFeed() {
    const myKey = (user.inst + user.city + user.uClass + user.year).replace(/\s/g, '').toUpperCase();
    db.ref('posts').on('value', snap => {
        const cont = document.getElementById('post-container');
        cont.innerHTML = "";
        let hasPosts = false;

        snap.forEach(s => {
            const p = s.val();
            if(p.filterKey === myKey) {
                hasPosts = true;
                const likes = p.likes ? Object.keys(p.likes).length : 0;
                const isLiked = p.likes && p.likes[user.uid] ? 'liked' : '';
                cont.innerHTML = `
                <div class="card">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <img src="${p.uid === user.uid ? user.photo : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" width="30" height="30" style="border-radius:50%">
                        <b>${p.name}</b>
                    </div>
                    <p>${p.msg}</p>
                    ${p.img ? `<img src="${p.img}" class="post-img" loading="lazy">` : ''}
                    <div class="post-actions">
                        <span class="action-btn ${isLiked}" onclick="toggleLike('${s.key}')"><i class="${isLiked?'fas':'far'} fa-heart"></i> ${likes}</span>
                        <span class="action-btn" onclick="toggleComments('${s.key}')"><i class="far fa-comment"></i> Comments</span>
                    </div>
                    <div id="comment-area-${s.key}" class="comment-section">
                        <div id="list-${s.key}"></div>
                        <div style="display:flex; gap:5px; margin-top:10px;">
                            <input type="text" id="in-${s.key}" placeholder="Write a comment..." style="margin-bottom:0;">
                            <button onclick="addComment('${s.key}')" class="btn-blue" style="width:45px;"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>` + cont.innerHTML;
                loadComments(s.key);
            }
        });
        if(!hasPosts) cont.innerHTML = "<div class='card' style='text-align:center; color:#94a3b8;'>No posts in your verified batch group yet.</div>";
    });
}

// --- PRIVACY-FIRST SEARCH ---
function searchClassmates() {
    const sInst = document.getElementById('s-inst').value.toUpperCase().trim();
    const sCity = document.getElementById('s-city').value.toUpperCase().trim();
    if(!sInst && !sCity) { notify("Enter Institution or City to search."); return; }

    db.ref('users').once('value', snap => {
        const res = document.getElementById('search-results');
        res.innerHTML = "<h4>Search Results</h4>";
        let found = false;
        snap.forEach(c => {
            const u = c.val();
            if(c.key === user.uid) return;
            const match = (!sInst || (u.inst && u.inst.toUpperCase().includes(sInst))) &&
                          (!sCity || (u.city && u.city.toUpperCase().includes(sCity)));
            
            if(match) {
                found = true;
                res.innerHTML += `<div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                    <div><b>${u.name}</b><br><small>${u.inst || 'Private'} • ${u.year || ''}</small></div>
                    <button class="btn-blue" style="width:auto; padding:8px 15px;" onclick="connect('${c.key}','${u.name}')">Connect</button>
                </div>`;
            }
        });
        if(!found) res.innerHTML += "<p style='text-align:center; padding:20px; color:var(--sub)'>No matches found.</p>";
    });
}

function connect(uid, name) {
    db.ref('friends/' + user.uid + '/' + uid).once('value', s => {
        if(s.exists()) openChat(uid, name);
        else {
            db.ref('friend_requests/' + uid + '/' + user.uid).set({ fromName: user.name, fromPhoto: user.photo })
            .then(() => notify("Request Sent Successfully!", "success"));
        }
    });
}

// --- SECURE REQUEST LISTENER ---
function listenForRequests() {
    db.ref('friend_requests/' + user.uid).on('value', snap => {
        const list = document.getElementById('requests-list');
        const dot = document.getElementById('request-dot');
        if(snap.exists()){
            document.getElementById('requests-section').style.display = "block";
            dot.style.display = "block";
            if(!initialRequestLoad) notify("You have a new connection request!");
            list.innerHTML = "";
            snap.forEach(s => {
                list.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:5px; background:#fff; border-radius:10px;">
                    <span><b>${s.val().fromName}</b></span>
                    <button class="btn-blue" style="width:auto; padding:5px 12px; font-size:12px;" onclick="accept('${s.key}', '${s.val().fromName}')">Accept</button>
                </div>`;
            });
        } else {
            document.getElementById('requests-section').style.display = "none";
            dot.style.display = "none";
        }
        initialRequestLoad = false;
    });
}

function accept(fid, name) {
    db.ref('friends/' + user.uid + '/' + fid).set(true);
    db.ref('friends/' + fid + '/' + user.uid).set(true);
    db.ref('friend_requests/' + user.uid + '/' + fid).remove()
    .then(() => notify("You are now connected with " + name, "success"));
}

// --- REAL-TIME PRIVATE MESSAGING ---
function listenForMessages() {
    db.ref('friends/' + user.uid).on('child_added', snap => {
        const fid = snap.key;
        const cid = user.uid < fid ? user.uid+'_'+fid : fid+'_'+user.uid;
        db.ref('private_messages/' + cid).limitToLast(1).on('child_added', m => {
            const msg = m.val();
            if(msg.sender !== user.uid && (Date.now() - msg.time < 3000)) {
                notify("New secure message received!");
            }
        });
    });
}

function sendPrivateMessage() {
    const txt = document.getElementById('privateMsgInput').value.trim();
    if(!txt) return;
    const cid = user.uid < currentChatFriendUID ? user.uid+'_'+currentChatFriendUID : currentChatFriendUID+'_'+user.uid;
    db.ref('private_messages/' + cid).push({ sender: user.uid, text: txt, time: Date.now() });
    document.getElementById('privateMsgInput').value = "";
}

function openChat(uid, name) {
    currentChatFriendUID = uid;
    document.getElementById('chat-with-name').innerText = name;
    document.getElementById('chat-window').style.display = "flex";
    const cid = user.uid < uid ? user.uid+'_'+uid : uid+'_'+user.uid;
    db.ref('private_messages/' + cid).on('value', snap => {
        const c = document.getElementById('chat-messages');
        c.innerHTML = "";
        snap.forEach(s => { c.innerHTML += `<div class="msg-bubble ${s.val().sender === user.uid ? 'mine' : 'theirs'}">${s.val().text}</div>`; });
        c.scrollTop = c.scrollHeight;
    });
}

function closeChat() { document.getElementById('chat-window').style.display = "none"; }

// --- CORE UI HELPERS ---
function show(id, event, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active-nav');
}
function toggleLike(pid) {
    const ref = db.ref(`posts/${pid}/likes/${user.uid}`);
    ref.once('value', s => s.exists() ? ref.remove() : ref.set(true));
}
function toggleComments(pid) {
    const el = document.getElementById(`comment-area-${pid}`);
    el.style.display = el.style.display === "block" ? "none" : "block";
}
function addComment(pid) {
    const val = document.getElementById(`in-${pid}`).value.trim();
    if(!val) return;
    db.ref(`posts/${pid}/comments`).push({ name: user.name, text: val });
    document.getElementById(`in-${pid}`).value = "";
}
function loadComments(pid) {
    db.ref(`posts/${pid}/comments`).on('value', snap => {
        const list = document.getElementById(`list-${pid}`);
        if(!list) return;
        list.innerHTML = "";
        snap.forEach(s => { list.innerHTML += `<div class="comment-item"><b>${s.val().name}:</b> ${s.val().text}</div>`; });
    });
}
function loginWithGoogle() { auth.signInWithPopup(provider).catch(e => notify("Login failed: " + e.message)); }
function logout() { auth.signOut().then(() => location.reload()); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
