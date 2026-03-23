type SlotDateInput = {
  id: number;
  localDate: string;
};

export function getSlotDateKey(slot: SlotDateInput) {
  return slot.localDate;
}

export function buildSlotGroups<T extends SlotDateInput>(slots: T[]) {
  const map = new Map<string, T[]>();
  for (const slot of slots) {
    const key = getSlotDateKey(slot);
    const items = map.get(key) ?? [];
    items.push(slot);
    map.set(key, items);
  }

  return map;
}
