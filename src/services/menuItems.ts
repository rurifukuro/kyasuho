// src/services/menuItems.ts — メニューマスタCRUD（SPEC §25-2・ky_menu_items）

import { supabase } from '../config/supabase';
import type { MenuItem, MenuCategory } from '../types';

type MenuItemRow = {
  id: string;
  tenant_id: string;
  category: MenuCategory;
  name: string;
  price: number;
  needs_cast: boolean;
  sort_order: number;
  is_active: boolean;
  back_rate: number | null;
  back_amount: number | null;
};

function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    category: row.category,
    name: row.name,
    price: row.price,
    needsCast: row.needs_cast,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    backRate: row.back_rate,
    backAmount: row.back_amount,
  };
}

export async function fetchMenuItems(tenantId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('ky_menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return ((data ?? []) as MenuItemRow[]).map(rowToMenuItem);
}

export type MenuItemInput = {
  category: MenuCategory;
  name: string;
  price: number;
  needsCast: boolean;
  sortOrder: number;
  isActive: boolean;
  backRate: number | null;
  backAmount: number | null;
};

export async function createMenuItem(
  tenantId: string,
  input: MenuItemInput,
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('ky_menu_items')
    .insert({
      tenant_id: tenantId,
      category: input.category,
      name: input.name,
      price: input.price,
      needs_cast: input.needsCast,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      back_rate: input.backRate,
      back_amount: input.backAmount,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMenuItem(data as MenuItemRow);
}

export async function updateMenuItem(
  id: string,
  input: Partial<MenuItemInput>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.category !== undefined) updates.category = input.category;
  if (input.name !== undefined) updates.name = input.name;
  if (input.price !== undefined) updates.price = input.price;
  if (input.needsCast !== undefined) updates.needs_cast = input.needsCast;
  if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.backRate !== undefined) updates.back_rate = input.backRate;
  if (input.backAmount !== undefined) updates.back_amount = input.backAmount;
  const { error } = await supabase
    .from('ky_menu_items')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('ky_menu_items').delete().eq('id', id);
  if (error) throw error;
}
