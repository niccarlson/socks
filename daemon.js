function log(msg) {console.log(`daemon.js - ${msg}`);}

var updateInit = 0;
var authState = 0;
var userCache;
var currentClass;
let unsubscribe;
var lastVisible;
var reachedEnd;
var lastMessage;
// After 1-second allowance for component configuration, hide curtain.
setTimeout(function() {
	if (authState == 1) {
		document.getElementById('signIn').style.display = 'none'
		document.getElementById('signOut').style.display = 'block'
	} else {
		document.getElementById('signIn').style.display = 'block'
		document.getElementById('signOut').style.display = 'none'
	}
	document.getElementById('loading').style.display = 'none'
}, 1000);

window.onload = function(){
	this.loadAuthState();
	this.getClasses();
	document.getElementById('restraints').scrollTop = document.getElementById('chatSession').scrollHeight
}

// Send a chat to Firestore. [Class ID, message text]
function sendChat(classId, msg) {
	if(msg.length > 0){
	document.getElementById('sendBtn').classList.add('is-loading')
	document.getElementById('sendBtn').disabled = true;
	document.getElementById('msg').classList.remove('is-danger')
	db.collection("chats").doc(classId).collection("messages").add({
			text: msg,
			time: firebase.firestore.Timestamp.fromDate(new Date()),
			user: userCache.displayName,
			uid: userCache.uid
		})
		.then(function(docRef) {
			console.log("Document written with ID: ", docRef.id);
			document.getElementById('msg').value = ''
			document.getElementById('sendBtn').classList.remove('is-loading')
			document.getElementById('sendBtn').disabled = false;
			document.getElementById(`msg-${docRef.id}`).style.background = "rgba(50, 152, 220, 1)";
		})
		.catch(function(error) {
			console.error("Error adding document: ", error);
		});
	} else {document.getElementById('msg').classList.add('is-danger')}
}

// Add a chat to the window. [Message text, display name, message time, message ID, sent or received, adding history or new]
function showChat(msg, dName, time, id, self, uid, history = 0) {
	log(`${dName} at ${formatTime(time)} said: ${msg}`)
	var cln = document.getElementById('messageTemplate').cloneNode(true);
	cln.id = id
	if(lastMessage !== uid){
	cln.childNodes[1].innerHTML = `<span id='inf-${id}'>${dName}</span>`;
	cln.childNodes[3].innerHTML = `<span class='time'>${formatTime(time)}</span>`;
	}
	cln.childNodes[5].innerHTML = msg
	cln.childNodes[5].id = `msg-${id}`

	if (history == 1) {
		document.getElementById("chatSession").prepend(cln)
		if(lastMessage == uid){
			cln.childNodes[1].remove()
			cln.childNodes[2].remove()
		}
	} else {
		document.getElementById("chatSession").appendChild(cln)
		if(lastMessage == uid){
			cln.childNodes[1].remove()
			cln.childNodes[2].remove()
		}
	}
	if (self == true) {
		document.getElementById(id).style.textAlign = '-webkit-right';
		document.getElementById(`msg-${id}`).style.background = "rgba(50, 152, 220, 0.2)";
		document.getElementById(`msg-${id}`).style.color = 'white'
		document.getElementById(`msg-${id}`).style.textAlign = 'left';
		if(history == 1){
			document.getElementById(`msg-${id}`).style.background = "rgba(50, 152, 220, 1)";
		}
	}
	lastMessage = uid;
}

// Retrieve previous 5 chat entries from Firestore.
function callHistory(initial = 0) {
	if(initial == 0){
		document.getElementById('loadMoreBtn').classList.add('is-loading')
		db.collection("chats").doc(currentClass).collection("messages").orderBy("time", "desc").startAfter(lastVisible).limit(10)
		.get()
		.then(function(querySnapshot) {
			var previousHeight = document.getElementById('restraints').scrollHeight
			if(querySnapshot.docs.length < 10){
				document.getElementById('loadMoreBtn').innerHTML = "You've reached the beginning!"
				document.getElementById('loadMoreBtn').disabled = true
				reachedEnd = true;
			} else {
				lastVisible = querySnapshot.docs[9];
				reachedEnd = false;
			}
			querySnapshot.forEach(function(doc) {
				if(doc.data().uid == userCache.uid){
					showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, true, doc.data().uid, 1);
				} else {
					showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, false, doc.data().uid, 1);
				}
			});
			console.log(previousHeight)
			let newHeight = document.getElementById('restraints').scrollHeight
			console.log(newHeight)
			document.getElementById('restraints').scrollTop = newHeight - previousHeight
			console.log(newHeight - previousHeight)
			document.getElementById('loadMoreBtn').classList.remove('is-loading')

		})
		.catch(function(error) {
			log("Error getting history: ", error);
		});
	} else {
		db.collection("chats").doc(currentClass).collection("messages").where("time", "<", firebase.firestore.Timestamp.fromDate(new Date())).orderBy("time", "desc").limit(10)
		.get()
		.then(function(querySnapshot) {
			if(querySnapshot.docs.length == 0) {
				document.getElementById('loadMoreBtn').innerHTML = "No messages here yet! Send one to get started 😀"
				document.getElementById('loadMoreBtn').disabled = true
			} else if(querySnapshot.docs.length < 10){
				document.getElementById('loadMoreBtn').innerHTML = "You've reached the beginning!"
				document.getElementById('loadMoreBtn').disabled = true
				reachedEnd = true;
			} else {
				lastVisible = querySnapshot.docs[9];
				reachedEnd = false;
			}
			querySnapshot.forEach(function(doc) {
				if (doc.data().uid == userCache.uid) {
					showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, true, doc.data().uid, 1);
				} else {
					showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, false, doc.data().uid, 1);
				}
			});
		})
		.catch(function(error) {
			log("Error getting initial history: ", error);
		});
	}
}

