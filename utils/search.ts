export const normalizeSearchText = (value: string | null | undefined): string => {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const normalizeRutForSearch = (value: string | null | undefined): string => {
  return normalizeSearchText(value).replace(/[^0-9k]/g, '');
};
