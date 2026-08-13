import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // 👈 importamos auth

// Configuración de Firebase
const firebaseConfig = {
	apiKey: "AIzaSyBvYG-KQjrFugs-doZpfXF_-kpCb-kmRAI",
	authDomain: "datos-clini.firebaseapp.com",
	databaseURL: "https://datos-clini-default-rtdb.firebaseio.com",
	projectId: "datos-clini",
	storageBucket: "datos-clini.firebasestorage.app",
	messagingSenderId: "533706182677",
	appId: "1:533706182677:web:7b49192959d5b58f98be1c",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // 👈 inicializamos auth

export { db, auth }; // 👈 exportamos ambosa