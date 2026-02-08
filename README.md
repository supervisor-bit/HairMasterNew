# 💇‍♀️ HairMaster

Moderní webová aplikace pro správu kadeřnického salonu. Sledování klientů, návštěv, materiálů, tržeb a receptur s plnou podporou offline režimu.

🌐 **Live aplikace**: [kadernictvi-app.web.app](https://kadernictvi-app.web.app)

## ✨ Hlavní funkce

### 👥 Správa klientů
- Evidence klientů s kontaktními údaji
- Historie návštěv u každého klienta
- Poznámky, alergie a preference
- Skupiny klientů (VIP, stálí zákazníci, atd.)
- **Nové**: Inline editace - rychlé vytvoření klienta bez přechodu na detail
- **Nové**: Vyhledávání od prvního znaku (bez nutnosti minimální délky)

### 📅 Návštěvy
- Detailní záznamy návštěv s recepturami
- Služby s materiály (barvy, odstíny) i bez materiálů (stříhání, foukání)
- Kalkulace gramáží podle míchacích poměrů
- Automatický výpočet cen
- Možnost opakování předchozích návštěv
- **Nové**: Rychlé vytvoření nového klienta přímo z formuláře návštěvy

### 🎨 Materiály a receptury
- Katalog barev a materiálů s odstíny
- Oxidanty a míchací poměry (1:1, 1:1.5, atd.)
- Ukládání receptur po miskách
- Přesné gramáže pro každou misku

### 🛍️ Prodej produktů
- Samostatný prodej produktů mimo návštěvy
- Rychlé vyhledávání produktů
- Evidence prodejů s vazbou na klienty

### 📊 Tržby
- Denní, měsíční a roční přehledy
- Interaktivní grafy (sloupcový, čárový)
- Filtrování a export dat
- Offline fungování s automatickou synchronizací

### 🖨️ Tisk
- **A4 formát** - přehledné tabulky pro archiv
- **Termo 80mm receptura** - kompaktní receptura s materiály
- **Termo 80mm účtenka** - jen služby a cena

### 🌓 Tmavý režim
- Automatické přepínání mezi světlým a tmavým režimem
- Persistence nastavení
- Šetrný k očím při dlouhém používání

### 💾 Zálohování
- Export celé databáze do JSON
- Import ze zálohy
- Bezpečné uchování dat

### 🎯 Uživatelské rozhraní
- **Responsivní design** - funguje na mobilu, tabletu i desktopu
- **Dropdown menu Administrace** - úspora místa v navigaci
- **Breadcrumbs navigace** - snadná orientace v aplikaci
- **Verze aplikace** - zobrazená na dashboardu a v nastavení
- **Easter egg** - 5x kliknutí na logo v nastavení = konfety 🎉

## 🛠️ Technologie

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore + Hosting + Authentication)
- **Build**: Vite
- **PDF**: jsPDF + jspdf-autotable
- **Offline**: Service Worker + Cache API

## 🚀 Spuštění lokálně

### Prerekvizity
- Node.js 18+
- npm nebo yarn
- Firebase účet

### Instalace

```bash
# Klonování repozitáře
git clone https://github.com/supervisor-bit/HairMasterNew.git
cd HairMasterNew

# Instalace závislostí
npm install

# Vývoj (dev server na localhost:5173)
npm run dev

# Build pro produkci
npm run build

# Preview produkčního buildu
npm run preview
```

## ⚙️ Firebase Setup

1. Vytvořte projekt na [Firebase Console](https://console.firebase.google.com)
2. Aktivujte **Firestore Database**
3. Aktivujte **Authentication** (Email/Password)
4. Vytvořte `src/lib/firebase.ts` s vašimi credentials:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

5. Nasaďte Firestore pravidla:

```bash
firebase deploy --only firestore:rules
```

## 📦 Deployment

```bash
# Build
npm run build

# Deploy na Firebase Hosting
firebase deploy --only hosting
```

## 📁 Struktura projektu

```
src/
├── components/        # Reusable komponenty (Button, Card, Input...)
├── pages/            # Stránky aplikace
│   ├── DashboardPage.tsx
│   ├── ClientsPage.tsx
│   ├── VisitNewPageImproved.tsx
│   ├── MaterialsPage.tsx
│   └── ...
├── lib/              # Utility funkce a Firebase
│   ├── firebase.ts
│   ├── firestore.ts
│   ├── auth.tsx
│   └── types.ts
└── App.tsx
```

## 💡 Použití

### První spuštění

1. Registrace uživatele (email + heslo)
2. Nastavení materiálů, oxidantů, produktů a úkonů
3. Přidání klientů
4. Vytváření návštěv

### Vytvoření návštěvy

1. Vyberte klienta nebo vytvořte nového
2. Přidejte služby (úkony)
3. Pro každou službu s materiálem:
   - Vyberte materiál a oxidant
   - Zadejte odstín/číslo a gramáž
   - Aplikace automaticky vypočítá gramy oxidantu
4. Uložte a vytiskněte recepturu

## 🔒 Bezpečnost

- ✅ Firebase Authentication
- ✅ Firestore Security Rules (každý uživatel vidí jen svá data)
- ✅ HTTPS pouze (Firebase Hosting)
- ✅ Environment variables pro citlivá data

## 📊 Firebase Limity (Free tier)

- **50,000 reads/den**
- **20,000 writes/den**
- **1 GB úložiště**

Pro běžný salon (7 návštěv/den) ~ **0.5% denního limitu** → **100% ZDARMA** ✅

## 🐛 Známé problémy

Žádné kritické problémy. Aplikace je plně funkční a testovaná.

## 📝 Licence

MIT License - volně použitelné pro komerční i nekomerční účely.

## 👨‍💻 Autor

Vytvořeno pro kadeřnický salon s pomocí AI asistenta.

## 🤝 Přispívání

Pull requesty jsou vítány! Pro větší změny prosím nejdříve otevřete issue.

---

**Verze**: 2.0.4  
**Poslední update**: 8. února 2026

## 🆕 Changelog

### v2.0.4 (8. února 2026)
- ✨ Easter egg: Konfety při 5x kliknutí na logo v nastavení
- 🎨 Dropdown menu "Administrace" pro úsporu místa v navigaci
- 🐛 Fix: Sjednocená šířka stránky Úkony s ostatními admin sekcemi
- 🐛 Fix: Správný label "Úkony" v breadcrumbs
- ✨ Možnost vytvořit nového klienta přímo z formuláře Nové návštěvy
- ✨ Vyhledávání klientů od prvního znaku (odstraněn 3-znakový minimum)
- ✨ Tlačítko "Nový klient" otevře inline formulář místo navigace
- 📊 Zobrazení verze aplikace v dashboardu a nastavení
- 🔧 Service Worker s verzováním cache pro lepší aktualizace
