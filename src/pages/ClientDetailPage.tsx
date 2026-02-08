import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getClient, updateClient, getVisits, getProdeje, getSkupiny, getVisit } from '@/lib/firestore';
import type { Klient, Navsteva, Prodej, Skupina, NavstevaFull } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Badge from '@/components/Badge';
import Avatar from '@/components/Avatar';
import jsPDF from 'jspdf';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState<Klient | null>(null);
  const [visits, setVisits] = useState<Navsteva[]>([]);
  const [sales, setSales] = useState<Prodej[]>([]);
  const [allSkupiny, setAllSkupiny] = useState<Skupina[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ jmeno: '', prijmeni: '', telefon: '', poznamka: '', alergie: '', preference: '', skupina_ids: [] as string[] });

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const [c, v, salesData, s] = await Promise.all([
        getClient(user.uid, id),
        getVisits(user.uid, undefined, id),
        getProdeje(user.uid, id),
        getSkupiny(user.uid),
      ]);
      setClient(c as Klient);
      setVisits(v as Navsteva[]);
      setSales(salesData as Prodej[]);
      setAllSkupiny(s as Skupina[]);
      setForm({ 
        jmeno: c.jmeno, 
        prijmeni: c.prijmeni, 
        telefon: c.telefon || '', 
        poznamka: c.poznamka || '',
        alergie: c.alergie || '',
        preference: c.preference || '',
        skupina_ids: c.skupiny?.map(sk => sk.id) || []
      });
    } catch (err: any) {
      console.error('Error loading client:', err);
      toast.error(err.message || 'Chyba při načítání klienta');
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (!form.jmeno.trim() || !form.prijmeni.trim() || !user || !id) {
      toast.error('Jméno a příjmení jsou povinné');
      return;
    }
    try {
      await updateClient(user.uid, id, form);
      toast.success('Klient uložen');
      setEditing(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  }, [form, user, id, load]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to cancel editing
      if (e.key === 'Escape' && editing) {
        setEditing(false);
        setForm({ 
          jmeno: client?.jmeno || '', 
          prijmeni: client?.prijmeni || '', 
          telefon: client?.telefon || '', 
          poznamka: client?.poznamka || '',
          alergie: client?.alergie || '',
          preference: client?.preference || '',
          skupina_ids: client?.skupiny?.map(sk => sk.id) || []
        });
      }
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && editing) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editing, client, handleSave]);

  const toggleSkupina = async (skupinaId: string) => {
    if (!client || !user || !id) return;
    try {
      const hasSkupina = form.skupina_ids.includes(skupinaId);
      const newSkupinaIds = hasSkupina 
        ? form.skupina_ids.filter(sid => sid !== skupinaId)
        : [...form.skupina_ids, skupinaId];
      
      await updateClient(user.uid, id, {
        jmeno: client.jmeno,
        prijmeni: client.prijmeni,
        telefon: client.telefon,
        poznamka: client.poznamka,
        skupina_ids: newSkupinaIds
      });
      
      toast.success(hasSkupina ? 'Skupina odebrána' : 'Skupina přidána');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při úpravě skupiny');
    }
  };

  const formatDate = (d: string | any) => {
    if (!d) return 'Neznámé';
    // Handle Firestore Timestamp
    if (d.toDate && typeof d.toDate === 'function') {
      return d.toDate().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    // Handle string date
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Neplatné datum';
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handlePrintReceipt = async (visitId: string) => {
    if (!user) return;
    
    try {
      const visit = await getVisit(user.uid, visitId) as NavstevaFull;
      if (!visit) return;
      
      // Simple receipt - 80mm width, no materials
      const doc = new jsPDF({
        format: [80, 297],
        unit: 'mm'
      });
      
      // Helper to handle Czech characters
      const text = (str: string, x: number, y: number, options?: any) => {
        const normalized = str
          .replace(/č/g, 'c').replace(/Č/g, 'C')
          .replace(/ď/g, 'd').replace(/Ď/g, 'D')
          .replace(/ě/g, 'e').replace(/Ě/g, 'E')
          .replace(/ň/g, 'n').replace(/Ň/g, 'N')
          .replace(/ř/g, 'r').replace(/Ř/g, 'R')
          .replace(/š/g, 's').replace(/Š/g, 'S')
          .replace(/ť/g, 't').replace(/Ť/g, 'T')
          .replace(/ů/g, 'u').replace(/Ů/g, 'U')
          .replace(/ú/g, 'u').replace(/Ú/g, 'U')
          .replace(/ý/g, 'y').replace(/Ý/g, 'Y')
          .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
          .replace(/á/g, 'a').replace(/Á/g, 'A')
          .replace(/é/g, 'e').replace(/É/g, 'E')
          .replace(/í/g, 'i').replace(/Í/g, 'I')
          .replace(/ó/g, 'o').replace(/Ó/g, 'O');
        doc.text(normalized, x, y, options);
      };
      
      let yPos = 5;
      const leftMargin = 3;
      const pageWidth = 74;
      
      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      text('UCTENKA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 7;
      
      // Separator
      doc.setLineWidth(0.3);
      doc.line(leftMargin, yPos, pageWidth, yPos);
      yPos += 5;
      
      // Client & Date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      text(`${visit.klient_jmeno} ${visit.klient_prijmeni}`, leftMargin, yPos);
      yPos += 5;
      doc.setFontSize(9);
      text(formatDate(visit.datum), leftMargin, yPos);
      yPos += 5;
      
      // Separator
      doc.line(leftMargin, yPos, pageWidth, yPos);
      yPos += 5;
      
      // Services list
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      text('SLUZBY:', leftMargin, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      visit.sluzby.forEach((sluzba, idx) => {
        text(`${idx + 1}. ${sluzba.nazev}`, leftMargin, yPos);
        yPos += 5;
      });
      
      // Products list
      if (visit.produkty && visit.produkty.length > 0) {
        yPos += 2;
        doc.setFont('helvetica', 'bold');
        text('PRODUKTY:', leftMargin, yPos);
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        visit.produkty.forEach((produkt, idx) => {
          const nazev = produkt.produkt_nazev || 'Neznamy produkt';
          const pocet = produkt.pocet_ks > 1 ? ` (${produkt.pocet_ks}x)` : '';
          text(`${idx + 1}. ${nazev}${pocet}`, leftMargin, yPos);
          
          const celkovaCena = produkt.cena_za_ks * produkt.pocet_ks;
          text(`${celkovaCena} Kc`, pageWidth, yPos, { align: 'right' });
          
          yPos += 5;
        });
      }
      
      yPos += 2;
      doc.line(leftMargin, yPos, pageWidth, yPos);
      yPos += 5;
      
      // Total if exists
      if (visit.celkova_castka) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        text('CELKEM:', leftMargin, yPos);
        text(`${visit.celkova_castka} Kc`, pageWidth, yPos, { align: 'right' });
        yPos += 6;
      }
      
      // Footer
      yPos += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      text('Dekujeme za navstevu!', pageWidth / 2, yPos, { align: 'center' });
      
      // Open in new window
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } catch (err: any) {
      toast.error('Chyba při tisku účtenky');
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;
  if (!client) return <div className="text-center py-20 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Klient nenalezen</div>;

  return (
    <div className="animate-fade-in">
      <Card className="mb-6">
        {editing ? (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Input
                label="Jméno"
                value={form.jmeno}
                onChange={e => setForm(f => ({ ...f, jmeno: e.target.value }))}
                required
                autoFocus
              />
              <Input
                label="Příjmení"
                value={form.prijmeni}
                onChange={e => setForm(f => ({ ...f, prijmeni: e.target.value }))}
                required
              />
            </div>
            <div className="mb-4">
              <Input
                type="tel"
                label="Telefon"
                value={form.telefon}
                onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
                placeholder="+420 123 456 789"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">
                Alergie <span className="text-red-600 text-xs">(důležité!)</span>
              </label>
              <textarea
                value={form.alergie}
                onChange={e => setForm(f => ({ ...f, alergie: e.target.value }))}
                rows={2}
                placeholder="PPD, amoniak, latex..."
                className="w-full px-3 py-2 border border-red-200 dark:border-red-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none transition-colors dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">Preference</label>
              <textarea
                value={form.preference}
                onChange={e => setForm(f => ({ ...f, preference: e.target.value }))}
                rows={2}
                placeholder="Oblíbené barvy, délka vlasů, styl..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-colors"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">Poznámka</label>
              <textarea
                value={form.poznamka}
                onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-colors"
              />
            </div>
            <div className="flex gap-3 sticky bottom-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur -mx-6 -mb-6 px-6 py-4 border-t border-gray-100 dark:border-gray-700 dark:border-gray-700">
              <Button onClick={handleSave}>Uložit</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setForm({ 
                    jmeno: client.jmeno, 
                    prijmeni: client.prijmeni, 
                    telefon: client.telefon || '', 
                    poznamka: client.poznamka || '',
                    alergie: client.alergie || '',
                    preference: client.preference || '',
                    skupina_ids: client.skupiny?.map(sk => sk.id) || []
                  });
                }}
              >
                Zrušit
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!user || !id) return;
                  try {
                    await updateClient(user.uid, id, { aktivni: !client.aktivni });
                    toast.success(client.aktivni ? 'Klient deaktivován' : 'Klient aktivován');
                    load();
                  } catch (err: any) {
                    toast.error(err.message || 'Chyba při změně stavu');
                  }
                }}
                className="ml-auto"
              >
                {client.aktivni ? 'Deaktivovat' : 'Aktivovat'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
            <div className="flex items-start gap-4">
              <Avatar jmeno={client.jmeno} prijmeni={client.prijmeni} size="lg" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                  {client.jmeno} {client.prijmeni}
                </h1>
                {client.telefon && (
                  <p className="mt-1.5 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25z" />
                    </svg>
                    {client.telefon}
                  </p>
                )}
                {client.poznamka && (
                  <p className="mt-2 text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{client.poznamka}</p>
                )}
                {client.alergie && (
                  <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                    <svg className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <div>
                      <div className="text-sm font-semibold text-red-900 dark:text-red-100">Alergie</div>
                      <div className="text-sm text-red-700 dark:text-red-300 mt-0.5">{client.alergie}</div>
                    </div>
                  </div>
                )}
                {client.preference && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">Preference</div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">{client.preference}</div>
                  </div>
                )}
                {client.skupiny && client.skupiny.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {client.skupiny.map(s => (
                      <span
                        key={s.id}
                        className="text-sm px-2.5 py-1 rounded-full text-white font-medium"
                        style={{ backgroundColor: s.barva }}
                      >
                        {s.nazev}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400">
                  Vytvořen: {formatDate(client.created_at)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Upravit
            </Button>
          </div>
        )}
      </Card>

      {/* Group management */}
      {allSkupiny.length > 0 && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-3">Skupiny</h2>
          <div className="flex flex-wrap gap-2">
            {allSkupiny.map(s => {
              const isAssigned = client?.skupiny?.some(cs => cs.id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSkupina(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isAssigned
                      ? 'text-white shadow-sm'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isAssigned ? s.barva : `${s.barva}20`,
                    color: isAssigned ? 'white' : s.barva,
                  }}
                >
                  {isAssigned && '✓ '}
                  {s.nazev}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {visits.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card padding="md" className="bg-gradient-to-br from-accent-50 dark:from-accent-900/20 to-white dark:to-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1">Celkem návštěv</p>
            <p className="text-3xl font-bold text-accent-700">{visits.length}</p>
          </Card>
          <Card padding="md" className="bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-white dark:to-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-1">Celkem utraceno</p>
            <p className="text-3xl font-bold text-emerald-700">
              {visits.reduce((sum, v) => sum + (v.celkova_castka || 0) + (v.produkty_castka || 0), 0).toLocaleString('cs-CZ')} Kč
            </p>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
          Návštěvy
        </h2>
        <Button onClick={() => navigate(`/visits/new/${id}`)}>
          + Nová návštěva
        </Button>
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="Žádné návštěvy"
          description="Vytvořte první návštěvu pro tohoto klienta"
        />
      ) : (
        <div className="space-y-3">
          {visits.map((visit, idx) => (
            <Card
              key={visit.id}
              hover
              padding="md"
              className="group animate-slide-in"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div 
                  className="flex items-center gap-4 flex-1 cursor-pointer" 
                  onClick={() => navigate(`/visits/${visit.id}`)}
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 group-hover:text-accent-700 transition-colors">
                      {formatDate(visit.datum)}
                    </div>
                    {visit.poznamka && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-0.5">{visit.poznamka}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintReceipt(visit.id);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 dark:bg-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Vytisknout účtenku"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Účtenka
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/visits/${visit.id}/copy`);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Opakovat tuto návštěvu"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Opakovat
                  </button>
                  <Badge variant="service">
                    {visit.sluzby_count != null ? `${visit.sluzby_count} ${visit.sluzby_count === 1 ? 'služba' : visit.sluzby_count < 5 ? 'služby' : 'služeb'}` : 'služby'}
                  </Badge>
                  {visit.castka_produkty != null && visit.castka_produkty > 0 && (
                    <Badge variant="product">
                      🛍️ produkty
                    </Badge>
                  )}
                  {visit.celkova_castka != null && (
                    <span className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {visit.celkova_castka.toLocaleString('cs-CZ')} Kč
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/visits/${visit.id}`);
                    }}
                    className="flex-shrink-0"
                  >
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400 group-hover:text-accent-600 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Product sales */}
      {sales.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100">
              Prodej produktů
            </h2>
          </div>

          <div className="space-y-3">
            {sales.map((sale, idx) => (
              <Card
                key={sale.id}
                padding="md"
                className="animate-slide-in"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100">
                      {formatDate(sale.datum)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
                      {sale.produkty.map(p => `${p.produkt_nazev} (${p.pocet_ks} ks)`).join(', ')}
                    </div>
                    {sale.poznamka && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">{sale.poznamka}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="product">
                      💰 {sale.produkty.reduce((sum, p) => sum + p.pocet_ks, 0)} ks
                    </Badge>
                    <span className="font-semibold text-emerald-600">
                      {sale.celkova_castka.toLocaleString('cs-CZ')} Kč
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
