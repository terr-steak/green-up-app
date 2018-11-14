// @flow
import firebase from 'firebase';
import * as dataLayerActions from './data-layer-actions';
import User from '../models/user';
import TeamMember from '../models/team-member';
import Town from '../models/town';
import * as types from '../constants/actionTypes';
import {firebaseConfig} from './firebase-config';
import 'firebase/firestore';

firebase.initializeApp(firebaseConfig);

// Initialize Cloud Firestore through Firebase
const db = firebase.firestore();

// Disable deprecated features
db.settings({
    timestampsInSnapshots: true
});

const myTeamMemberListeners = {};
const myListeners = {};

const deconstruct = obj => JSON.parse(JSON.stringify(obj));

/** *************** Profiles ***************  **/

export function updateProfile(profile: Object, teamMembers: Object) {
    const newProfile = Object.assign({}, profile, {updated: (new Date()).toString()}); // TODO fix this hack right
    const profileUpdate = db.collection('profiles').doc(profile.uid).set(newProfile);
    const teamUpdates = Object.keys(teamMembers).map(key => {
        const oldTeamMember = (teamMembers[key] || {})[profile.uid] || {};
        const newTeamMember = TeamMember.create({...oldTeamMember, ...newProfile});
        return db.collection(`teamMembers/${key}/members`).doc(profile.uid).set({...newTeamMember});
    });
    return Promise.all(teamUpdates.concat(profileUpdate));
}

function createProfile(user: User): Promise {
    const now = new Date();
    const newProfile = User.create(user);

    return db.collection('profiles').doc(newProfile.uid).set({
        ...newProfile,
        created: now,
        updated: now
    })
        .then((docRef) => {
            console.log('Document written with ID: ', docRef.id);
        })
        .catch((error) => {
            console.error('Error adding document: ', error);
        });
}

/** *************** INITIALIZATION *************** **/

function returnType(entry) {
    switch (true) {
        case (entry instanceof Date):
            return entry.toString();
        case Array.isArray(entry):
            return entry.map(x => returnType(x));
        case entry !== null && typeof entry === 'object' :
            return stringifyDates(entry); // eslint-disable-line
        default:
            return entry;
    }
}

function stringifyDates(obj) {
    return Object.entries(obj).reduce((returnObj, entry) => Object.assign({}, returnObj, {
        [entry[0]]: returnType(entry[1])
    }), {});
}

function setupMessageListener(uid, dispatch) {
    const ref = db.collection(`messages/${uid}/messages`);
    myListeners.messageListener = ref.onSnapshot(querySnapshot => {
        const data = [];
        querySnapshot.forEach(doc => data.push({...doc.data(), id: doc.id}));
        const messages = data.reduce((obj, message) => ({...obj, [message.id]: message}), {});
        dispatch(dataLayerActions.messageFetchSuccessful(messages));
    });
}


function setupTeamMessageListener(teamIds: Array<string>, dispatch: any => any) {
    (teamIds || []).forEach(teamId => {
        const ref = db.collection(`teams/${teamId}/messages`);
        myListeners.messageListener = ref.onSnapshot(querySnapshot => {
            const data = [];
            querySnapshot.forEach(doc => data.push({...doc.data(), id: doc.id}));
            const messages = data.reduce((obj, message) => ({...obj, [message.id]: message}), {});
            dispatch(dataLayerActions.teamMessageFetchSuccessful(messages));
        });
    });
}

function setupProfileListener(user, dispatch) {
    const {uid} = user;
    myListeners.profileListener = db.collection('profiles').doc(uid)
        .onSnapshot(doc => {
            if (doc.exists) {
                const profile = doc.data();
                dispatch(dataLayerActions.profileFetchSuccessful(profile));
                const removeUs = Object.keys(myTeamMemberListeners).filter(key => !(key in profile.teams));
                const addUs = Object.keys(profile.teams || {}).filter(key => !(key in myTeamMemberListeners));
                // remove listeners for ex-team member list changes;
                removeUs.forEach(key => {
                    // unsubscribe listener
                    myTeamMemberListeners[key]();
                    // remove listener from cache
                    delete myTeamMemberListeners[key];
                });
                // Add listeners for new team member list changes
                addUs.forEach(key => {
                    myTeamMemberListeners[key] = db.collection(`teamMembers/${key}/members`)
                        .onSnapshot(querySnapshot => {
                            const data = [];
                            querySnapshot.forEach(_doc => data.push({..._doc.data(), id: _doc.id}));
                            const members = data.reduce((obj, member) => ({...obj, [member.id]: member}), {});
                            dispatch(dataLayerActions.teamMemberFetchSuccessful(members, key));
                        });
                });
            } else {
                // just in case
                createProfile(user);
            }
        });
}

