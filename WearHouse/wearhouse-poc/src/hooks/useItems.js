import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useItems() {
  const [items, setItems] = useState([]);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setItems(data ?? []);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  return { items, setItems, loadItems };
}
