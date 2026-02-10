import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCLk0A5m1UL3P8_l3L0cvsa_SIqVAxpmHc",
  authDomain: "kadernictvi-app.firebaseapp.com",
  projectId: "kadernictvi-app",
  storageBucket: "kadernictvi-app.firebasestorage.app",
  messagingSenderId: "492480227328",
  appId: "1:492480227328:web:23814e0a9a30fdb0ecd0e5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function fixOxidantNames() {
  console.log('🔧 Oprava oxidant_nazev v databázi\n');
  
  // Get email and password from command line arguments
  const email = process.argv[2];
  const password = process.argv[3];
  
  if (!email || !password) {
    console.error('❌ Použití: node fix-oxidant-names.js EMAIL HESLO');
    process.exit(1);
  }
  
  console.log('🔐 Přihlašuji se...');
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userId = userCredential.user.uid;
  console.log(`✓ Přihlášen jako: ${email}\n`);
  
  console.log('📊 Načítám data...');
  
  // Load oxidants for this user
  const oxidantsSnapshot = await getDocs(collection(db, `users/${userId}/oxidants`));
  const oxidantsMap = new Map();
  oxidantsSnapshot.docs.forEach(oxDoc => {
    oxidantsMap.set(oxDoc.id, { id: oxDoc.id, ...oxDoc.data() });
  });
  console.log(`✓ Načteno ${oxidantsMap.size} oxidantů`);
  
  // Get all visits for this user
  const visitsSnapshot = await getDocs(collection(db, `users/${userId}/visits`));
  console.log(`✓ Načteno ${visitsSnapshot.docs.length} návštěv\n`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const visitDoc of visitsSnapshot.docs) {
    const visitId = visitDoc.id;
    const visitData = visitDoc.data();
    const datum = visitData.datum || 'neznámé datum';
    
    // Get all sluzby for this visit
    const sluzbySnapshot = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby`));
    
    for (const sluzbaDoc of sluzbySnapshot.docs) {
      const sluzbaId = sluzbaDoc.id;
      
      // Get all misky for this sluzba
      const miskySnapshot = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaId}/misky`));
      
      for (const miskaDoc of miskySnapshot.docs) {
        const miskaData = miskaDoc.data();
        
        // Check if miska has oxidant_id but missing oxidant_nazev
        if (miskaData.oxidant_id && !miskaData.oxidant_nazev) {
          const oxidant = oxidantsMap.get(miskaData.oxidant_id);
          
          if (oxidant) {
            // Update miska with oxidant name
            const miskaRef = doc(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaId}/misky/${miskaDoc.id}`);
            await updateDoc(miskaRef, {
              oxidant_nazev: oxidant.nazev
            });
            
            console.log(`✅ ${datum}: ${oxidant.nazev}`);
            updatedCount++;
          } else {
            console.log(`⚠️  ${datum}: Oxidant ID ${miskaData.oxidant_id} nenalezen`);
            skippedCount++;
          }
        }
      }
    }
  }
  
  console.log(`\n📊 Výsledek: ${updatedCount} opraveno, ${skippedCount} přeskočeno`);
  console.log('✅ Migrace dokončena!');
  process.exit(0);
}

// Run the migration
fixOxidantNames().catch(error => {
  console.error('❌ Chyba:', error.message);
  process.exit(1);
});
