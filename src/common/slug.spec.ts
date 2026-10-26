import { slugify } from './slug';
describe('slugify', () => {
  it('should slugify a string', () => {
    expect(slugify('Aves Criollas')).toBe('aves-criollas');
  });
  it('should remove accents and tildes from a string', () => {
    expect(slugify('Edición de Primavera')).toBe('edicion-de-primavera');
    expect(slugify('año NUEvo')).toBe('ano-nuevo');
    expect(slugify('niño de la calle')).toBe('nino-de-la-calle');
  });
});
