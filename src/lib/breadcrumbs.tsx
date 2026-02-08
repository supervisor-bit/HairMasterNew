import { createContext, useContext, useState, useEffect } from 'react';

interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbContextType {
  crumbs: Crumb[] | null;
  setCrumbs: (crumbs: Crumb[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  crumbs: null,
  setCrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(BreadcrumbContext);
}

export function useSetBreadcrumbs(crumbs: Crumb[] | null) {
  const { setCrumbs } = useBreadcrumbs();
  useEffect(() => {
    setCrumbs(crumbs);
    return () => setCrumbs(null);
  }, [JSON.stringify(crumbs)]);
}