function setupTeamListener(dispatch) {
    myListeners.teamListener = db.collection('teams')
        .onSnapshot(querySnapshot => {
            const data = [];
            querySnapshot.forEach(doc => data.push({...doc.data(), id: doc.id}));
            const teams = data.reduce((obj, team) => ({...obj, [team.id]: team}), {});
            dispatch(dataLayerActions.teamFetchSuccessful(teams));
        });
}

function setupTrashDropListener(dispatch) {
    myListeners.trashDropListener = db.collection('trashDrops').onSnapshot(querySnapshot => {
        const data = [];
        querySnapshot.forEach(doc => data.push(doc.data()));
        dispatch(dataLayerActions.trashDropFetchSuccessful(data));
    });
}

function setupInvitationListener(email, dispatch) {
    myListeners.invitationListener = db.collection('invitations')
        .doc(email)
        .onSnapshot(snapshot => {
            const data = snapshot.exists ? snapshot.data() : {};
            dispatch(dataLayerActions.invitationFetchSuccessful(data));
        });
}

// Get Town Data
function setupTownListener(dispatch) {
    myListeners.townListeners = db.collection('towns').onSnapshot(querySnapshot => {
        const data = [];
        querySnapshot.forEach(doc => data.push(Town.create(doc.data(), doc.id)));
        const towns = data.reduce((obj, town) => ({...obj, [town.id]: town}), {});
        dispatch(dataLayerActions.townDataFetchSuccessful(towns));
    });
}

function initializeUser(dispatch, user) {

    if (Boolean(user)) {
        setupProfileListener(user, dispatch);
        setupMessageListener(user.uid, dispatch);
        setupTeamListener(dispatch);
        setupTrashDropListener(dispatch);
        setupInvitationListener(user.email, dispatch);
        setupTownListener(dispatch);
        setupTeamMessageListener(Object.keys(user.teams || {}), dispatch);
        dispatch(dataLayerActions.userAuthenticated(User.create(user)));
        dispatch({type: types.IS_LOGGING_IN_VIA_SSO, isLoggingInViaSSO: false});
        dispatch(dataLayerActions.initilizationSuccessful());
        return;
    }
    Object.values(myListeners).forEach(listener => listener());
    Object.values(myTeamMemberListeners).forEach(listener => listener());
    dispatch(dataLayerActions.userLoggedOut());
}

/**
 *
 * @param {function} dispatch - dispatch function
 */
export function initialize(dispatch: any => any) {
    firebase.auth().onAuthStateChanged(user => initializeUser(dispatch, user));
}

/** *************** AUTHENTICATION *************** **/

export function createUser(email: string, password: string, displayName: string) {
    return firebase
        .auth()
        .createUserWithEmailAndPassword(email, password).then(
            response => createProfile({...User.create(response.user), displayName})
        );
}

export async function facebookAuth(token) {

    // Build Firebase credential with the Facebook access token.
    const credential = firebase
        .auth
        .FacebookAuthProvider
        .credential(token);

    // Sign in with credential from the Facebook user.
    return firebase
        .auth()
        .signInWithCredential(credential)
        .then(user => {
            const {uid, email, displayName, photoURL} = user;
            db.collection('profiles').doc(uid).get().then(
                doc => {
                    if (!doc.exists) {
                        createProfile({uid, email, displayName, photoURL});
                    }
                }).catch((error) => {
                console.log('Error getting document:', error);
            });
        });
}

export async function googleAuth(token) {
    // Build Firebase credential with the Google access token.
    const credential = firebase.auth.GoogleAuthProvider.credential(token);
    return firebase.auth().signInWithCredential(credential)
        .then(user => {
            const {uid, email, displayName, photoURL} = user;
            db.collection('profiles').doc(uid).get().then(
                doc => {
                    if (!doc.exists) {
                        createProfile({uid, email, displayName, photoURL});
                    }
                }).catch((error) => {
                console.log('Error getting document:', error);
            });
        });
}

export function loginWithEmailPassword(_email: string, password: string) {
    return firebase
        .auth()
        .signInWithEmailAndPassword(_email, password)
        .then(user => {
            const {uid, email, displayName, photoURL} = user;
            db.collection('profiles').doc(uid).get().then(
                doc => {
                    if (!doc.exists) {
                        createProfile({uid, email, displayName, photoURL});
                    }
                }).catch((error) => {
                console.log('Error getting document:', error);
            });
        });
}

export function resetPassword(emailAddress: string) {
    return firebase.auth().sendPasswordResetEmail(emailAddress);
}

export function logout() {
    return firebase.auth().signOut();
}

export function updateEmail(email: string) {
    return firebase.auth().currentUser.updateEmail(email);
}

