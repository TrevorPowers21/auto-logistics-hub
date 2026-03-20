import { useState, useEffect, useCallback } from "react";

export function useStoreData<T>(getter: () => T[]): T[] {
  const [data, setData] = useState<T[]>(getter);

  useEffect(() => {
    const handler = () => setData(getter());
    window.addEventListener("store-update", handler);
    return () => window.removeEventListener("store-update", handler);
  }, [getter]);

  const refresh = useCallback(() => setData(getter()), [getter]);

  useEffect(() => { refresh(); }, [refresh]);

  return data;
}
