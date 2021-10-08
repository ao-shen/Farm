import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import * as firebaseui from 'firebaseui';

import { Farm } from './farm.js';
import { init } from './init.js';
import { animate, onAnimationFrame } from './animate.js';

let loginButton = document.getElementById("login-button");

async function startGame() {
    loginButton.style.display = "none";
    await init(Farm);
    onAnimationFrame(Farm);
}

window.addEventListener("load", () => {

    // Initialize Firebase
    let app = initializeApp(Config.firebaseConfig);
    let analytics = getAnalytics(app);

    let auth = getAuth();

    Farm.auth = auth;

    var user = auth.currentUser;

    if (user) {
        startGame();
        return;
    }

    auth.onAuthStateChanged(function(user) {
        if (user) {
            // User is signed in.
            var displayName = user.displayName;
            var email = user.email;
            var emailVerified = user.emailVerified;
            var photoURL = user.photoURL;
            var uid = user.uid;
            var phoneNumber = user.phoneNumber;
            var providerData = user.providerData;

            startGame();
        } else {

        }
    }, function(error) {
        console.log(error);
    });

    function onLogin() {
        loginButton.style.display = "none";
        signInWithPopup(auth, new GoogleAuthProvider())
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                const credential = GoogleAuthProvider.credentialFromResult(result);
                const token = credential.accessToken;
                // The signed-in user info.
                const user = result.user;
                // ...
                //console.log(user);
            }).catch((error) => {
                // Handle Errors here.
                const errorCode = error.code;
                const errorMessage = error.message;
                // The email of the user's account used.
                const email = error.email;
                // The AuthCredential type that was used.
                const credential = GoogleAuthProvider.credentialFromError(error);
                // ...
                console.error(error);
            });
    }
    loginButton.addEventListener("click", onLogin);

})