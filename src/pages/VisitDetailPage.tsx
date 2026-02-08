import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getVisit, updateVisit, deleteVisit, getClient } from '@/lib/firestore';
import type { NavstevaFull } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import Button from '@/components/Button';
import Badge from '@/components/Badge';
import Card from '@/components/Card';
import Input from '@/components/Input';
import { useSetBreadcrumbs } from '@/lib/breadcrumbs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visit, setVisit] = useState<NavstevaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingAmount, setEditingAmount] = useState(false);
  const [amount, setAmount] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);

  const breadcrumbs = useMemo(() => {
    if (!visit) return null;
    return [
      { label: 'Klienti', to: '/clients' },
      { label: `${visit.klient_jmeno} ${visit.klient_prijmeni}`, to: `/clients/${visit.klient_id}` },
      { label: new Date(visit.datum).toLocaleDateString('cs-CZ') },
    ];
  }, [visit]);
  useSetBreadcrumbs(breadcrumbs);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const data = await getVisit(user.uid, id);
      
      // If visit doesn't have client name (old data), fetch it from client
      if (!data.klient_jmeno && data.klient_id) {
        try {
          const client = await getClient(user.uid, data.klient_id);
          data.klient_jmeno = client.jmeno;
          data.klient_prijmeni = client.prijmeni;
        } catch (err) {
          console.error('Failed to load client name:', err);
        }
      }
      
      setVisit(data as NavstevaFull);
      setAmount(data.castka_sluzby?.toString() || '');
    } finally {
      setLoading(false);
    }
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  const handleSaveAmount = async () => {
    if (!user || !id) return;
    try {
      await updateVisit(user.uid, id, {
        castka_sluzby: amount ? Number(amount) : null,
      });
      toast.success('Částka uložena');
      setEditingAmount(false);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při ukládání');
    }
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    const klientId = visit?.klient_id;
    try {
      await deleteVisit(user.uid, id);
      toast.success('Návštěva smazána');
      navigate(klientId ? `/clients/${klientId}` : '/clients');
    } catch (err: any) {
      toast.error(err.message || 'Chyba při mazání');
    }
  };

  const handleCopy = () => {
    navigate(`/visits/${id}/copy`);
  };

  const handlePrint = () => {
    if (!visit) return;
    
    const doc = new jsPDF();
    let yPos = 20;
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEPTURA', 105, yPos, { align: 'center' });
    
    yPos += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Klient: ${visit.klient_jmeno} ${visit.klient_prijmeni}`, 20, yPos);
    doc.text(`Datum: ${formatDate(visit.datum)}`, 150, yPos);
    
    yPos += 10;
    
    // Services
    visit.sluzby.forEach((sluzba, sIdx) => {
      yPos += 10;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${sIdx + 1}. ${sluzba.nazev}`, 20, yPos);
      yPos += 5;
      
      // Each bowl
      (sluzba.misky || []).forEach((miska, mIdx) => {
        yPos += 5;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Miska ${mIdx + 1}`, 25, yPos);
        yPos += 2;
        
        // Materials table
        const tableData = (miska.materialy || []).map(mat => [
          mat.material_nazev,
          mat.odstin_cislo || '-',
          `${mat.gramy_materialu}g`
        ]);
        
        // Add oxidant row if exists
        if (miska.oxidant_id) {
          tableData.push([
            `OXIDANT: ${miska.oxidant_nazev || 'Neznámý'}`,
            '',
            `${miska.gramy_oxidantu}g`
          ]);
        }
        
        autoTable(doc, {
          startY: yPos,
          head: [['Materiál', 'Odstín', 'Gramáž']],
          body: tableData,
          margin: { left: 30 },
          styles: { 
            fontSize: 10,
            cellPadding: 3
          },
          headStyles: {
            fillColor: [0, 0, 0],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          columnStyles: {
            2: { halign: 'right', fontStyle: 'bold' }
          }
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 5;
      });
      
      // Check if we need new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    // Open in new window instead of download
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const handlePrintThermal = () => {
    if (!visit) return;
    
    // Thermal printer format - 80mm width (approx 72mm printable)
    const doc = new jsPDF({
      format: [80, 297], // 80mm width, auto height
      unit: 'mm'
    });
    
    let yPos = 5;
    const leftMargin = 3;
    const pageWidth = 74; // 80mm - margins
    
    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEPTURA', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    
    // Separator
    doc.setLineWidth(0.3);
    doc.line(leftMargin, yPos, pageWidth, yPos);
    yPos += 4;
    
    // Client & Date
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${visit.klient_jmeno} ${visit.klient_prijmeni}`, leftMargin, yPos);
    yPos += 4;
    doc.text(formatDate(visit.datum), leftMargin, yPos);
    yPos += 4;
    
    // Separator
    doc.line(leftMargin, yPos, pageWidth, yPos);
    yPos += 5;
    
    // Services
    visit.sluzby.forEach((sluzba, sIdx) => {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${sIdx + 1}. ${sluzba.nazev}`, leftMargin, yPos);
      yPos += 5;
      
      // Each bowl
      (sluzba.misky || []).forEach((miska, mIdx) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Miska ${mIdx + 1}:`, leftMargin + 2, yPos);
        yPos += 4;
        
        // Materials
        doc.setFont('helvetica', 'normal');
        (miska.materialy || []).map(mat => {
          const line = `  ${mat.material_nazev} ${mat.odstin_cislo || ''}: ${mat.gramy_materialu}g`;
          doc.text(line, leftMargin + 2, yPos);
          yPos += 4;
        });
        
        // Oxidant
        if (miska.oxidant_id) {
          doc.setFont('helvetica', 'bold');
          doc.text(`  OXIDANT ${miska.oxidant_nazev || ''}: ${miska.gramy_oxidantu}g`, leftMargin + 2, yPos);
          yPos += 5;
        }
        
        yPos += 2;
      });
      
      yPos += 2;
    });
    
    // Open in new window
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const handlePrintReceipt = () => {
    if (!visit) return;
    
    // Simple receipt - 80mm width, no materials
    const doc = new jsPDF({
      format: [80, 297],
      unit: 'mm'
    });
    
    // Helper to handle Czech characters
    const text = (str: string, x: number, y: number, options?: any) => {
      // Replace Czech characters with ASCII approximations for basic support
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
      
      // Price if exists
      if (sluzba.cena) {
        text(`${sluzba.cena} Kc`, pageWidth, yPos, { align: 'right' });
      }
      
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
        
        // Price per piece * quantity
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
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) return <LoadingSpinner className="py-20" />;
  if (!visit) return <div className="text-center py-20 text-gray-500 dark:text-gray-400 dark:text-gray-500">Návštěva nenalezena</div>;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Detail návštěvy</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
            <button
              onClick={() => navigate(`/clients/${visit.klient_id}`)}
              className="text-accent-600 dark:text-accent-400 hover:text-accent-700 dark:hover:text-accent-300 font-medium"
            >
              {visit.klient_jmeno} {visit.klient_prijmeni}
            </button>
            {' '}&mdash; {formatDate(visit.datum)}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Button 
              variant="secondary" 
              onClick={() => setShowPrintMenu(!showPrintMenu)} 
              className="print:hidden flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
              Vytisknout
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </Button>
            
            {showPrintMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[200px]">
                <button
                  onClick={() => {
                    handlePrint();
                    setShowPrintMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">A4 formát</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Standardní tisk s tabulkami</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handlePrintThermal();
                    setShowPrintMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Termo receptura</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">80mm s materiály</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handlePrintReceipt();
                    setShowPrintMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">Účtenka</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Jen služby a cena</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <Button variant="secondary" onClick={handleCopy} className="print:hidden">
            Zkopírovat recepturu
          </Button>
          <Button variant="danger" onClick={() => setShowDelete(true)} className="print:hidden">
            Smazat
          </Button>
        </div>
      </div>

      {/* Visit info */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Částka</span>
            {editingAmount ? (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 block mb-1">Za služby</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-32"
                      autoFocus
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Kč</span>
                  </div>
                </div>
                <Button size="sm" onClick={handleSaveAmount}>Uložit</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingAmount(false)}>Zrušit</Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {visit.castka_sluzby != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">Za služby:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{visit.castka_sluzby.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                )}
                {visit.castka_produkty != null && visit.castka_produkty > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">Za produkty:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{visit.castka_produkty.toLocaleString('cs-CZ')} Kč</span>
                  </div>
                )}
                {visit.celkova_castka != null && (
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Celkem:</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {visit.celkova_castka.toLocaleString('cs-CZ')} Kč
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingAmount(true)}>
                      Upravit
                    </Button>
                  </div>
                )}
                {visit.celkova_castka == null && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Nezadáno</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingAmount(true)}>
                      Zadat částku
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {visit.poznamka && (
          <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
            <span className="font-medium">Poznámka:</span> {visit.poznamka}
          </div>
        )}
      </Card>

      {/* Services detail */}
      <div className="space-y-4">
        {visit.sluzby.map((sluzba, sIdx) => (
          <Card key={sluzba.id} className="animate-slide-in avoid-break" style={{ animationDelay: `${sIdx * 50}ms` }}>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="service">#{sIdx + 1}</Badge>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {sluzba.nazev}
              </h3>
            </div>

            <div className="space-y-4">
              {(sluzba.misky || []).map((miska, mIdx) => (
                <div key={miska.id} className="ml-2 sm:ml-4 pl-4 border-l-2 border-purple-200">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-3 bg-purple-50 inline-block px-2 py-1 rounded">
                    Miska {mIdx + 1}
                  </p>
                  
                  <div className="space-y-2 mb-3">
                    {(miska.materialy || []).map(mat => (
                      <div key={mat.id} className="flex items-center gap-2 text-sm flex-wrap bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">
                        <Badge variant="material">{mat.material_nazev}</Badge>
                        {mat.odstin_cislo && (
                          <span className="text-gray-700 dark:text-gray-300 font-medium">{mat.odstin_cislo}</span>
                        )}
                        <span className="text-gray-900 dark:text-gray-100 font-semibold">
                          {mat.gramy_materialu}g
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {miska.oxidant_id && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-amber-800 font-medium">🧪 Oxidant:</span>
                        <Badge variant="oxidant">{miska.oxidant_nazev || 'Neznámý'}</Badge>
                        <span className="text-amber-900 font-semibold">
                          {miska.gramy_oxidantu}g
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">(auto)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Sold products */}
      {visit.produkty && visit.produkty.length > 0 && (
        <Card className="mt-4 animate-fade-in">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Prodané produkty</h3>
          <div className="space-y-2">
            {visit.produkty.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm p-3 bg-emerald-50/30 rounded-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="product">{p.produkt_nazev}</Badge>
                  <span className="text-gray-600 dark:text-gray-400 dark:text-gray-500">
                    {p.pocet_ks} ks × {p.cena_za_ks.toLocaleString('cs-CZ')} Kč
                  </span>
                </div>
                <span className="font-semibold text-emerald-700">
                  {(p.pocet_ks * p.cena_za_ks).toLocaleString('cs-CZ')} Kč
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Smazat návštěvu?"
        message="Tato akce je nevratná. Návštěva bude trvale smazána."
        confirmLabel="Smazat"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
