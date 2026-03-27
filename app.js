// Firebase Configuration
const firebaseConfig = { 
    databaseURL: "https://class-connect-b58f0-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Load User Data from Local Storage
let user = JSON.parse(localStorage.getItem("alumniUser")) || { name: "Anonymous", inst: "", year: "", city: "" };

// Sync Profile Fields
window.onload = () => {
    document.getElementById('p-name').value = user.name;
    document.getElementById('p-inst').value = user.inst;
    document.getElementById('p-year').value = user.year;
    document.getElementById('p-city').value = user.city;
};

// Navigation Function
function show(id, title, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
    document.getElementById(id).classList.add('active');
    document.getElementById('page-title').innerText = title;
    el.classList.add('active-nav');
    if(id === 'friends') loadFriends();
}

// Save Profile Logic
function saveProfile() {
    const name = document.getElementById('p-name').value;
    const inst = document.getElementById('p-inst').value;
    const year = document.getElementById('p-year').value;
    const city = document.getElementById('p-city').value;

    if(!name || !inst || !year) {
        alert("Please fill name, institution and year!");
        return;
    }

    user = {
        name: name,
        inst: inst,
        year: year,
        city: city,
        groupKey: `${inst}_${year}_${city}`.replace(/\s+/g, '').toUpperCase()
    };

    localStorage.setItem("alumniUser", JSON.stringify(user));
    db.ref('users/' + user.name).set(user);
    alert("Profile Updated Successfully!");
    show('friends', 'Batchmates', document.getElementById('nav-friends'));
}

// Send Post Logic
function sendPost() {
    const msg = document.getElementById('msgInput').value;
    if(msg) {
        db.ref('posts').push({
            name: user.name,
            msg: msg,
            group: user.inst || "General",
            time: new Date().toLocaleTimeString()
        });
        document.getElementById('msgInput').value = "";
    }
}

// Load Friends with same Group Key
function loadFriends() {
    const list = document.getElementById('friends-list');
    const info = document.getElementById('group-info');
    
    if(!user.inst) {
        list.innerHTML = "Update profile to see your batchmates.";
        return;
    }

    info.innerHTML = `Group: <b>${user.inst} (${user.year})</b>`;
    
    db.ref('users').on('value', snap => {
        list.innerHTML = "";
        let found = false;
        snap.forEach(child => {
            const u = child.val();
            if(u.groupKey === user.groupKey && u.name !== user.name) {
                found = true;
                list.innerHTML += `
                    <div class="card">
                        <b>👤 ${u.name}</b><br>
                        <span class="group-tag">📍 ${u.city}</span>
                    </div>`;
            }
        });
        if(!found) list.innerHTML = "No batchmates found yet in this group.";
    });
}

// Listen for Posts (Real-time)
db.ref('posts').limitToLast(20).on('value', snap => {
    const cont = document.getElementById('post-container');
    cont.innerHTML = "";
    snap.forEach(c => {
        const p = c.val();
        cont.innerHTML = `
            <div class="card">
                <b style="color:#007bff;">${p.name}</b> <small style="color:#999">@ ${p.group}</small><br>
                <p style="margin:5px 0;">${p.msg}</p>
                <small style="color:#ccc; font-size:10px;">${p.time}</small>
            </div>` + cont.innerHTML;
    });
});