/** *************** MESSAGING *************** **/

export function sendUserMessage(userId, message) {
    const _message = deconstruct(stringifyDates(message));
    return db.collection(`messages/${userId}/messages`).add(_message);
}

export function sendGroupMessage(group, message) {
    group.forEach((memberUID) => {
        sendUserMessage(memberUID, deconstruct(message));
    });
}

export function sendTeamMessage(teamId, message) {
    return db.collection(`teams/${teamId}/messages`).add(deconstruct(message));
}

export function updateMessage(message: Object, userId: string) {
    const newMessage = deconstruct({...message, sender: {...message.sender}});
    return db.collection(`messages/${userId}/messages`).doc(message.id).set(newMessage);
}

export function deleteMessage(userId: string, messageId: string) {
    return db.collection(`messages/${userId}/messages`).doc(messageId).delete();
}

/** *************** TEAMS *************** **/

export function createTeam(team: Object = {}, user: User = {}) {
    const uid = team.owner.uid;
    return db.collection('teams').add(deconstruct({...team, owner: {...team.owner}})).then((docRef) => {
        db.collection(`teamMembers/${docRef.id}/members`).doc(team.owner.uid).set({...team.owner}).then(
            () => {
                const teams = {...user.teams || {}, [docRef.id]: 'OWNER'};
                db.collection('profiles').doc(uid).update({teams});
            });
    });
}

export function saveTeam(team) {
    const _team = deconstruct({...team, owner: {...team.owner}});
    return db.collection('teams').doc(team.id).set(_team);
}

export function deleteTeam(teamId: string) {
    return db.collection('teamMembers').doc(teamId).delete().then(() => {
        db.collection('teams').doc(teamId).delete();
    });
}

export function saveLocations(locations: Object, teamId: string) {
    return db.collection(`teams/${teamId}/locations`).set(deconstruct({...locations}));
}

export function inviteTeamMember(invitation: Object) {
    const membershipId = invitation.teamMember.email.toLowerCase();
    const teamId = invitation.team.id;
    const sender = {...invitation.sender};
    const team = {...invitation.team, owner: {...invitation.team.owner}};
    const teamMember = {...invitation.teamMember};
    const invite = {...invitation, teamMember, team, sender};
    return db
        .collection(`invitations/${membershipId}/teams`)
        .doc(teamId)
        .set({...invite})
        .then(db.collection(`teamMembers/${teamId}/members`).doc(membershipId).set(deconstruct({...invitation.teamMember})));
}

export function addTeamMember(teamId: string, user: Object, status?: string = 'ACCEPTED') {
    const teams = {...user.teams, [teamId]: status};
    const teamMember = TeamMember.create(Object.assign({}, user, {memberStatus: status}));
    const deleteInvitation = db.collection(`invitations/${user.email.toLowerCase().trim()}/teams`).doc(teamId).delete();
    const addToTeam = db.collection(`teamMembers/${teamId}/members`).doc(teamMember.uid).set({teamMember: deconstruct(teamMember)});
    const addTeamToProfile = db.collection('profiles').doc(user.uid).update({teams});
    return Promise.all([deleteInvitation, addToTeam, addTeamToProfile])
        .catch(error => {
            // TODO: handle this exception in the UI
            console.log(error);
        });
}

export function updateTeamMember(teamId: string, teamMember: TeamMember) {
    return db.collection(`teamMembers/${teamId}/members`).doc(teamMember.uid).set(deconstruct({...teamMember}));
}

export function removeTeamMember(teamId: string, teamMember: TeamMember) {
    return db.collection(`teamMembers/${teamId}/members`).doc(teamMember.uid).delete();
}

export function leaveTeam(teamId: string, teamMember: TeamMember) {
    const teams = {...teamMember.teams};
    delete teams[teamId];
    return db.collection(`teamMembers/${teamId}/members`).doc(teamMember.uid).delete()
        .then(() => db.collection('profiles').doc(teamMember.uid).update({teams}));
}

export function revokeInvitation(teamId: string, membershipId: string) {
    const _membershipId = membershipId.toLowerCase();
    return db.collection(`teamMembers/${teamId}/members`).doc(_membershipId).delete()
        .then(() => db.collection(`invitations/${_membershipId}/teams`).doc(teamId).delete());
}

/** *************** TRASH DROPS *************** **/

export function dropTrash(trashDrop: Object) {
    db.collection('trashDrops').add(deconstruct({...trashDrop, location: {...trashDrop.location}}));
}

export function updateTrashDrop(trashDrop: Object) {
    db.collection('trashDrops').doc(trashDrop.uid).set(deconstruct({...trashDrop, location: {...trashDrop.location}}));
}

