import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { getClients } from '@/lib/firestore';
import type { Klient } from '@/lib/types';

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  category: 'akce' | 'navigace' | 'klient';
}

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<CommandItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CommandItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clients, setClients] = useState<Klient[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load clients
  useEffect(() => {
    if (!user || !isOpen) return;
    getClients(user.uid).then(data => setClients(data as Klient[]));
  }, [user, isOpen]);

  // Build command items
  useEffect(() => {
    const commands: CommandItem[] = [
      // Akce
      {
        id: 'new-client',
        label: 'Nový klient',
        icon: '👤',
        category: 'akce',
        action: () => {
          setIsOpen(false);
          navigate('/clients?new=true');
        },
      },
      {
        id: 'new-visit',
        label: 'Nová návštěva',
        icon: '✨',
        category: 'akce',
        action: () => {
          setIsOpen(false);
          navigate('/visits/new');
        },
      },
      // Navigace
      {
        id: 'nav-dashboard',
        label: 'Přehled',
        icon: '🏠',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/');
        },
      },
      {
        id: 'nav-clients',
        label: 'Klienti',
        icon: '👥',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/clients');
        },
      },
      {
        id: 'nav-materials',
        label: 'Materiály',
        icon: '🎨',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/materials');
        },
      },
      {
        id: 'nav-products',
        label: 'Produkty',
        icon: '🛍️',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/products');
        },
      },
      {
        id: 'nav-trzby',
        label: 'Tržby',
        icon: '💰',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/trzby');
        },
      },
      {
        id: 'nav-settings',
        label: 'Nastavení',
        icon: '⚙️',
        category: 'navigace',
        action: () => {
          setIsOpen(false);
          navigate('/settings');
        },
      },
    ];

    // Add clients
    clients.forEach(client => {
      commands.push({
        id: `client-${client.id}`,
        label: `${client.jmeno} ${client.prijmeni}`,
        icon: '👤',
        category: 'klient',
        action: () => {
          setIsOpen(false);
          navigate(`/clients/${client.id}`);
        },
      });
    });

    setItems(commands);
  }, [clients, navigate]);

  // Filter items based on search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredItems(items.filter(i => i.category !== 'klient'));
    } else {
      const searchLower = search.toLowerCase();
      const filtered = items.filter(item =>
        item.label.toLowerCase().includes(searchLower)
      );
      setFilteredItems(filtered);
    }
    setSelectedIndex(0);
  }, [search, items]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K nebo Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
      }

      if (!isOpen) return;

      // Escape
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }

      // Arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }

      // Enter
      if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].action();
        setSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-in">
        {/* Search input */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Co chcete udělat?"
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 text-lg"
            />
            <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded border border-gray-300 dark:border-gray-600">
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Nenalezeno
            </div>
          ) : (
            <div className="p-2">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setSearch('');
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                    ${index === selectedIndex
                      ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-900 dark:text-accent-100'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {item.category === 'akce' ? 'Akce' : item.category === 'navigace' ? 'Navigace' : 'Klient'}
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">↑↓</kbd>
                procházet
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">↵</kbd>
                vybrat
              </span>
            </div>
            <span>⌘K pro otevření</span>
          </div>
        </div>
      </div>
    </div>
  );
}
