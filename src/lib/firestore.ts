import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Helper pro vytvoření reference na user kolekci
function userCollection(userId: string, collectionName: string) {
  return collection(db, `users/${userId}/${collectionName}`);
}

// ==================== KLIENTI ====================

export async function getClients(userId: string, searchTerm?: string, skupinaId?: string | null, includeInactive?: boolean) {
  const ref = userCollection(userId, 'clients');
  
  // Temporarily without where clause until indexes are built
  let q = query(ref, orderBy('created_at', 'desc'));
  
  const snapshot = await getDocs(q);
  let clients = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Filter aktivni clients unless showing inactive
  if (!includeInactive) {
    clients = clients.filter((c: any) => c.aktivni === true);
  }
  
  // Filter by skupina if provided
  if (skupinaId) {
    clients = clients.filter((c: any) => 
      c.skupina_ids && Array.isArray(c.skupina_ids) && c.skupina_ids.includes(skupinaId)
    );
  }
  
  // Client-side filtering for search if provided
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    clients = clients.filter((c: any) => 
      c.jmeno?.toLowerCase().includes(term) ||
      c.prijmeni?.toLowerCase().includes(term) ||
      c.telefon?.toLowerCase().includes(term)
    );
  }
  
  return clients;
}

export async function getClient(userId: string, clientId: string) {
  const docRef = doc(db, `users/${userId}/clients/${clientId}`);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Klient nenalezen');
  }
  
  return { id: docSnap.id, ...docSnap.data() };
}

export async function createClient(userId: string, data: any) {
  const ref = userCollection(userId, 'clients');
  const docRef = await addDoc(ref, {
    ...data,
    aktivni: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  return docRef.id;
}

export async function updateClient(userId: string, clientId: string, data: any) {
  const docRef = doc(db, `users/${userId}/clients/${clientId}`);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp()
  });
}

export async function deleteClient(userId: string, clientId: string) {
  const docRef = doc(db, `users/${userId}/clients/${clientId}`);
  await deleteDoc(docRef);
}

// ==================== NÁVŠTĚVY ====================

export async function getVisits(userId: string, searchTerm?: string, clientId?: string) {
  const ref = userCollection(userId, 'visits');
  let q = query(ref, orderBy('datum', 'desc'));
  
  if (clientId) {
    q = query(ref, where('klient_id', '==', clientId), orderBy('datum', 'desc'));
  }
  
  const snapshot = await getDocs(q);
  let visits = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Client-side filtering for search if needed
  if (searchTerm && searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    visits = visits.filter((v: any) => 
      v.klient_jmeno?.toLowerCase().includes(term) ||
      v.klient_prijmeni?.toLowerCase().includes(term) ||
      v.poznamka?.toLowerCase().includes(term)
    );
  }
  
  return visits;
}

export async function getVisitsWithDetails(userId: string) {
  const ref = userCollection(userId, 'visits');
  const q = query(ref, orderBy('datum', 'desc'));
  const snapshot = await getDocs(q);
  
  const visits = [];
  
  for (const visitDoc of snapshot.docs) {
    const visitData = { id: visitDoc.id, ...visitDoc.data() };
    const visitId = visitDoc.id;
    
    // Get nested services
    const sluzbySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby`));
    const sluzby = [];
    
    for (const sluzbaDoc of sluzbySnap.docs) {
      const sluzbaData = { id: sluzbaDoc.id, ...sluzbaDoc.data() };
      
      // Get misky for this sluzba
      const miskySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky`));
      const misky = [];
      
      for (const miskaDoc of miskySnap.docs) {
        const miskaData = { id: miskaDoc.id, ...miskaDoc.data() };
        
        // Get materialy for this miska
        const materialySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky/${miskaDoc.id}/materialy`));
        const materialy = materialySnap.docs.map(matDoc => ({ id: matDoc.id, ...matDoc.data() }));
        
        misky.push({ ...miskaData, materialy });
      }
      
      sluzby.push({ ...sluzbaData, misky });
    }
    
    visits.push({ ...visitData, sluzby });
  }
  
  return visits;
}

export async function getVisit(userId: string, visitId: string) {
  const docRef = doc(db, `users/${userId}/visits/${visitId}`);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Návštěva nenalezena');
  }
  
  const visitData = { id: docSnap.id, ...docSnap.data() };
  
  // Get nested services and products
  const [sluzbySnap, produktySnap] = await Promise.all([
    getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby`)),
    getDocs(collection(db, `users/${userId}/visits/${visitId}/produkty`))
  ]);
  
  const sluzby = [];
  for (const sluzbaDoc of sluzbySnap.docs) {
    const sluzbaData = { id: sluzbaDoc.id, ...sluzbaDoc.data() };
    
    // Get misky for this sluzba
    const miskySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky`));
    const misky = [];
    
    for (const miskaDoc of miskySnap.docs) {
      const miskaData = { id: miskaDoc.id, ...miskaDoc.data() };
      
      // Get materialy for this miska
      const materialySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky/${miskaDoc.id}/materialy`));
      const materialy = materialySnap.docs.map(matDoc => ({ id: matDoc.id, ...matDoc.data() }));
      
      misky.push({ ...miskaData, materialy });
    }
    
    sluzby.push({ ...sluzbaData, misky });
  }
  
  const produkty = produktySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return { ...visitData, sluzby, produkty };
}

