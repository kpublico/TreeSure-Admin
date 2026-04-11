// js/model.js
import { db } from "./script.js";
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const Model = {
  listen(collectionName, callback) {
    const colRef = collection(db, collectionName);
    // returns unsubscribe function
    return onSnapshot(colRef, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(items);
    }, (err) => {
      console.error("Firestore listen error:", err);
      callback([]); // send empty on error
    });
  },

  add(collectionName, data) {
    const colRef = collection(db, collectionName);
    return addDoc(colRef, data);
  },

  update(collectionName, id, data) {
    const docRef = doc(db, collectionName, id);
    return updateDoc(docRef, data);
  },

  delete(collectionName, id) {
    const docRef = doc(db, collectionName, id);
    return deleteDoc(docRef);
  }
};