// Check to see if user reached top of chat window to load new messages.
function scrollCheck(){
	if(document.getElementById('restraints').scrollTop == 0 && reachedEnd == false){
			callHistory();
	}
}


// Retrieve class list from Firestore and add to search box.
function getClasses() {
	db.collection("lookuptable").orderBy("title", "asc")
		.get()
		.then(function(querySnapshot) {
			querySnapshot.forEach(function(doc) {
				var liTemplate = document.getElementById('liTemplate').cloneNode(true)
				liTemplate.removeAttribute('id')
				liTemplate.style.display = '';
				liTemplate.innerHTML = `<a onClick="openClass('${doc.id}')" href="#" keywords="${doc.data().keywords}">${doc.data().title}</a>`
				document.getElementById('classUL').appendChild(liTemplate);
			})
		});
}

// Start listening for new messages from Firestore.
function startListener() {
	unsubscribe = db.collection("chats").doc(currentClass).collection("messages").orderBy("time", "desc").limit(1)
		.onSnapshot(function(querySnapshot) {
			if (updateInit == 1) {
				querySnapshot.forEach(function(doc) {
					if (doc.data().uid == userCache.uid) {
						showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, true);
						document.getElementById('restraints').scrollTop = document.getElementById('chatSession').scrollHeight
					} else {
						showChat(doc.data().text, doc.data().user, doc.data().time.toDate(), doc.id, false);
						document.getElementById('restraints').scrollTop = document.getElementById('chatSession').scrollHeight
					}
				});
			} else {
				updateInit = 1;
			}
		});
}

// Format JS timestamp to UX-friendly and return.
function formatTime(date) {
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var period = hours >= 12 ? 'pm' : 'am';
	hours = hours % 12;
	hours = hours ? hours : 12;
	minutes = minutes < 10 ? '0' + minutes : minutes;
	var strTime = hours + ':' + minutes + ' ' + period;
	return strTime;
}

// Filter search box results.
function execSearch() {
	var input, filter, ul, li, a, i, txtValue;
	input = document.getElementById("searchbox");
	filter = input.value.toUpperCase();
	ul = document.getElementById("classUL");
	li = ul.getElementsByTagName("li");
	for (i = 0; i < li.length; i++) {
		a = li[i].getElementsByTagName("a")[0];
		txtValue = a.getAttribute("keywords");
		if (txtValue.toUpperCase().indexOf(filter) > -1) {
			li[i].style.display = "";
		} else {
			li[i].style.display = "none";
		}
	}
}

// Log in through Google.
function logInFlow() {
	firebase.auth().signInWithPopup(provider).then(function(result) {
		var token = result.credential.accessToken;
		userCache = result.user;
		// displayName = user.displayName;
		// email = user.email;
		// photoURL = user.photoURL;
		// uid = user.uid;
		authState = 1;
		document.getElementById('signIn').style.display = 'none'
		document.getElementById('signOut').style.display = 'block'
	}).catch(function(error) {
		var errorCode = error.code;
		var errorMessage = error.message;
		var email = error.email;
		var credential = error.credential;
		authState = 0;
		document.getElementById('signIn').style.display = 'block'
		document.getElementById('signOut').style.display = 'none'
	});
}

// Detect if already logged in.
function loadAuthState() {
	firebase.auth().onAuthStateChanged(function(user) {
		if (user) {
			userCache = user;
			authState = 1;
		} else {
			authState = 0;
		}
	});
}

// Hide window, clear chat, and initialize new session with new class. [Class ID]
function openClass(classId) {
	flashCurtain()
	while (document.getElementById('chatSession').firstChild) {
		document.getElementById('chatSession').removeChild(document.getElementById('chatSession').firstChild);
	}
	currentClass = classId
	db.collection("lookuptable").doc(classId)
	.get()
	.then(function(querySnapshot){
		document.getElementById('classLabel').innerHTML = querySnapshot.data().title;
	});
	if (unsubscribe) {
		unsubscribe();
	}
	startListener();
	callHistory(1);
}

// Show loading screen.
function flashCurtain() {
	document.getElementById('loading').style.display = ''
	setTimeout(function() {
		document.getElementById('search').style.display = 'none';
		document.getElementById('restraints').scrollTop = document.getElementById('chatSession').scrollHeight
		document.getElementById('loading').style.display = 'none'
	}, 1000)
}

// Log out through Google.
function logOutFlow() {
	firebase.auth().signOut().then(function() {
		document.getElementById('signIn').style.display = 'block'
		document.getElementById('signOut').style.display = 'none'
	}).catch(function(error) {
		alert(`An error occurred and you couldn't be signed out: ${error}`)
		console.error(error)
	});
}