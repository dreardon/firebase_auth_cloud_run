firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

async function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        return result;
    } catch (error) {
        console.error("Authentication Error:", error);
        throw error;
    }
}

async function loginAnonymously() {
    try {
        const result = await auth.signInAnonymously();
        return result;
    } catch (error) {
        console.error("Anonymous Authentication Error:", error);
        throw error;
    }
}

async function sendSignInLink(email) {
    const actionCodeSettings = {
        // URL you want to redirect back to. The domain (www.example.com) for this
        // URL must be in the authorized domains list in the Firebase Console.
        url: window.location.href,
        // This must be true.
        handleCodeInApp: true,
    };

    try {
        await auth.sendSignInLinkToEmail(email, actionCodeSettings);
        // Save the email locally so you don't need to ask the user for it again
        // if they open the link on the same device.
        window.localStorage.setItem('emailForSignIn', email);
        return true;
    } catch (error) {
        console.error("Error sending email link:", error);
        throw error;
    }
}

async function finishSignInWithEmailLink() {
    if (auth.isSignInWithEmailLink(window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            // User opened the link on a different device. To prevent session fixation
            // attacks, ask the user to provide the associated email again.
            email = window.prompt('Please provide your email for confirmation');
        }
        try {
            const result = await auth.signInWithEmailLink(email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            return result;
        } catch (error) {
            console.error("Error signing in with email link:", error);
            throw error;
        }
    }
    return null;
}


// MFA Support
async function enrollPhoneMFA(phoneNumber, recaptchaVerifier) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User must be signed in to enroll MFA.");
        
        const multiFactorSession = await user.multiFactor.getSession();
        const phoneInfoOptions = {
            phoneNumber: phoneNumber,
            session: multiFactorSession
        };
        const phoneAuthProvider = new firebase.auth.PhoneAuthProvider();
        const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier);
        return verificationId;
    } catch (error) {
        console.error("MFA Enrollment Error:", error);
        throw error;
    }
}

async function confirmMFAEnrollment(verificationId, verificationCode) {
    try {
        const user = auth.currentUser;
        const cred = firebase.auth.PhoneAuthProvider.credential(verificationId, verificationCode);
        const multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        await user.multiFactor.enroll(multiFactorAssertion, "Primary Phone");
        return true;
    } catch (error) {
        console.error("MFA Confirmation Error:", error);
        throw error;
    }
}

async function unenrollMFA(mfaInfo) {
    try {
        const user = auth.currentUser;
        await user.multiFactor.unenroll(mfaInfo);
        return true;
    } catch (error) {
        console.error("MFA Unenroll Error:", error);
        throw error;
    }
}

async function solveMFA(resolver, verificationId, verificationCode) {
    try {
        const cred = firebase.auth.PhoneAuthProvider.credential(verificationId, verificationCode);
        const multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
        const result = await resolver.resolveSignIn(multiFactorAssertion);
        return result;
    } catch (error) {
        console.error("MFA Resolution Error:", error);
        throw error;
    }
}

async function logout() {

    try {
        await auth.signOut();
        window.location.assign('/sessionLogout');
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
}