export async function createVisit(userId: string, data: any) {
  const ref = userCollection(userId, 'visits');
  
  // Extract nested data
  const { sluzby = [], produkty = [], ...visitData } = data;
  
  // Create visit document with sluzby_count
  const docRef = await addDoc(ref, {
    ...visitData,
    sluzby_count: sluzby.length,
    created_at: serverTimestamp()
  });
  
  const visitId = docRef.id;
  
  // Create nested sluzby
  for (let i = 0; i < sluzby.length; i++) {
    const sluzba = sluzby[i];
    const { misky = [], ...sluzbaData } = sluzba;
    
    const sluzbaRef = await addDoc(
      collection(db, `users/${userId}/visits/${visitId}/sluzby`),
      { ...sluzbaData, poradi: i + 1 }
    );
    
    // Create nested misky
    for (let j = 0; j < misky.length; j++) {
      const miska = misky[j];
      const { materialy = [], ...miskaData } = miska;
      
      const miskaRef = await addDoc(
        collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaRef.id}/misky`),
        { ...miskaData, poradi: j + 1 }
      );
      
      // Create nested materialy
      for (const material of materialy) {
        await addDoc(
          collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaRef.id}/misky/${miskaRef.id}/materialy`),
          material
        );
      }
    }
  }
  
  // Create nested produkty
  for (const produkt of produkty) {
    await addDoc(
      collection(db, `users/${userId}/visits/${visitId}/produkty`),
      produkt
    );
  }
  
  return visitId;
}

export async function updateVisit(userId: string, visitId: string, data: any) {
  const docRef = doc(db, `users/${userId}/visits/${visitId}`);
  
  // Extract nested data if present
  const { sluzby, produkty, ...visitData } = data;
  
  // Update main visit document
  await updateDoc(docRef, visitData);
  
  // If sluzby or produkty are provided, handle them (delete and recreate for simplicity)
  if (sluzby || produkty) {
    // This would require more complex logic - for now just update main document
    // In a production app, you'd want to handle nested updates more carefully
  }
}

