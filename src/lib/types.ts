export interface Klient {
  id: string;
  jmeno: string;
  prijmeni: string;
  telefon: string | null;
  poznamka: string | null;
  alergie: string | null;
  preference: string | null;
  aktivni: boolean;
  created_at: string;
  updated_at: string;
  skupiny?: Skupina[];
}

export interface Skupina {
  id: string;
  nazev: string;
  barva: string;
  created_at: string;
}

export interface Navsteva {
  id: string;
  klient_id: string;
  datum: string;
  castka_sluzby: number | null;
  castka_produkty: number | null;
  celkova_castka: number | null;
  poznamka: string | null;
  created_at: string;
  klient_jmeno?: string;
  klient_prijmeni?: string;
  sluzby_count?: number;
}

export interface Sluzba {
  id: string;
  navsteva_id: string;
  nazev: string;
  poradi: number;
  misky?: Miska[];
}

export interface Miska {
  id: string;
  sluzba_id: string;
  poradi: number;
  oxidant_id: string | null;
  oxidant_nazev?: string;
  gramy_oxidantu: number;
  materialy?: MaterialVMisce[];
}

export interface MaterialVMisce {
  id: string;
  miska_id: string;
  material_id: string;
  odstin_cislo: string;
  gramy_materialu: number;
  material_nazev?: string;
  material_typ_zadavani?: string;
  material_michaci_pomer_material?: number;
  material_michaci_pomer_oxidant?: number;
}

export interface Material {
  id: string;
  nazev: string;
  typ_zadavani: 'odstin' | 'cislo';
  michaci_pomer_material: number;
  michaci_pomer_oxidant: number;
  aktivni: boolean;
  poradi: number;
  oxidanty?: Oxidant[];
}

export interface Oxidant {
  id: string;
  nazev: string;
  popis: string | null;
  aktivni: boolean;
  poradi: number;
}

export interface ProduktVProdeji {
  produkt_id: string;
  produkt_nazev: string;
  pocet_ks: number;
  cena_za_ks: number;
}

export interface Prodej {
  id: string;
  klient_id: string | null;
  klient_jmeno: string | null;
  klient_prijmeni: string | null;
  datum: string;
  poznamka: string | null;
  produkty: ProduktVProdeji[];
  celkova_castka: number;
  created_at: string;
}

export interface Produkt {
  id: string;
  nazev: string;
  cena: number;
  aktivni: boolean;
  poradi: number;
}

export interface ProdejProduktu {
  id: string;
  navsteva_id: string;
  produkt_id: string;
  pocet_ks: number;
  cena_za_ks: number;
  produkt_nazev?: string;
}

export interface Ukon {
  id: string;
  nazev: string;
  pocet_misek: number;
  aktivni: boolean;
  poradi: number;
}

// Form types for visit creation
export interface MaterialVMisceForm {
  tempId: string;
  material_id: string | null;
  odstin_cislo: string;
  gramy_materialu: number | string;
}

export interface MiskaForm {
  tempId: string;
  oxidant_id: string | null;
  gramy_oxidantu: number;
  materialy: MaterialVMisceForm[];
}

export interface SluzbaForm {
  tempId: string;
  nazev: string;
  misky: MiskaForm[];
}

export interface ProdejProduktuForm {
  tempId: string;
  produkt_id: string | null;
  pocet_ks: number | string;
  cena_za_ks: number | string;
}

export interface NavstevaForm {
  klient_id: string | null;
  datum: string;
  celkova_castka: number | string;
  poznamka: string;
  sluzby: SluzbaForm[];
  produkty: ProdejProduktuForm[];
}

export interface NavstevaFull extends Navsteva {
  sluzby: Sluzba[];
  produkty: ProdejProduktu[];
}
