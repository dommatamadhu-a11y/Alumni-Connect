// 1. Firebase Initialization
const firebaseConfig = { databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" };
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. Load User Session
let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "", groupKey: "" };

window.onload = () => {
    if(user.name) {
        document.getElementById('p-name').value = user.name || "";
        document.getElementById('p-inst').value = user.inst || "";
        document.getElementById('p-year').value = user.year || "";
        document.getElementById('p-city').value = user.city || "";
        listenToRequests();
    }
};

// 3. Navigation
function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    
    if(id === 'friends') {
        loadMyFriends();
        document.getElementById('notif-dot').style.display = "none";
    }
}

// 4. Profile Management
function saveProfile() {
    const name = document.getElementById('p-name').value.trim();
    const inst = document.getElementById('p-inst').value.trim();
    const year = document.getElementById('p-year').value.trim();
    const city = document.getElementById('p-city').value.trim();
    
    if(!name || !inst || !year) return alert("Fill essential details!");

    const groupKey = `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase();
    user = { name, inst, year, city, groupKey };
    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + name).set(user);
    alert("Profile Saved!");
    location.reload();
}

// 5. Search Logic
function searchAlumni() {
    const sInst = document.getElementById('s-inst').value.trim().toUpperCase();
    const sYear = document.getElementById('s-year').value.trim();
    const sCity = document.getElementById('s-city').value.trim().toUpperCase();
    const resDiv = document.getElementById('search-results');
    
    resDiv.innerHTML = "Searching...";
    db.ref('users').once('value', snap => {
        resDiv.innerHTML = "<h4>Search Results:</h4>";
        let count = 0;
        snap.forEach(child => {
            const u = child.val();
            if(u.name !== user.name && (u.inst.toUpperCase() === sInst || u.year === sYear || u.city.toUpperCase() === sCity)) {
                count++;
                checkAndDisplay(u, resDiv);
            }
        });
        if(count === 0) resDiv.innerHTML = "No matches found.";
    });
}

function checkAndDisplay(uData, container) {
    db.ref('friends/' + user.name + '/' + uData.name).once('value', fSnap => {
        let actionBtn = fSnap.exists() ? 
            `<button class="btn btn-green" style="width:auto;" onclick="alert('Private Chat Coming Soon!')">💬 Message</button>` : 
            `<button class="btn btn-blue" style="width:auto;" onclick="sendRequest('${uData.name}')">➕ Add Friend</button>`;
        
        container.innerHTML += `
            <div class="card">
                <b>${uData.name}</b><br><small>${uData.inst} | ${uData.year}</small><br><br>
                ${actionBtn}
            </div>`;
    });
}

// 6. Friend Request & Notifications
function sendRequest(target) {
    db.ref('requests/' + target + '/' + user.name).set({ from: user.name });
    alert("Request sent to " + target);
}

function listenToRequests() {
    db.ref('requests/' + user.name).on('value', snap => {
        const list = document.getElementById('request-list');
        const area = document.getElementById('notifications-area');
        list.innerHTML = "";
        if(snap.exists()) {
            area.style.display = "block";
            document.getElementById('notif-dot').style.display = "block";
            snap.forEach(c => {
                list.innerHTML += `<div class="req-box"><span>${c.key}</span><button class="btn-green" style="width:auto;" onclick="accept('${c.key}')">Accept</button></div>`;
            });
        } else {
            area.style.display = "none";
        }
    });
}

function accept(name) {
    db.ref('friends/' + user.name + '/' + name).set(true);
    db.ref('friends/' + name + '/' + user.name).set(true);
    db.ref('requests/' + user.name + '/' + name).remove();
    alert("Connected with " + name);
}

function loadMyFriends() {
    const list = document.getElementById('my-friends-list');
    db.ref('friends/' + user.name).on('value', snap => {
        list.innerHTML = "";
        snap.forEach(c => {
            list.innerHTML += `<div class="card"><b>👤 ${c.key}</b> <button class="btn-green" style="float:right; width:auto;" onclick="alert('Chatting with ${c.key}')">Chat</button></div>`;
        });
    });
}

// 7. Wall Feed
function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(msg && user.groupKey) {
        db.ref('posts').push({ name: user.name, msg, groupKey: user.groupKey, time: new Date().toLocaleTimeString() });
        document.getElementById('msgInput').value = "";
    }
}

db.ref('posts').on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        if(p.groupKey === user.groupKey) {
            let del = p.name === user.name ? `<button class="btn-red" onclick="db.ref('posts/${c.key}').remove()">Delete</button>` : "";
            cont.innerHTML = `<div class="card">${del}<b>${p.name}</b><br><p>${p.msg}</p><small>${p.time}</small></div>` + cont.innerHTML;
        }
    });
});