export async function deleteVisit(userId: string, visitId: string) {
  // Delete all nested collections first
  const sluzbySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby`));
  for (const sluzbaDoc of sluzbySnap.docs) {
    const miskySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky`));
    for (const miskaDoc of miskySnap.docs) {
      const materialySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/sluzby/${sluzbaDoc.id}/misky/${miskaDoc.id}/materialy`));
      for (const matDoc of materialySnap.docs) {
        await deleteDoc(matDoc.ref);
      }
      await deleteDoc(miskaDoc.ref);
    }
    await deleteDoc(sluzbaDoc.ref);
  }
  
  const produktySnap = await getDocs(collection(db, `users/${userId}/visits/${visitId}/produkty`));
  for (const prodDoc of produktySnap.docs) {
    await deleteDoc(prodDoc.ref);
  }
  
  // Finally delete the visit itself
  const docRef = doc(db, `users/${userId}/visits/${visitId}`);
  await deleteDoc(docRef);
}

// ==================== MATERIÁLY ====================

export async function getMaterials(userId: string) {
  const ref = userCollection(userId, 'materials');
  const q = query(ref, orderBy('nazev', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createMaterial(userId: string, data: any) {
  const ref = userCollection(userId, 'materials');
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export async function updateMaterial(userId: string, materialId: string, data: any) {
  const docRef = doc(db, `users/${userId}/materials/${materialId}`);
  await updateDoc(docRef, data);
}

export async function deleteMaterial(userId: string, materialId: string) {
  const docRef = doc(db, `users/${userId}/materials/${materialId}`);
  await deleteDoc(docRef);
}

// ==================== OXIDANTY ====================

export async function getOxidants(userId: string) {
  const ref = userCollection(userId, 'oxidants');
  const q = query(ref, orderBy('nazev', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createOxidant(userId: string, data: any) {
  const ref = userCollection(userId, 'oxidants');
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export async function updateOxidant(userId: string, oxidantId: string, data: any) {
  const docRef = doc(db, `users/${userId}/oxidants/${oxidantId}`);
  await updateDoc(docRef, data);
}

export async function deleteOxidant(userId: string, oxidantId: string) {
  const docRef = doc(db, `users/${userId}/oxidants/${oxidantId}`);
  await deleteDoc(docRef);
}

// ==================== PRODUKTY ====================

export async function getProducts(userId: string) {
  const ref = userCollection(userId, 'products');
  const q = query(ref, orderBy('nazev', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createProduct(userId: string, data: any) {
  const ref = userCollection(userId, 'products');
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export async function updateProduct(userId: string, productId: string, data: any) {
  const docRef = doc(db, `users/${userId}/products/${productId}`);
  await updateDoc(docRef, data);
}

export async function deleteProduct(userId: string, productId: string) {
  const docRef = doc(db, `users/${userId}/products/${productId}`);
  await deleteDoc(docRef);
}

// ==================== SKUPINY ====================

export async function getSkupiny(userId: string) {
  const ref = userCollection(userId, 'skupiny');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createSkupina(userId: string, data: any) {
  const ref = userCollection(userId, 'skupiny');
  const docRef = await addDoc(ref, {
    ...data,
    created_at: serverTimestamp()
  });
  return docRef.id;
}

export async function updateSkupina(userId: string, skupinaId: string, data: any) {
  const docRef = doc(db, `users/${userId}/skupiny/${skupinaId}`);
  await updateDoc(docRef, data);
}

export async function deleteSkupina(userId: string, skupinaId: string) {
  const docRef = doc(db, `users/${userId}/skupiny/${skupinaId}`);
  await deleteDoc(docRef);
}

// ==================== ÚKONY ====================

export async function getUkony(userId: string) {
  const ref = userCollection(userId, 'ukony');
  const q = query(ref, orderBy('poradi', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createUkon(userId: string, data: any) {
  const ref = userCollection(userId, 'ukony');
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export async function updateUkon(userId: string, ukonId: string, data: any) {
  const docRef = doc(db, `users/${userId}/ukony/${ukonId}`);
  await updateDoc(docRef, data);
}

export async function deleteUkon(userId: string, ukonId: string) {
  const docRef = doc(db, `users/${userId}/ukony/${ukonId}`);
  await deleteDoc(docRef);
}

// ==================== PRODEJE ====================

export async function getProdeje(userId: string, klientId?: string | null) {
  const ref = userCollection(userId, 'prodeje');
  let q = query(ref, orderBy('datum', 'desc'));
  
  if (klientId) {
    q = query(ref, where('klient_id', '==', klientId), orderBy('datum', 'desc'));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

export async function createProductSale(userId: string, data: any) {
  const ref = userCollection(userId, 'prodeje');
  const docRef = await addDoc(ref, {
    ...data,
    created_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateProductSale(userId: string, prodejId: string, data: any) {
  const docRef = doc(db, `users/${userId}/prodeje/${prodejId}`);
  await updateDoc(docRef, {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteProductSale(userId: string, prodejId: string) {
  const docRef = doc(db, `users/${userId}/prodeje/${prodejId}`);
  await deleteDoc(docRef);
}

