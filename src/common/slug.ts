export const slugify = (text: string): string => {
  return text
    .normalize('NFD') // Normalize the string to decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks (accents, tildes, etc.)
    .toLowerCase() // Convert to lowercase
    .trim() // Remove leading and trailing whitespace
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, ''); // Remove any remaining non-alphanumeric characters except hyphens
};
