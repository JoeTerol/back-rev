// Los tests no deben depender del .env de quien los corre: sin admin inicial.
process.env.SEED_ADMIN_EMAIL = '';
process.env.SEED_ADMIN_USERNAME = '';
process.env.SEED_ADMIN_PASSWORD = '';

export {};