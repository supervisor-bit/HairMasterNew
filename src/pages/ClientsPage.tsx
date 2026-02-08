import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getClients, getClient, createClient, getSkupiny, createSkupina, updateClient } from '@/lib/firestore';
import type { Klient, Skupina } from '@/lib/types';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Klient[]>([]);
  const [skupiny, setSkupiny] = useState<Skupina[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSkupina, setSelectedSkupina] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showNewSkupina, setShowNewSkupina] = useState(false);
  const [newForm, setNewForm] = useState({ jmeno: '', prijmeni: '', telefon: '', poznamka: '', alergie: '' });
  const [newSkupinaForm, setNewSkupinaForm] = useState({ nazev: '', barva: '#3b82f6' });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadSkupiny = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getSkupiny(user.uid);
      setSkupiny(data as Skupina[]);
    } catch {
      // Skupiny are optional
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getClients(user.uid, search.trim(), selectedSkupina, showInactive);
      setClients(data as Klient[]);
    } finally {
      setLoading(false);
    }
  }, [user, search, selectedSkupina, showInactive]);

  useEffect(() => {
    loadSkupiny();
  }, [loadSkupiny]);

  useEffect(() => {
    const timer = setTimeout(() => load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to close modals
      if (e.key === 'Escape') {
        if (showNew) setShowNew(false);
        if (showNewSkupina) setShowNewSkupina(false);
      }
      // N to create new client (when not in input)
      if (e.key === 'n' && !showNew && !showNewSkupina && document.activeElement?.tagName !== 'INPUT') {
        setShowNew(true);
      }
      // Cmd/Ctrl+K for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNew, showNewSkupina]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreate = async () => {
    if (!newForm.jmeno.trim() || !newForm.prijmeni.trim() || !user) {
      toast.error('Jméno a příjmení jsou povinné');
      return;
    }
    try {
      await createClient(user.uid, newForm);
      toast.success('Klient vytvořen');
      setShowNew(false);
      setNewForm({ jmeno: '', prijmeni: '', telefon: '', poznamka: '', alergie: '' });
      load(); // Reload the list instead of navigating
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření klienta');
    }
  };

  const handleCreateSkupina = async () => {
    if (!newSkupinaForm.nazev.trim() || !user) {
      toast.error('Název skupiny je povinný');
      return;
    }
    try {
      await createSkupina(user.uid, newSkupinaForm);
      toast.success('Skupina vytvořena');
      setShowNewSkupina(false);
      setNewSkupinaForm({ nazev: '', barva: '#3b82f6' });
      loadSkupiny();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při vytváření skupiny');
    }
  };

  const toggleSkupina = async (clientId: string, skupinaId: string, currentSkupiny: string[]) => {
    if (!user) return;
    try {
      const newSkupiny = currentSkupiny.includes(skupinaId)
        ? currentSkupiny.filter(id => id !== skupinaId)
        : [...currentSkupiny, skupinaId];
      
      await updateClient(user.uid, clientId, { skupina_ids: newSkupiny });
      toast.success('Skupina upravena');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Chyba při úpravě skupiny');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-gray-100">Klienti</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 rounded text-xs">N</kbd> nový klient · 
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 rounded text-xs ml-1">⌘K</kbd> hledat · 
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 rounded text-xs ml-1">Esc</kbd> zavřít
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showInactive ? "secondary" : "ghost"}
            onClick={() => setShowInactive(!showInactive)}
            size="sm"
          >
            {showInactive ? 'Zobrazit jen aktivní' : 'Zobrazit i neaktivní'}
          </Button>
          <Button variant="secondary" onClick={() => setShowNewSkupina(true)}>
            + Skupina
          </Button>
          <Button onClick={() => setShowNew(true)}>
            + Nový klient
          </Button>
        </div>
      </div>

      {/* Group filter */}
      {skupiny.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">Filtr:</span>
          <button
            onClick={() => setSelectedSkupina(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedSkupina === null
                ? 'bg-gray-800 dark:bg-gray-700 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Všichni
          </button>
          {skupiny.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSkupina(s.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedSkupina === s.id
                  ? 'text-white shadow-sm'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: selectedSkupina === s.id ? s.barva : `${s.barva}30`,
                color: selectedSkupina === s.id ? 'white' : s.barva,
              }}
            >
              {s.nazev}
            </button>
          ))}
        </div>
      )}

      <div className="mb-6">
        <Input
          type="text"
          placeholder="Hledat podle jména..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {showNewSkupina && (
        <Card className="mb-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-4">Nová skupina</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input
              label="Název skupiny"
              value={newSkupinaForm.nazev}
              onChange={e => setNewSkupinaForm(f => ({ ...f, nazev: e.target.value }))}
              required
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">Barva</label>
              <input
                type="color"
                value={newSkupinaForm.barva}
                onChange={e => setNewSkupinaForm(f => ({ ...f, barva: e.target.value }))}
                className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:border-gray-600 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNewSkupina(false)}>
              Zrušit
            </Button>
            <Button onClick={handleCreateSkupina}>
              Vytvořit
            </Button>
          </div>
        </Card>
      )}

      {showNew && (
        <Card className="mb-6 animate-slide-up">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-4">Nový klient</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <Input
              label="Jméno"
              value={newForm.jmeno}
              onChange={e => setNewForm(f => ({ ...f, jmeno: e.target.value }))}
              required
              autoFocus
            />
            <Input
              label="Příjmení"
              value={newForm.prijmeni}
              onChange={e => setNewForm(f => ({ ...f, prijmeni: e.target.value }))}
              required
            />
          </div>
          <div className="mb-4">
            <Input
              type="tel"
              label="Telefon"
              value={newForm.telefon}
              onChange={e => setNewForm(f => ({ ...f, telefon: e.target.value }))}
              placeholder="+420 123 456 789"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">
              Alergie <span className="text-red-600 text-xs">(důležité!)</span>
            </label>
            <textarea
              value={newForm.alergie}
              onChange={e => setNewForm(f => ({ ...f, alergie: e.target.value }))}
              rows={2}
              placeholder="PPD, amoniak, latex..."
              className="w-full px-3 py-2 border border-red-200 dark:border-red-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none transition-colors dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300 mb-1.5">Poznámka</label>
            <textarea
              value={newForm.poznamka}
              onChange={e => setNewForm(f => ({ ...f, poznamka: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent resize-none transition-colors dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNew(false)}>
              Zrušit
            </Button>
            <Button onClick={handleCreate}>
              Vytvořit
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : clients.length === 0 ? (
        <EmptyState
          title={search ? 'Žádné výsledky' : 'Zatím žádní klienti'}
          description={search ? 'Zkuste jiný hledaný výraz' : 'Vytvořte prvního klienta'}
        />
      ) : (
        <div className="grid gap-3">
          {clients.map((client, idx) => (
            <Card
              key={client.id}
              hover
              padding="md"
              className={`group animate-slide-in ${!client.aktivni ? 'opacity-60 bg-gray-50 dark:bg-gray-800' : ''}`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                  <Avatar jmeno={client.jmeno} prijmeni={client.prijmeni} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 dark:text-gray-100 group-hover:text-accent-700 transition-colors flex items-center gap-2">
                      {client.jmeno} {client.prijmeni}
                      {!client.aktivni && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                          Neaktivní
                        </span>
                      )}
                    </div>
                    {client.telefon && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-0.5">
                        <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25z" />
                        </svg>
                        {client.telefon}
                      </div>
                    )}
                    {client.alergie && (
                      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <span className="font-medium">Alergie:</span>
                        <span className="line-clamp-1">{client.alergie}</span>
                      </div>
                    )}
                    {client.poznamka && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{client.poznamka}</p>
                    )}
                    {client.skupiny && client.skupiny.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {client.skupiny.map(s => (
                          <span
                            key={s.id}
                            className="text-xs px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: s.barva }}
                          >
                            {s.nazev}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action menu */}
                <div className="relative" ref={openMenuId === client.id ? menuRef : null}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === client.id ? null : client.id);
                    }}
                    className="p-2 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Akce"
                  >
                    <svg className="w-5 h-5 text-gray-400 dark:text-gray-500 dark:text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {openMenuId === client.id && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 dark:border-gray-700 z-10 animate-slide-up">
                      <div className="p-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Přiřadit do skupiny</p>
                        {skupiny.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 italic py-2">Nejsou žádné skupiny</p>
                        ) : (
                          <div className="space-y-1">
                            {skupiny.map(s => {
                              const isAssigned = client.skupiny?.some(cs => cs.id === s.id);
                              return (
                                <button
                                  key={s.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSkupina(client.id, s.id, client.skupiny?.map(sk => sk.id) || []);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-700 transition-colors text-left"
                                >
                                  <div className="flex items-center justify-center w-5 h-5">
                                    {isAssigned && (
                                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: s.barva }}
                                  ></span>
                                  <span className="flex-1">{s.nazev}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
